import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let firestore = null;
let isInitialized = false;

// Initialize Firebase Admin SDK
function initFirebaseAdmin() {
  if (isInitialized && firestore) return firestore;

  try {
    // 1. Check for serviceAccountKey.json in project root or server folder
    const rootKeyPath = path.resolve(__dirname, '..', 'serviceAccountKey.json');
    const serverKeyPath = path.resolve(__dirname, 'serviceAccountKey.json');
    const customKeyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH 
      ? path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH) 
      : null;

    let certData = null;

    if (customKeyPath && fs.existsSync(customKeyPath)) {
      certData = JSON.parse(fs.readFileSync(customKeyPath, 'utf8'));
    } else if (fs.existsSync(rootKeyPath)) {
      certData = JSON.parse(fs.readFileSync(rootKeyPath, 'utf8'));
    } else if (fs.existsSync(serverKeyPath)) {
      certData = JSON.parse(fs.readFileSync(serverKeyPath, 'utf8'));
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      certData = typeof process.env.FIREBASE_SERVICE_ACCOUNT === 'string'
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : process.env.FIREBASE_SERVICE_ACCOUNT;
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
      certData = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8'));
    }

    if (certData) {
      if (getApps().length === 0) {
        initializeApp({
          credential: cert(certData),
          projectId: certData.project_id || process.env.FIREBASE_PROJECT_ID || 'company-payroll-erp-2026'
        });
      }
      firestore = getFirestore();
      isInitialized = true;
      console.log(`🔥 [Firestore Sync]: Initialized successfully with project [${certData.project_id || 'company-payroll-erp-2026'}]`);
      return firestore;
    }

    // 2. Fallback to GCP default credentials ONLY if running in Google Cloud
    if (process.env.K_SERVICE || process.env.FUNCTION_NAME || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const projectId = process.env.FIREBASE_PROJECT_ID || 'company-payroll-erp-2026';
      if (getApps().length === 0) {
        initializeApp({ projectId });
      }
      firestore = getFirestore();
      isInitialized = true;
      return firestore;
    }

    firestore = null;
    isInitialized = false;
    return null;
  } catch (err) {
    console.warn(`⚠️ [Firestore Sync Init Notice]: ${err.message}`);
    console.warn('👉 لتفعيل المزامنة السحابية مع Firebase Firestore، يرجى وضع ملف serviceAccountKey.json في مجلد المشروع.');
    firestore = null;
    isInitialized = false;
    return null;
  }
}

// Ensure firestore is initialized
initFirebaseAdmin();

// In-memory cache shield timestamp map
export const tableLastPull = new Map();

export function invalidateTableCache(table) {
  tableLastPull.delete(table);
}

/**
 * Returns a stable, deterministic Document ID for a record in a collection
 */
export function getDocId(collection, item) {
  if (!item) return null;
  if (collection === 'attendance') return `${item.employee_code}_${item.date}`;
  if (collection === 'employees') return String(item.code || item.id);
  if (collection === 'official_holidays') return String(item.holiday_date);
  if (collection === 'payroll_runs') return `${item.year}_${item.month}`;
  if (collection === 'payroll_items') return `${item.payroll_run_id}_${item.employee_id}`;
  if (collection === 'mid_month_expenses') return `${item.year}_${item.month}_${item.employee_id}`;
  if (collection === 'treasury_parties' && item.name) return String(item.name);
  return String(item.id || Date.now());
}

/**
 * Clean data object for Firestore (sanitize undefined and dates)
 */
