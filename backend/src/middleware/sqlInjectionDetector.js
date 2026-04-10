/**
 * ============================================================
 *  SQL INJECTION DETECTION MIDDLEWARE
 *  Inventory Security Engine (ISE)
 * ============================================================
 *  Scans every incoming request (body, query, params, headers)
 *  for SQL injection patterns.
 *
 *  On detection:
 *    1. Logs the threat to the `security_alerts` DB table
 *    2. Returns HTTP 400 with a clear JSON error
 *    3. Admin dashboard security-alerts page shows the entry
 *    4. Broadcasts real-time SSE alert to all connected admins
 * ============================================================
 */

const pool = require('../config/db');

// ──────────────────────────────────────────────
// SSE: Track connected admin clients for real-time alerts
// ──────────────────────────────────────────────
const adminAlertClients = []; // { res, userId }

function registerAdminClient(res, userId) {
  adminAlertClients.push({ res, userId });
  res.on('close', () => {
    const idx = adminAlertClients.findIndex(c => c.res === res);
    if (idx !== -1) adminAlertClients.splice(idx, 1);
  });
}

function broadcastToAdmins(payload) {
  const data = JSON.stringify(payload);
  adminAlertClients.forEach(({ res }) => {
    try { res.write('data: ' + data + '\n\n'); } catch (_) {}
  });
}

// ──────────────────────────────────────────────
// SQL INJECTION PATTERN LIST
// ──────────────────────────────────────────────
const SQL_PATTERNS = [
  // Classic tautologies
  /(\b|\s)(OR|AND)\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/gi,
  /(\b|\s)(OR|AND)\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?/gi,

  // UNION-based injection
  /UNION(\s+ALL)?\s+SELECT/gi,

  // Comment sequences used to terminate queries
  /(--|#|\/\*[\s\S]*?\*\/)/g,

  // Stacked queries
  /;\s*(DROP|DELETE|INSERT|UPDATE|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE)/gi,

  // Standalone semicolon — potential query termination / injection probe
  /;/g,

  // Schema / table dumps
  /\bINFORMATION_SCHEMA\b/gi,
  /\bSYSCOLUMNS\b|\bSYSOBJECTS\b/gi,

  // Dangerous functions
  /\b(SLEEP|BENCHMARK|LOAD_FILE|OUTFILE|DUMPFILE|VERSION\s*\(|DATABASE\s*\(|USER\s*\()\b/gi,

  // Blind injection patterns
  /\bIF\s*\(/gi,
  /\bCASE\s+WHEN\b/gi,
  /\bWAITFOR\s+DELAY\b/gi,

  // Hex / encoding tricks
  /0x[0-9a-fA-F]{4,}/g,
  /CHAR\s*\(\s*\d+/gi,
  /CONCAT\s*\(/gi,

  // Drop / destructive
  /\bDROP\s+(TABLE|DATABASE|SCHEMA|INDEX|VIEW)\b/gi,
  /\bTRUNCATE\s+TABLE\b/gi,
  /\bDELETE\s+FROM\b/gi,
  /\bINSERT\s+INTO\b.*\bSELECT\b/gi,
];

// Paths that should NEVER be blocked (add more as needed)
const WHITELIST_PATHS = [
  /^\/api-status/,
];

// ──────────────────────────────────────────────
// HELPER: flatten any value to strings for scan
// ──────────────────────────────────────────────
function flattenToStrings(obj, depth = 0) {
  if (depth > 5) return [];          // guard against deeply nested payloads
  if (!obj) return [];
  if (typeof obj === 'string') return [obj];
  if (typeof obj === 'number') return [String(obj)];
  if (Array.isArray(obj)) return obj.flatMap(v => flattenToStrings(v, depth + 1));
  if (typeof obj === 'object') return Object.values(obj).flatMap(v => flattenToStrings(v, depth + 1));
  return [];
}

// ──────────────────────────────────────────────
// HELPER: scan a string against all patterns
// ──────────────────────────────────────────────
function detectSQLInjection(value) {
  if (!value || typeof value !== 'string') return null;
  const decoded = decodeURIComponent(value);            // handle URL-encoded attacks
  for (const pattern of SQL_PATTERNS) {
    pattern.lastIndex = 0;                              // reset stateful regex
    if (pattern.test(decoded)) {
      return pattern.toString();                        // return the matched rule
    }
  }
  return null;
}

// ──────────────────────────────────────────────
// HELPER: log threat to security_alerts table
// ──────────────────────────────────────────────
async function logThreat({ ip, method, path, matchedRule, payload }) {
  try {
    const conn = await pool.getConnection();

    // Truncate payload to 500 chars so DB doesn't overflow
    const safePayload = String(payload).slice(0, 500);

    await conn.query(
      `INSERT INTO security_alerts
         (title, details, time, asset_id, severity, resolved)
       VALUES (?, ?, NOW(), NULL, 'critical', 0)`,
      [
        `SQL Injection Attempt Detected`,
        `IP: ${ip} | Method: ${method} | Path: ${path} | Rule: ${matchedRule} | Payload: ${safePayload}`,
      ]
    );
    conn.release();

    // Broadcast real-time alert to all connected admin SSE clients
    broadcastToAdmins({
      type: 'SQL_INJECTION_ALERT',
      ip,
      method,
      path,
      matchedRule,
      payload: String(payload).slice(0, 200),
      time: new Date().toISOString(),
    });
  } catch (err) {
    // Never crash the server because of a logging failure
    console.error('[SQLi Detector] Failed to log threat to DB:', err.message);
  }
}

// ──────────────────────────────────────────────
// MAIN MIDDLEWARE
// ──────────────────────────────────────────────
async function sqlInjectionDetector(req, res, next) {
  // Skip whitelisted paths
  if (WHITELIST_PATHS.some(rx => rx.test(req.path))) return next();

  // Gather ALL inputs: body + query string + route params
  const inputs = [
    ...flattenToStrings(req.body),
    ...flattenToStrings(req.query),
    ...flattenToStrings(req.params),
  ];

  let matchedRule = null;
  let matchedPayload = null;

  for (const val of inputs) {
    const rule = detectSQLInjection(val);
    if (rule) {
      matchedRule = rule;
      matchedPayload = val;
      break;
    }
  }

  if (matchedRule) {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';

    console.warn(
      `\n🚨 [SQL INJECTION DETECTED] IP: ${ip} | ${req.method} ${req.originalUrl}\n` +
      `   Matched Rule : ${matchedRule}\n` +
      `   Payload      : ${String(matchedPayload).slice(0, 200)}\n`
    );

    // Log asynchronously — do NOT await so response is instant
    logThreat({
      ip,
      method: req.method,
      path: req.originalUrl,
      matchedRule,
      payload: matchedPayload,
    });

    return res.status(400).json({
      error: 'SQL Injection attempt detected.',
      code: 'SQL_INJECTION_BLOCKED',
      message: 'Your request contains potentially malicious content and has been blocked. This incident has been logged.',
    });
  }

  next();
}

module.exports = sqlInjectionDetector;
module.exports.registerAdminClient = registerAdminClient;