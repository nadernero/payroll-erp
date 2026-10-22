import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDatabase, default as db } from './db.js';
import { startAutoSync, syncDatabase } from './supabaseSync.js';

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
import systemRouter, { getNetworkAddresses } from './routes/system.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB schema & seed data
initDatabase();

const app = express();
const PORT = process.env.PORT || 5000;

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
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const treasuryUploadsDir = path.join(uploadsDir, 'treasury');
if (!fs.existsSync(treasuryUploadsDir)) {
  fs.mkdirSync(treasuryUploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api/employees', employeesRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/loans', loansRouter);
app.use('/api/leaves', leavesRouter);
app.use('/api/payroll', payrollRouter);
app.use('/api/portal', portalRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/biometric', biometricRouter);
app.use('/api/holidays', holidaysRouter);
app.use('/api/treasury', treasuryRouter);
app.use('/api/system', systemRouter);

// Quick health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    appName: 'نظام إدارة المرتبات وشؤون العاملين | Payroll ERP',
    time: new Date().toISOString()
  });
});

// Manual sync trigger
app.post('/api/sync/trigger', async (req, res) => {
  try {
    const result = await syncDatabase(db);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend build if present
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  // Static files with strict no-cache for HTML
  app.use(express.static(clientDist, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  }));

  // SPA fallback with no-cache to force browsers to always fetch latest version
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

app.listen(PORT, '0.0.0.0', () => {
  const lanAddresses = getNetworkAddresses(PORT);
  console.log(`=======================================================`);
  console.log(`🚀 Payroll ERP Server is running on:`);
  console.log(`👉 Local:   http://localhost:${PORT}`);
  lanAddresses.forEach(addr => {
    console.log(`👉 Network (${addr.interface}): ${addr.url}`);
  });
  console.log(`=======================================================`);

  // Start background live two-way sync with Supabase
  startAutoSync(db, 15);
});
