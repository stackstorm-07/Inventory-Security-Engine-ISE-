/**
 * ============================================================
 *  ORDERS & TRADES ADMIN ROUTES
 *  Inventory Security Engine (ISE)
 * ============================================================
 *  NEW FILE — does NOT modify any existing route file.
 *  Registered in app.js under /api/orders
 *
 *  Added endpoints:
 *    GET  /api/orders/stats              → counts for dashboard
 *    PATCH /api/orders/:id/approve       → mark approved + log
 *    PATCH /api/orders/:id/reject        → mark rejected + log
 *    PATCH /api/orders/:id/fulfill       → checked_out asset + inventory_log
 *    GET  /api/orders/trades             → all trades (admin/staff view)
 *    PATCH /api/orders/trades/:id/cancel → admin force-cancel a suspicious trade
 * ============================================================
 */

const express = require('express');
const pool    = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

// ──────────────────────────────────────────────────────────
// HELPER: insert a row into inventory_logs
// ──────────────────────────────────────────────────────────
async function writeInventoryLog(conn, { asset_id, item_name, user, action, location, status }) {
  await conn.query(
    `INSERT INTO inventory_logs (date_time, asset_id, item_name, user, action, location, status)
     VALUES (NOW(), ?, ?, ?, ?, ?, ?)`,
    [asset_id, item_name, user, action, location || null, status || 'Completed']
  );
}

// ──────────────────────────────────────────────────────────
// GET /api/orders/stats
// Returns order/trade counts for the admin dashboard cards
// ──────────────────────────────────────────────────────────
router.get('/stats', verifyToken, requireRole('admin', 'staff'), async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    // Order counts
    const orderCounts = await conn.query(`
      SELECT
        COUNT(*)                                                     AS total_orders,
        SUM(CASE WHEN status = 'pending'   THEN 1 ELSE 0 END)       AS pending,
        SUM(CASE WHEN status = 'approved'  THEN 1 ELSE 0 END)       AS approved,
        SUM(CASE WHEN status = 'fulfilled' THEN 1 ELSE 0 END)       AS fulfilled,
        SUM(CASE WHEN status = 'rejected'  THEN 1 ELSE 0 END)       AS rejected,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)       AS cancelled,
        SUM(CASE WHEN status = 'fulfilled'
               AND DATE(updated_at) = CURDATE() THEN 1 ELSE 0 END)  AS fulfilled_today
      FROM viewer_orders
    `);

    // Trade counts
    const tradeCounts = await conn.query(`
      SELECT
        COUNT(*)                                                  AS total_trades,
        SUM(CASE WHEN status = 'pending'   THEN 1 ELSE 0 END)    AS active_trades,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)    AS completed_trades
      FROM viewer_trades
    `);

    // 5 most-recent pending orders with viewer + asset info
    const pending = await conn.query(`
      SELECT
        o.id, o.asset_id, o.note, o.status, o.created_at,
        a.name  AS asset_name,
        a.location,
        u.username AS viewer_username,
        u.full_name AS viewer_full_name
      FROM viewer_orders o
      JOIN assets a ON a.asset_id = o.asset_id
      JOIN users  u ON u.id = o.viewer_user_id
      WHERE o.status = 'pending'
      ORDER BY o.created_at DESC
      LIMIT 5
    `);

    res.json({
      orders:  orderCounts[0],
      trades:  tradeCounts[0],
      recent_pending: pending
    });
  } catch (err) {
    console.error('Error fetching order stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  } finally {
    if (conn) conn.release();
  }
});

// ──────────────────────────────────────────────────────────
// PATCH /api/orders/:id/approve
// Admin / staff: approve a pending order (does NOT touch asset yet)
// ──────────────────────────────────────────────────────────
router.patch('/:id/approve', verifyToken, requireRole('admin', 'staff'), async (req, res) => {
  const { id } = req.params;
  const { staff_response } = req.body;
  let conn;
  try {
    conn = await pool.getConnection();

    const orders = await conn.query(
      `SELECT o.*, a.name AS asset_name, u.username AS viewer_username
       FROM viewer_orders o
       JOIN assets a ON a.asset_id = o.asset_id
       JOIN users  u ON u.id = o.viewer_user_id
       WHERE o.id = ?`, [id]
    );
    if (!orders.length) return res.status(404).json({ error: 'Order not found.' });

    const order = orders[0];
    if (order.status !== 'pending') {
      return res.status(400).json({ error: `Order is already "${order.status}". Only pending orders can be approved.` });
    }

    await conn.query(
      `UPDATE viewer_orders SET status = 'approved', staff_response = ?, updated_at = NOW() WHERE id = ?`,
      [staff_response || 'Order approved by staff.', id]
    );

    // Write a log entry so the viewer can see it in Inventory Logs
    await writeInventoryLog(conn, {
      asset_id:  order.asset_id,
      item_name: order.asset_name,
      user:      order.viewer_username,
      action:    'Checked Out',
      location:  null,
      status:    'Pending Return'
    });

    res.json({ message: `Order #${id} approved. Viewer has been notified via the order status.` });
  } catch (err) {
    console.error('Error approving order:', err);
    res.status(500).json({ error: 'Failed to approve order' });
  } finally {
    if (conn) conn.release();
  }
});

