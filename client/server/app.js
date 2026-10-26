import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDatabase, default as db } from './db.js';
import { syncDatabase } from './supabaseSync.js';

import employeesRouter from './routes/employees.js';
import attendanceRouter from './routes/attendance.js';
import expensesRouter from './routes/expenses.js';
import loansRouter from './routes/loans.js';
import leavesRouter from './routes/leaves.js';
import payrollRouter from './routes/payroll.js';
import portalRouter from './routes/portal.js';
import requestsRouter from './routes/requests.js';
import biometricRouter from './routes/biometric.js';
import holidaysRouter from './routes/holidays.js';
import treasuryRouter from './routes/treasury.js';
import systemRouter from './routes/system.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB schema & seed data
try {
  initDatabase();
} catch (e) {
  console.warn('initDatabase notice:', e.message);
}

let lastAttendancePull = 0;
export async function ensureAttendanceFresh() {
  if (!process.env.VERCEL) return;
  const now = Date.now();
  if (now - lastAttendancePull > 20000) { // 20s TTL
    lastAttendancePull = now;
    try {
      const { pullFreshAttendance } = await import('./supabaseSync.js');
      await pullFreshAttendance(db);
    } catch (e) {
      console.warn('Auto pullFreshAttendance warning:', e.message);
    }
  }
}

const app = express();

// Prevent socket or ZKTeco communication timeouts from taking down the Node process
process.on('uncaughtException', (err) => {
  console.error('[System Safe Guard] Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[System Safe Guard] Unhandled Rejection:', reason?.message || reason);
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static uploads directory (e.g. for receipt photos, documents)
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (e) {}
}
const treasuryUploadsDir = path.join(uploadsDir, 'treasury');
if (!fs.existsSync(treasuryUploadsDir)) {
  try { fs.mkdirSync(treasuryUploadsDir, { recursive: true }); } catch (e) {}
}
app.use('/uploads', express.static(uploadsDir));

// API Routes (Mounted under both /api/* and /* for full compatibility with Vercel serverless rewrites)
const routes = [
  ['/employees', employeesRouter],
  ['/attendance', attendanceRouter],
  ['/expenses', expensesRouter],
  ['/loans', loansRouter],
  ['/leaves', leavesRouter],
  ['/payroll', payrollRouter],
  ['/portal', portalRouter],
  ['/requests', requestsRouter],
  ['/biometric', biometricRouter],
  ['/holidays', holidaysRouter],
  ['/treasury', treasuryRouter],
  ['/system', systemRouter]
];

for (const [subPath, router] of routes) {
  app.use([`/api${subPath}`, subPath], router);
}

// Quick health check
app.get(['/api/health', '/health'], (req, res) => {
  res.json({
    status: 'online',
    appName: 'نظام إدارة المرتبات وشؤون العاملين | Payroll ERP',
    time: new Date().toISOString()
  });
});

// Manual sync trigger (Push from SQLite to Supabase)
app.post(['/api/sync/trigger', '/sync/trigger'], async (req, res) => {
  try {
    const result = await syncDatabase(db);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual sync pull endpoint (from Supabase to SQLite)
app.all(['/api/sync/pull', '/sync/pull'], async (req, res) => {
  try {
    const isFull = req.query.full === 'true';
    const { pullFromSupabase, pullFreshAttendance } = await import('./supabaseSync.js');
    const result = isFull ? await pullFromSupabase(db) : await pullFreshAttendance(db);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend build if present
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  }));

  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.sendFile(path.join(clientDist, 'index.html'));
    }
    next();
  });
}

export default app;
