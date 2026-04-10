const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const path    = require('path');

const authRoutes        = require('./routes/authRoutes');
const dashboardRoutes   = require('./routes/dashboardRoutes');
const ordersAdminRoutes = require('./routes/ordersAdminRoutes');

const { verifyToken }         = require('./middleware/auth');
const { requireRole }         = require('./middleware/rbac');
const sqlInjectionDetector    = require('./middleware/sqlInjectionDetector');
const { registerAdminClient } = require('./middleware/sqlInjectionDetector');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.use(sqlInjectionDetector);

app.use(express.static(path.join(__dirname, '../../frontend')));

app.get('/api-status', (req, res) => {
  res.send('API is running...');
});

app.use('/api/auth',      authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/orders',    ordersAdminRoutes);

// ── Real-time admin alert stream (SSE) ───────────────────────────────────────
// EventSource cannot set headers — token accepted via query param
app.get('/api/admin/alert-stream', (req, res, next) => {
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = 'Bearer ' + req.query.token;
  }
  next();
}, verifyToken, requireRole('admin'), (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  // Heartbeat every 25s to keep connection alive through proxies
  const hb = setInterval(() => { try { res.write(': heartbeat\n\n'); } catch (_) {} }, 25000);
  res.on('close', () => clearInterval(hb));
  registerAdminClient(res, req.user.id);
});

app.get('/api/admin', verifyToken, requireRole('admin'), (req, res) => {
  res.json({ message: 'Admin only area' });
});

app.get('/api/reports', verifyToken, requireRole('admin', 'staff'), (req, res) => {
  res.json({ message: 'Reports - admin and staff only' });
});

module.exports = app;