// ──────────────────────────────────────────────────────────
// PATCH /api/orders/:id/reject
// Admin / staff: reject a pending or approved order
// ──────────────────────────────────────────────────────────
router.patch('/:id/reject', verifyToken, requireRole('admin', 'staff'), async (req, res) => {
  const { id } = req.params;
  const { staff_response } = req.body;
  let conn;
  try {
    conn = await pool.getConnection();

    const orders = await conn.query('SELECT * FROM viewer_orders WHERE id = ?', [id]);
    if (!orders.length) return res.status(404).json({ error: 'Order not found.' });

    const order = orders[0];
    if (!['pending', 'approved'].includes(order.status)) {
      return res.status(400).json({ error: `Cannot reject an order with status "${order.status}".` });
    }

    await conn.query(
      `UPDATE viewer_orders SET status = 'rejected', staff_response = ?, updated_at = NOW() WHERE id = ?`,
      [staff_response || 'Order rejected.', id]
    );

    res.json({ message: `Order #${id} rejected.` });
  } catch (err) {
    console.error('Error rejecting order:', err);
    res.status(500).json({ error: 'Failed to reject order' });
  } finally {
    if (conn) conn.release();
  }
});

// ──────────────────────────────────────────────────────────
// PATCH /api/orders/:id/fulfill  ← THE KEY PROCEDURE
// Admin / staff: fulfil an approved order.
//   1. Marks order as 'fulfilled'
//   2. Sets asset status = 'checked_out', assigned_to = viewer
//   3. Writes an inventory_log row (action = 'Checked Out')
//   All three inside a single DB transaction — atomic.
// ──────────────────────────────────────────────────────────
router.patch('/:id/fulfill', verifyToken, requireRole('admin', 'staff'), async (req, res) => {
  const { id } = req.params;
  const { staff_response } = req.body;
  let conn;
  try {
    conn = await pool.getConnection();

    // Fetch full order with joins
    const orders = await conn.query(`
      SELECT
        o.*,
        a.name     AS asset_name,
        a.location AS asset_location,
        u.username AS viewer_username,
        u.full_name AS viewer_full_name
      FROM viewer_orders o
      JOIN assets a ON a.asset_id = o.asset_id
      JOIN users  u ON u.id = o.viewer_user_id
      WHERE o.id = ?
    `, [id]);

    if (!orders.length) return res.status(404).json({ error: 'Order not found.' });

    const order = orders[0];

    if (!['pending', 'approved'].includes(order.status)) {
      return res.status(400).json({
        error: `Cannot fulfill an order with status "${order.status}". Only pending or approved orders can be fulfilled.`
      });
    }

    // ── Atomic transaction ───────────────────────────
    await conn.beginTransaction();
    try {
      // 1. Fulfil the order
      await conn.query(
        `UPDATE viewer_orders
         SET status = 'fulfilled', staff_response = ?, updated_at = NOW()
         WHERE id = ?`,
        [staff_response || `Fulfilled by ${req.user.username}.`, id]
      );

      // 2. Update asset: checked out to the viewer
      await conn.query(
        `UPDATE assets
         SET status = 'checked_out', assigned_to = ?, last_updated = NOW()
         WHERE asset_id = ?`,
        [order.viewer_username, order.asset_id]
      );

      // 3. Write inventory log
      await conn.query(
        `INSERT INTO inventory_logs (date_time, asset_id, item_name, user, action, location, status)
         VALUES (NOW(), ?, ?, ?, 'Checked Out', ?, 'Pending Return')`,
        [
          order.asset_id,
          order.asset_name,
          order.viewer_username,
          order.asset_location || 'Main Store'
        ]
      );

      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    }
    // ── End transaction ──────────────────────────────

    res.json({
      message: `Order #${id} fulfilled. Asset "${order.asset_name}" (${order.asset_id}) is now checked out to ${order.viewer_username}.`,
      asset_id: order.asset_id,
      viewer:   order.viewer_username
    });
  } catch (err) {
    console.error('Error fulfilling order:', err);
    res.status(500).json({ error: 'Failed to fulfil order' });
  } finally {
    if (conn) conn.release();
  }
});