function sanitizeData(obj) {
  const sanitized = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) {
      sanitized[k] = null;
    } else if (v instanceof Date) {
      sanitized[k] = v.toISOString();
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

/**
 * Push an inserted or updated record directly to Firestore in real-time
 */
export async function pushToFirestore(collection, row) {
  const db = initFirebaseAdmin();
  if (!db || !row || typeof row !== 'object') return false;

  const docId = getDocId(collection, row);
  if (!docId) return false;

  try {
    const data = sanitizeData({ ...row, updated_at: new Date().toISOString() });
    await db.collection(collection).doc(docId).set(data, { merge: true });
    tableLastPull.set(collection, Date.now());
    console.log(`⚡ [Firestore Realtime]: Synced [${collection}] ID=${docId}`);
    return true;
  } catch (err) {
    console.error(`⚠️ [Firestore Push Error in ${collection}]:`, err.message);
    tableLastPull.set(collection, Date.now());
    return false;
  }
}

// Aliases for compatibility with route files
export const pushToSupabase = pushToFirestore;

/**
 * Multi-row batch upsert into Firestore (chunks of 450 to respect 500-op limit)
 */
export async function pushBatchToFirestore(collection, rows) {
  const db = initFirebaseAdmin();
  if (!db || !Array.isArray(rows) || rows.length === 0) return false;

  try {
    const BATCH_SIZE = 450;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      const batch = db.batch();

      for (const item of chunk) {
        const docId = getDocId(collection, item);
        if (!docId) continue;
        const ref = db.collection(collection).doc(docId);
        batch.set(ref, sanitizeData({ ...item, updated_at: new Date().toISOString() }), { merge: true });
      }

      await batch.commit();
    }

    tableLastPull.set(collection, Date.now());
    console.log(`⚡ [Firestore Batch]: Synced ${rows.length} rows to [${collection}]`);
    return true;
  } catch (err) {
    console.error(`⚠️ [Firestore Batch Error in ${collection}]:`, err.message);
    tableLastPull.set(collection, Date.now());
    return false;
  }
}

export const pushBatchToSupabase = pushBatchToFirestore;

/**
 * Delete a record from Firestore
 */
