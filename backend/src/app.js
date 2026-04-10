const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const path    = require('path');

// ── Existing routes (UNCHANGED) ──────────────────────────
const authRoutes      = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

// ── NEW: orders & trades admin routes ────────────────────
const ordersAdminRoutes = require('./routes/ordersAdminRoutes');

// ── Existing middleware (UNCHANGED) ──────────────────────
const { verifyToken }      = require('./middleware/auth');
const { requireRole }      = require('./middleware/rbac');
const sqlInjectionDetector = require('./middleware/sqlInjectionDetector');

const app = express();

// ── Core security middleware (UNCHANGED) ─────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// ── SQL Injection Detector (added in previous step) ──────
app.use(sqlInjectionDetector);

// ── Static frontend (UNCHANGED) ──────────────────────────
app.use(express.static(path.join(__dirname, '../../frontend')));

// ── Health check (UNCHANGED) ─────────────────────────────
app.get('/api-status', (req, res) => {
  res.send('API is running...');
});

// ── Existing API routes (UNCHANGED) ──────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ── NEW: Admin orders & trades management ────────────────
app.use('/api/orders', ordersAdminRoutes);

// ── Existing protected routes (UNCHANGED) ────────────────
app.get('/api/admin', verifyToken, requireRole('admin'), (req, res) => {
  res.json({ message: 'Admin only area' });
});

app.get('/api/reports', verifyToken, requireRole('admin', 'staff'), (req, res) => {
  res.json({ message: 'Reports - admin and staff only' });
});

module.exports = app;