// ──────────────────────────────────────────────────────────
// GET /api/orders/all
// Admin / staff: all viewer orders with full details + pagination
// ──────────────────────────────────────────────────────────
router.get('/all', verifyToken, requireRole('admin', 'staff'), async (req, res) => {
  const status = req.query.status;   // optional filter
  let conn;
  try {
    conn = await pool.getConnection();

    let where = '';
    const params = [];
    if (status && status !== 'all') {
      where = 'WHERE o.status = ?';
      params.push(status);
    }

    const rows = await conn.query(`
      SELECT
        o.id, o.asset_id, o.note, o.status, o.staff_response,
        o.created_at, o.updated_at,
        a.name     AS asset_name,
        a.status   AS asset_status,
        a.location AS asset_location,
        a.category AS asset_category,
        u.id       AS viewer_id,
        u.username AS viewer_username,
        u.full_name AS viewer_full_name,
        u.email    AS viewer_email
      FROM viewer_orders o
      JOIN assets a ON a.asset_id = o.asset_id
      JOIN users  u ON u.id = o.viewer_user_id
      ${where}
      ORDER BY
        CASE o.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
        o.created_at DESC
      LIMIT 100
    `, params);

    res.json(rows);
  } catch (err) {
    console.error('Error fetching all orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  } finally {
    if (conn) conn.release();
  }
});

// ──────────────────────────────────────────────────────────
// GET /api/orders/trades
// Admin / staff: all viewer-to-viewer trades with full details
// ──────────────────────────────────────────────────────────
router.get('/trades', verifyToken, requireRole('admin', 'staff'), async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(`
      SELECT
        t.id, t.status, t.message, t.created_at, t.updated_at,
        fu.username AS from_username, fu.full_name AS from_full_name,
        tu.username AS to_username,   tu.full_name AS to_full_name,
        oa.name     AS offer_asset_name,   oa.category AS offer_category,
        ra.name     AS request_asset_name, ra.category AS request_category,
        t.offer_asset_id, t.request_asset_id
      FROM viewer_trades t
      JOIN users  fu ON fu.id = t.from_user_id
      JOIN users  tu ON tu.id = t.to_user_id
      JOIN assets oa ON oa.asset_id = t.offer_asset_id
      JOIN assets ra ON ra.asset_id = t.request_asset_id
      ORDER BY
        CASE t.status WHEN 'pending' THEN 0 ELSE 1 END,
        t.created_at DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching trades:', err);
    res.status(500).json({ error: 'Failed to fetch trades' });
  } finally {
    if (conn) conn.release();
  }
});

// ──────────────────────────────────────────────────────────
// PATCH /api/orders/trades/:id/cancel
// Admin only: force-cancel a suspicious or problematic trade
// ──────────────────────────────────────────────────────────
router.patch('/trades/:id/cancel', verifyToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  let conn;
  try {
    conn = await pool.getConnection();
    const trades = await conn.query('SELECT * FROM viewer_trades WHERE id = ?', [id]);
    if (!trades.length) return res.status(404).json({ error: 'Trade not found.' });

    const trade = trades[0];
    if (trade.status !== 'pending') {
      return res.status(400).json({ error: `Trade is already "${trade.status}". Only pending trades can be cancelled by admin.` });
    }

    await conn.query(
      `UPDATE viewer_trades SET status = 'cancelled', updated_at = NOW() WHERE id = ?`, [id]
    );

    // Log a security alert if reason contains suspicious keyword
    if (reason && /suspicious|fraud|unauthorized/i.test(reason)) {
      await conn.query(
        `INSERT INTO security_alerts (title, details, time, severity, resolved)
         VALUES (?, ?, NOW(), 'high', 0)`,
        [
          'Suspicious Trade Cancelled by Admin',
          `Admin ${req.user.username} cancelled trade #${id}. Reason: ${reason}`
        ]
      );
    }

    res.json({ message: `Trade #${id} cancelled by admin.` });
  } catch (err) {
    console.error('Error cancelling trade:', err);
    res.status(500).json({ error: 'Failed to cancel trade' });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;