export async function deleteFromFirestore(collection, idOrCondition) {
  const db = initFirebaseAdmin();
  if (!db || !idOrCondition) return false;

  try {
    if (typeof idOrCondition === 'object') {
      const docId = getDocId(collection, idOrCondition);
      if (docId) {
        await db.collection(collection).doc(docId).delete();
      } else {
        // Query by condition
        let query = db.collection(collection);
        for (const [k, v] of Object.entries(idOrCondition)) {
          query = query.where(k, '==', v);
        }
        const snap = await query.get();
        const batch = db.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
    } else {
      await db.collection(collection).doc(String(idOrCondition)).delete();
    }

    tableLastPull.set(collection, Date.now());
    console.log(`🗑️ [Firestore Realtime]: Deleted from [${collection}]`);
    return true;
  } catch (err) {
    console.error(`⚠️ [Firestore Delete Error in ${collection}]:`, err.message);
    return false;
  }
}

export const deleteFromSupabase = deleteFromFirestore;

/**
 * Pull collections from Firestore into local SQLite
 */
export async function pullFromFirestore(sqliteDb, collectionList = null) {
  const db = initFirebaseAdmin();
  if (!db) return { success: false, reason: 'Firestore not initialized' };

  const ALL_COLLECTIONS = [
    'treasury_parties',
    'cash_safes',
    'employees',
    'official_holidays',
    'biometric_devices',
    'loans',
    'leaves',
    'attendance',
    'mid_month_expenses',
    'employee_requests',
    'payroll_runs',
    'payroll_items',
    'salary_history',
    'cash_transactions',
    'cash_trusts',
    'cash_denominations'
  ];

  const collections = collectionList || ALL_COLLECTIONS;

  try {
    for (const col of collections) {
      try {
        const snap = await db.collection(col).get();
        if (snap.empty) continue;

        const docs = [];
        snap.forEach(doc => docs.push(doc.data()));

        if (docs.length === 0) continue;

        // Clean out updated_at before SQLite insertion
        const sample = docs[0];
        const validCols = Object.keys(sample).filter(c => c !== 'updated_at');

        if (col === 'attendance') {
          // Exclude id to prevent local ID clashes
          const cols = validCols.filter(c => c !== 'id');
          const colList = cols.map(c => `"${c}"`).join(', ');
          const placeholders = cols.map(() => '?').join(', ');
          const updateCols = cols.filter(c => c !== 'employee_code' && c !== 'date');
          const updateSet = updateCols.map(c => {
            if (c === 'check_in') {
              return `"check_in" = CASE WHEN excluded."check_in" IS NOT NULL AND excluded."check_in" != '' THEN excluded."check_in" ELSE attendance."check_in" END`;
            }
            if (c === 'check_out') {
              return `"check_out" = CASE WHEN excluded."check_out" IS NOT NULL AND excluded."check_out" != '' THEN excluded."check_out" ELSE attendance."check_out" END`;
            }
            if (c === 'status') {
              return `"status" = CASE WHEN attendance."check_in" IS NOT NULL AND attendance."check_in" != '' AND (excluded."status" = 'بدون بصمة (غير مسجل)' OR excluded."status" = 'غائب') THEN attendance."status" ELSE excluded."status" END`;
            }
            if (c === 'is_absent') {
              return `"is_absent" = CASE WHEN attendance."check_in" IS NOT NULL AND attendance."check_in" != '' THEN 0 ELSE excluded."is_absent" END`;
            }
            return `"${c}" = excluded."${c}"`;
          }).join(', ');

          const stmt = sqliteDb.prepare(`
            INSERT INTO attendance (${colList}) VALUES (${placeholders})
            ON CONFLICT(employee_code, date) DO UPDATE SET ${updateSet}
          `);

          sqliteDb.transaction(() => {
            for (const doc of docs) {
              const values = cols.map(c => {
                const val = doc[c];
                if (val === undefined || val === null) return null;
                if (typeof val === 'boolean') return val ? 1 : 0;
                return val;
              });
              stmt.run(...values);
            }
          })();
        } else if (col === 'mid_month_expenses') {
          const cols = validCols.filter(c => c !== 'id');
          const colList = cols.map(c => `"${c}"`).join(', ');
          const placeholders = cols.map(() => '?').join(', ');
          const stmt = sqliteDb.prepare(`
            INSERT INTO mid_month_expenses (${colList}) VALUES (${placeholders})
            ON CONFLICT(year, month, employee_id) DO UPDATE SET
              amount_day_10 = excluded.amount_day_10,
              amount_day_20 = excluded.amount_day_20,
              total_amount = excluded.total_amount,
              notes = excluded.notes
          `);

          sqliteDb.transaction(() => {
            for (const doc of docs) {
              const values = cols.map(c => {
                const val = doc[c];
                if (val === undefined || val === null) return null;
                if (typeof val === 'boolean') return val ? 1 : 0;
                return val;
              });
              try { stmt.run(...values); } catch (e) {}
            }
          })();
        } else {
          const colList = validCols.map(c => `"${c}"`).join(', ');
          const placeholders = validCols.map(() => '?').join(', ');
          const stmt = sqliteDb.prepare(`INSERT OR REPLACE INTO "${col}" (${colList}) VALUES (${placeholders})`);

          sqliteDb.transaction(() => {
            for (const doc of docs) {
              const values = validCols.map(c => {
                const val = doc[c];
                if (val === undefined || val === null) return null;
                if (typeof val === 'boolean') return val ? 1 : 0;
                return val;
              });
              try {
                stmt.run(...values);
              } catch (rowErr) {}
            }
          })();
        }
      } catch (colErr) {
        console.warn(`[pullFromFirestore] Warning on collection [${col}]:`, colErr.message);
      }
    }

    console.log('✅ [Firestore Sync]: Pulled remote data into SQLite successfully');
    return { success: true };
  } catch (err) {
    console.error('⚠️ [Firestore Pull Error]:', err.message);
    return { success: false, error: err.message };
  }
}

export const pullFromSupabase = pullFromFirestore;

/**
 * Pull fresh attendance records for recent days without deleting local data
 */
export async function pullFreshAttendanceFromFirestore(sqliteDb) {
  const db = initFirebaseAdmin();
  if (!db) return { success: false, reason: 'Firestore not initialized' };

  try {
    const cutoffDate = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const snap = await db.collection('attendance').where('date', '>=', cutoffDate).get();

    if (!snap.empty) {
      const docs = [];
      snap.forEach(doc => docs.push(doc.data()));

      if (docs.length > 0) {
        const cols = Object.keys(docs[0]).filter(c => c !== 'id' && c !== 'updated_at');
        const colList = cols.map(c => `"${c}"`).join(', ');
        const placeholders = cols.map(() => '?').join(', ');
        const updateCols = cols.filter(c => c !== 'employee_code' && c !== 'date');
        const updateSet = updateCols.map(c => {
          if (c === 'check_in') {
            return `"check_in" = CASE WHEN excluded."check_in" IS NOT NULL AND excluded."check_in" != '' THEN excluded."check_in" ELSE attendance."check_in" END`;
          }
          if (c === 'check_out') {
            return `"check_out" = CASE WHEN excluded."check_out" IS NOT NULL AND excluded."check_out" != '' THEN excluded."check_out" ELSE attendance."check_out" END`;
          }
          if (c === 'status') {
            return `"status" = CASE WHEN attendance."check_in" IS NOT NULL AND attendance."check_in" != '' AND (excluded."status" = 'بدون بصمة (غير مسجل)' OR excluded."status" = 'غائب') THEN attendance."status" ELSE excluded."status" END`;
          }
          if (c === 'is_absent') {
            return `"is_absent" = CASE WHEN attendance."check_in" IS NOT NULL AND attendance."check_in" != '' THEN 0 ELSE excluded."is_absent" END`;
          }
          return `"${c}" = excluded."${c}"`;
        }).join(', ');

        const stmt = sqliteDb.prepare(`
          INSERT INTO attendance (${colList}) VALUES (${placeholders})
          ON CONFLICT(employee_code, date) DO UPDATE SET ${updateSet}
        `);

        sqliteDb.transaction(() => {
          for (const doc of docs) {
            const values = cols.map(c => {
              const val = doc[c];
              if (val === undefined || val === null) return null;
              if (typeof val === 'boolean') return val ? 1 : 0;
              return val;
            });
            stmt.run(...values);
          }
        })();
        console.log(`⚡ [Firestore Fresh Pull]: Synchronized ${docs.length} attendance records`);
      }
    }
    return { success: true, count: snap.size };
  } catch (err) {
    console.error('⚠️ [pullFreshAttendanceFromFirestore Error]:', err.message);
    return { success: false, error: err.message };
  }
}

export const pullFreshAttendance = pullFreshAttendanceFromFirestore;

/**
 * Full table sync from local SQLite to Firestore
 */
export async function syncDatabaseToFirestore(sqliteDb) {
  const db = initFirebaseAdmin();
  if (!db) return { success: false, reason: 'Firestore not initialized' };

  const startTime = Date.now();
  const TABLES = [
    'treasury_parties',
    'cash_safes',
    'employees',
    'official_holidays',
    'biometric_devices',
    'loans',
    'leaves',
    'attendance',
    'mid_month_expenses',
    'employee_requests',
    'payroll_runs',
    'payroll_items',
    'salary_history',
    'cash_transactions',
    'cash_trusts',
    'cash_denominations'
  ];

  try {
    for (const table of TABLES) {
      let rows = [];
      try {
        rows = sqliteDb.prepare(`SELECT * FROM ${table}`).all();
      } catch (e) {
        continue;
      }

      if (rows.length === 0) continue;
      await pushBatchToFirestore(table, rows);
    }

    const elapsed = Date.now() - startTime;
    return { success: true, elapsedMs: elapsed };
  } catch (err) {
    console.error('⚠️ [Firestore Full Sync Error]:', err.message);
    return { success: false, error: err.message };
  }
}

export const syncDatabase = syncDatabaseToFirestore;

/**
 * Background auto-sync engine with Firestore
 */
export function startAutoSyncFirestore(sqliteDb, intervalSeconds = 30) {
  const db = initFirebaseAdmin();
  if (!db) return;

  console.log(`⚡ Firebase Firestore Live Auto-Sync engine initialized`);

  setTimeout(() => {
    syncDatabaseToFirestore(sqliteDb).then(res => {
      if (res.success) {
        console.log(`✅ [Firestore Initial Sync]: All collections aligned in ${res.elapsedMs}ms`);
      }
    });
  }, 2000);

  setInterval(() => {
    syncDatabaseToFirestore(sqliteDb);
  }, intervalSeconds * 1000);
}

export const startAutoSync = startAutoSyncFirestore;

/**
 * Ensures table freshness on cloud serverless (Vercel)
 */
export async function ensureTableFresh(sqliteDb, tableName, ttlMs = 15000) {
  if (!process.env.VERCEL) return;
  const now = Date.now();
  const lastPull = tableLastPull.get(tableName) || 0;
  if (now - lastPull > ttlMs) {
    tableLastPull.set(tableName, now);
    try {
      if (tableName === 'attendance') {
        await pullFreshAttendanceFromFirestore(sqliteDb);
      } else {
        await pullFromFirestore(sqliteDb, [tableName]);
      }
    } catch (e) {}
  }
}

export async function ensureRouteTablesFresh(sqliteDb, reqPath) {
  if (!process.env.VERCEL || !reqPath) return;
  const p = reqPath.toLowerCase();

  const tablesToSync = new Set();
  if (p.includes('employee')) tablesToSync.add('employees');
  if (p.includes('attendance')) {
    tablesToSync.add('attendance');
    tablesToSync.add('employees');
    tablesToSync.add('official_holidays');
    tablesToSync.add('leaves');
  }
  if (p.includes('leave')) {
    tablesToSync.add('leaves');
    tablesToSync.add('employees');
  }
  if (p.includes('loan')) {
    tablesToSync.add('loans');
    tablesToSync.add('employees');
  }
  if (p.includes('expense')) {
    tablesToSync.add('mid_month_expenses');
    tablesToSync.add('employees');
  }
  if (p.includes('treasury')) {
    tablesToSync.add('cash_safes');
    tablesToSync.add('cash_trusts');
    tablesToSync.add('cash_transactions');
    tablesToSync.add('treasury_parties');
    tablesToSync.add('employees');
  }
  if (p.includes('holiday')) tablesToSync.add('official_holidays');
  if (p.includes('request')) {
    tablesToSync.add('employee_requests');
    tablesToSync.add('employees');
  }
  if (p.includes('biometric')) tablesToSync.add('biometric_devices');
  if (p.includes('payroll')) {
    tablesToSync.add('payroll_runs');
    tablesToSync.add('payroll_items');
    tablesToSync.add('employees');
  }

  for (const t of tablesToSync) {
    await ensureTableFresh(sqliteDb, t, 15000);
  }
}

let lastDataPull = 0;
export async function ensureFreshData(sqliteDb, force = false) {
  if (!process.env.VERCEL && !force) return { success: true, skipped: true };
  const now = Date.now();
  if (now - lastDataPull > 20000 || force) {
    lastDataPull = now;
    try {
      await pullFromFirestore(sqliteDb, [
        'employees',
        'biometric_devices',
        'official_holidays',
        'loans',
        'leaves',
        'mid_month_expenses',
        'employee_requests'
      ]);
      await pullFreshAttendanceFromFirestore(sqliteDb);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: true, cached: true };
}

export async function getLiveSyncStatus(sqliteDb) {
  const db = initFirebaseAdmin();
  if (!db) return { connected: false, error: 'Firestore not configured' };

  try {
    const tables = ['treasury_parties', 'cash_safes', 'cash_transactions', 'employees', 'attendance'];
    const comparison = [];

    for (const t of tables) {
      let localCount = 0;
      try {
        localCount = sqliteDb.prepare(`SELECT COUNT(*) as c FROM ${t}`).get().c;
      } catch (e) {}

      let remoteCount = 0;
      try {
        const snap = await db.collection(t).count().get();
        remoteCount = snap.data().count;
      } catch (e) {}

      comparison.push({
        table: t,
        localCount,
        remoteCount,
        synced: localCount === remoteCount
      });
    }

    return {
      connected: true,
      lastCheck: new Date().toISOString(),
      comparison
    };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}
