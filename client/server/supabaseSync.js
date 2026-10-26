import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_SUPABASE_URL = 'postgresql://postgres.pnvsmqihnrrowfqlkqjo:Id%4022031981%402203@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true';
// Prioritize DATABASE_URL (Transaction Pooler port 6543) which works instantly in serverless
const dbUrl = process.env.DATABASE_URL || DEFAULT_SUPABASE_URL;

let pool = null;
if (dbUrl) {
  const { Pool } = pg;
  pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 3000,
    connectionTimeoutMillis: 8000
  });
}

/**
 * Push an inserted or updated record directly to Supabase in real-time
 */
export async function pushToSupabase(table, row) {
  if (!pool || !row || typeof row !== 'object') return false;

  const targetRow = { ...row };

  // Resolve remote ID if a natural unique key exists to avoid unique constraint collisions
  try {
    if (table === 'attendance' && targetRow.employee_code && targetRow.date) {
      const res = await pool.query('SELECT id FROM "attendance" WHERE employee_code = $1 AND date = $2', [targetRow.employee_code, targetRow.date]);
      if (res.rows.length > 0) targetRow.id = res.rows[0].id;
    } else if (table === 'employees' && targetRow.code) {
      const res = await pool.query('SELECT id FROM "employees" WHERE code = $1', [targetRow.code]);
      if (res.rows.length > 0) {
        targetRow.id = res.rows[0].id;
      } else if (targetRow.id) {
        const idCheck = await pool.query('SELECT id FROM "employees" WHERE id = $1', [targetRow.id]);
        if (idCheck.rows.length > 0) {
          delete targetRow.id;
        }
      }
    } else if (table === 'loans' && targetRow.id) {
      const res = await pool.query('SELECT id FROM "loans" WHERE id = $1', [targetRow.id]);
      if (res.rows.length > 0 && targetRow.employee_id) {
        // If row with this ID exists but belongs to another employee, omit ID to avoid collision
        const cur = await pool.query('SELECT id FROM "loans" WHERE id = $1 AND employee_id = $2', [targetRow.id, targetRow.employee_id]);
        if (cur.rows.length === 0) delete targetRow.id;
      }
    } else if (table === 'official_holidays' && targetRow.holiday_date) {
      const res = await pool.query('SELECT id FROM "official_holidays" WHERE holiday_date = $1', [targetRow.holiday_date]);
      if (res.rows.length > 0) targetRow.id = res.rows[0].id;
    } else if (table === 'payroll_runs' && targetRow.year && targetRow.month) {
      const res = await pool.query('SELECT id FROM "payroll_runs" WHERE year = $1 AND month = $2', [targetRow.year, targetRow.month]);
      if (res.rows.length > 0) targetRow.id = res.rows[0].id;
    } else if (table === 'mid_month_expenses' && targetRow.year && targetRow.month && targetRow.employee_id) {
      delete targetRow.id;
    } else if (table === 'payroll_items') {
      delete targetRow.id;
    }
  } catch (lookupErr) {}

  let conflictTarget = '(id)';
  let conflictCols = ['id'];
  if (table === 'attendance') {
    conflictTarget = '("employee_code", "date")';
    conflictCols = ['employee_code', 'date'];
  } else if (table === 'employees') {
    conflictTarget = '("code")';
    conflictCols = ['code'];
  } else if (table === 'official_holidays') {
    conflictTarget = '("holiday_date")';
    conflictCols = ['holiday_date'];
  } else if (table === 'payroll_runs') {
    conflictTarget = '("year", "month")';
    conflictCols = ['year', 'month'];
  } else if (table === 'payroll_items') {
    conflictTarget = '("payroll_run_id", "employee_id")';
    conflictCols = ['payroll_run_id', 'employee_id'];
  } else if (table === 'mid_month_expenses') {
    conflictTarget = '("year", "month", "employee_id")';
    conflictCols = ['year', 'month', 'employee_id'];
  } else if (table === 'treasury_parties') {
    conflictTarget = '("name")';
    conflictCols = ['name'];
  }

  const cols = Object.keys(targetRow);
  if (cols.length === 0) return false;

  const colList = cols.map(c => `"${c}"`).join(', ');
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const updateList = cols.filter(c => !conflictCols.includes(c) && c !== 'id').map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');
  const values = cols.map(c => targetRow[c]);

  const query = updateList.length > 0
    ? `
      INSERT INTO "${table}" (${colList})
      VALUES (${placeholders})
      ON CONFLICT ${conflictTarget} DO UPDATE SET ${updateList}
    `
    : `
      INSERT INTO "${table}" (${colList})
      VALUES (${placeholders})
      ON CONFLICT ${conflictTarget} DO NOTHING
    `;

  try {
    await pool.query(query, values);
    invalidateTableCache(table);
    console.log(`⚡ [Supabase Realtime]: Synced [${table}] ID=${targetRow.id || targetRow.code || targetRow.date}`);
    return true;
  } catch (err) {
    console.error(`⚠️ [Supabase Realtime Push Error in ${table}]:`, err.message);
    return false;
  }
}

/**
 * Fast multi-row batch upsert into Supabase (under 200ms for 50-100 items)
 */
export async function pushBatchToSupabase(table, rows) {
  if (!pool || !Array.isArray(rows) || rows.length === 0) return false;

  let conflictTarget = '(id)';
  let conflictCols = ['id'];
  if (table === 'attendance') {
    conflictTarget = '("employee_code", "date")';
    conflictCols = ['employee_code', 'date'];
  } else if (table === 'employees') {
    conflictTarget = '("code")';
    conflictCols = ['code'];
  } else if (table === 'official_holidays') {
    conflictTarget = '("holiday_date")';
    conflictCols = ['holiday_date'];
  } else if (table === 'payroll_runs') {
    conflictTarget = '("year", "month")';
    conflictCols = ['year', 'month'];
  } else if (table === 'payroll_items') {
    conflictTarget = '("payroll_run_id", "employee_id")';
    conflictCols = ['payroll_run_id', 'employee_id'];
  } else if (table === 'mid_month_expenses') {
    conflictTarget = '("year", "month", "employee_id")';
    conflictCols = ['year', 'month', 'employee_id'];
  } else if (table === 'treasury_parties') {
    conflictTarget = '("name")';
    conflictCols = ['name'];
  }

  // Filter columns (omit id for payroll_items and mid_month_expenses so serial sequence/remote id isn't conflicted)
  const sampleRow = rows[0];
  let cols = Object.keys(sampleRow);
  if (table === 'payroll_items' || table === 'mid_month_expenses') {
    cols = cols.filter(c => c !== 'id');
  }

  const colList = cols.map(c => `"${c}"`).join(', ');
  const updateCols = cols.filter(c => !conflictCols.includes(c) && c !== 'id');
  const updateList = updateCols.map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');

  const BATCH_SIZE = 50;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const valueClauses = [];
    const values = [];
    let pIdx = 1;

    for (const r of chunk) {
      const placeholders = cols.map(() => `$${pIdx++}`).join(', ');
      valueClauses.push(`(${placeholders})`);
      cols.forEach(c => values.push(r[c] !== undefined ? r[c] : null));
    }

    const query = updateList.length > 0
      ? `
        INSERT INTO "${table}" (${colList})
        VALUES ${valueClauses.join(', ')}
        ON CONFLICT ${conflictTarget} DO UPDATE SET ${updateList}
      `
      : `
        INSERT INTO "${table}" (${colList})
        VALUES ${valueClauses.join(', ')}
        ON CONFLICT ${conflictTarget} DO NOTHING
      `;

    try {
      await pool.query(query, values);
    } catch (err) {
      console.error(`⚠️ [Supabase Realtime Batch Error in ${table}]:`, err.message);
      return false;
    }
  }

  invalidateTableCache(table);
  console.log(`⚡ [Supabase Realtime Batch]: Synced ${rows.length} rows to [${table}]`);
  return true;
}

/**
 * Delete a record from Supabase immediately in real-time
 */
export async function deleteFromSupabase(table, idOrCondition) {
  if (!pool || !idOrCondition) return false;

  try {
    if (typeof idOrCondition === 'object') {
      const keys = Object.keys(idOrCondition);
      const whereClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(' AND ');
      const values = keys.map(k => idOrCondition[k]);
      await pool.query(`DELETE FROM "${table}" WHERE ${whereClause}`, values);
    } else {
      await pool.query(`DELETE FROM "${table}" WHERE id = $1`, [idOrCondition]);
    }
    invalidateTableCache(table);
    console.log(`🗑️ [Supabase Realtime]: Deleted from [${table}]`);
    return true;
  } catch (err) {
    console.error(`⚠️ [Supabase Realtime Delete Error in ${table}]:`, err.message);
    return false;
  }
}

const tableLastPull = new Map();

export function invalidateTableCache(table) {
  if (table) {
    tableLastPull.delete(table);
  } else {
    tableLastPull.clear();
  }
}

/**
 * Pull all data from Supabase into local SQLite with true 2-way sync (including deletions)
 */
export async function pullFromSupabase(sqliteDb, tableList = null) {
  if (!pool) return { success: false, reason: 'No DB pool' };
  try {
    const client = await pool.connect();
    const TABLES = tableList || [
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

    for (const table of TABLES) {
      try {
        const res = await client.query(`SELECT * FROM "${table}"`);
        
        // 1. If remote table is empty, clear local SQLite table
        if (!res.rows || res.rows.length === 0) {
          if (table !== 'attendance') {
            try { sqliteDb.prepare(`DELETE FROM "${table}"`).run(); } catch (e) {}
          }
          continue;
        }

        // 2. Delete rows in local SQLite that do NOT exist in Supabase (deletions sync)
        if (table !== 'attendance') {
          const remoteIds = new Set(res.rows.map(r => r.id));
          try {
            const localRows = sqliteDb.prepare(`SELECT id FROM "${table}"`).all();
            sqliteDb.transaction(() => {
              for (const lr of localRows) {
                if (!remoteIds.has(lr.id)) {
                  sqliteDb.prepare(`DELETE FROM "${table}" WHERE id = ?`).run(lr.id);
                }
              }
            })();
          } catch (delErr) {}
        }

        // 3. Insert or update all rows from Supabase into local SQLite
        const cols = Object.keys(res.rows[0]);
        const colList = cols.map(c => `"${c}"`).join(', ');
        const placeholders = cols.map(() => '?').join(', ');
        const stmt = sqliteDb.prepare(`INSERT OR REPLACE INTO "${table}" (${colList}) VALUES (${placeholders})`);

        sqliteDb.transaction(() => {
          for (const row of res.rows) {
            const values = cols.map(c => {
              const val = row[c];
              if (val === undefined || val === null) return null;
              if (typeof val === 'boolean') return val ? 1 : 0;
              if (val instanceof Date) return val.toISOString();
              return val;
            });
            stmt.run(...values);
          }
        })();
      } catch (e) {
        console.warn(`[pullFromSupabase] Table ${table} sync warning:`, e.message);
      }
    }
    client.release();
    console.log('✅ [Supabase Sync]: Pulled remote data into SQLite successfully');
    return { success: true };
  } catch (err) {
    console.error('⚠️ [Supabase Pull Error]:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Fast pull for recent / updated attendance from Supabase (under 500ms) with deletion sync
 */
export async function pullFreshAttendance(sqliteDb) {
  if (!pool) return { success: false, reason: 'No DB pool' };
  try {
    const client = await pool.connect();
    // Pull any attendance records from the last 45 days
    const cutoffDate = new Date(Date.now() - 45 * 86400000).toISOString().split('T')[0];
    const res = await client.query('SELECT * FROM "attendance" WHERE date >= $1', [cutoffDate]);

    if (res.rows) {
      // 1. Delete local attendance records in range that no longer exist in Supabase
      const remoteKeys = new Set(res.rows.map(r => `${r.employee_code}_${r.date}`));
      try {
        const localAtt = sqliteDb.prepare('SELECT id, employee_code, date FROM attendance WHERE date >= ?').all(cutoffDate);
        sqliteDb.transaction(() => {
          for (const la of localAtt) {
            if (!remoteKeys.has(`${la.employee_code}_${la.date}`)) {
              sqliteDb.prepare('DELETE FROM attendance WHERE id = ?').run(la.id);
            }
          }
        })();
      } catch (attDelErr) {}

      // 2. Insert or replace remote attendance
      if (res.rows.length > 0) {
        const cols = Object.keys(res.rows[0]);
        const colList = cols.map(c => `"${c}"`).join(', ');
        const placeholders = cols.map(() => '?').join(', ');
        const stmt = sqliteDb.prepare(`INSERT OR REPLACE INTO attendance (${colList}) VALUES (${placeholders})`);

        sqliteDb.transaction(() => {
          for (const row of res.rows) {
            const values = cols.map(c => {
              const val = row[c];
              if (val === undefined || val === null) return null;
              if (typeof val === 'boolean') return val ? 1 : 0;
              if (val instanceof Date) return val.toISOString();
              return val;
            });
            stmt.run(...values);
          }
        })();
        console.log(`⚡ [Supabase Fresh Pull]: Synchronized ${res.rows.length} attendance records`);
      }
    }
    client.release();
    return { success: true, count: res.rows?.length || 0 };
  } catch (err) {
    console.error('⚠️ [pullFreshAttendance Error]:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Ensures a single table is freshly synchronized with a 15-second TTL cache
 */
export async function ensureTableFresh(sqliteDb, tableName, ttlMs = 15000) {
  if (!process.env.VERCEL) return;
  const now = Date.now();
  const lastPull = tableLastPull.get(tableName) || 0;
  if (now - lastPull > ttlMs) {
    tableLastPull.set(tableName, now);
    try {
      if (tableName === 'attendance') {
        await pullFreshAttendance(sqliteDb);
      } else {
        await pullFromSupabase(sqliteDb, [tableName]);
      }
    } catch (e) {
      console.warn(`[ensureTableFresh] Warning syncing ${tableName}:`, e.message);
    }
  }
}

/**
 * Auto-syncs all relevant tables for the incoming route path on Vercel
 */
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
/**
 * Ensures all core operational tables are synchronized from Supabase on Vercel
 */
export async function ensureFreshData(sqliteDb, force = false) {
  if (!process.env.VERCEL && !force) return { success: true, skipped: true };
  const now = Date.now();
  if (now - lastDataPull > 20000 || force) { // 20s TTL
    lastDataPull = now;
    try {
      // 1. Pull core metadata tables
      await pullFromSupabase(sqliteDb, [
        'employees',
        'biometric_devices',
        'official_holidays',
        'loans',
        'leaves',
        'mid_month_expenses',
        'employee_requests'
      ]);
      // 2. Pull fresh attendance for last 45 days
      await pullFreshAttendance(sqliteDb);
      return { success: true };
    } catch (e) {
      console.warn('⚠️ ensureFreshData warning:', e.message);
      return { success: false, error: e.message };
    }
  }
  return { success: true, cached: true };
}

/**
 * Full table sync from local SQLite to Supabase
 */
export async function syncDatabase(sqliteDb) {
  if (!pool) return { success: false, reason: 'No DB URL' };

  const startTime = Date.now();
  let client;

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
    'cash_denominations'
  ];

  try {
    client = await pool.connect();

    for (const table of TABLES) {
      console.log(`[syncDatabase] Processing table: ${table}...`);
      // 1. Fetch local rows
      let localRows = [];
      try {
        localRows = sqliteDb.prepare(`SELECT * FROM ${table}`).all();
      } catch (err) {
        continue;
      }
      const localIds = new Set(localRows.map(r => r.id));

      // 2. Fetch remote rows
      let remoteRows = [];
      try {
        const res = await client.query(`SELECT id FROM "${table}"`);
        remoteRows = res.rows;
      } catch (err) {
        continue;
      }
      const remoteIds = new Set(remoteRows.map(r => r.id));

      // 3. Push missing or updated rows from local to remote in high-speed batches
      let rowsToInsert;
      if (table === 'attendance') {
        const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
        // Recent attendance records (last 7 days) + any historical rows missing from remote
        rowsToInsert = localRows.filter(r => !remoteIds.has(r.id) || (r.date && r.date >= cutoff));
      } else {
        // For all other tables, upsert all local rows so any modifications/edits are propagated
        rowsToInsert = localRows;
      }

      if (rowsToInsert.length > 0) {
        let cols = Object.keys(rowsToInsert[0]);
        let conflictTarget = '(id)';
        let updateCols = cols.filter(c => c !== 'id');

        if (table === 'attendance') {
          cols = cols.filter(c => c !== 'id');
          conflictTarget = '("employee_code", "date")';
          updateCols = cols.filter(c => c !== 'employee_code' && c !== 'date');
        } else if (table === 'employees') {
          conflictTarget = '("code")';
          updateCols = cols.filter(c => c !== 'id' && c !== 'code');
        } else if (table === 'official_holidays') {
          conflictTarget = '("holiday_date")';
          updateCols = cols.filter(c => c !== 'id' && c !== 'holiday_date');
        } else if (table === 'payroll_runs') {
          conflictTarget = '("year", "month")';
          updateCols = cols.filter(c => c !== 'id' && c !== 'year' && c !== 'month');
        } else if (table === 'mid_month_expenses') {
          conflictTarget = '("year", "month", "employee_id")';
          updateCols = cols.filter(c => c !== 'id' && c !== 'year' && c !== 'month' && c !== 'employee_id');
        }

        const colList = cols.map(c => `"${c}"`).join(', ');
        const updateList = updateCols.map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');

        const BATCH_SIZE = 100;
        for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
          const batch = rowsToInsert.slice(i, i + BATCH_SIZE);
          const valueClauses = [];
          const values = [];
          let paramIdx = 1;

          for (const row of batch) {
            const placeholders = cols.map(() => `$${paramIdx++}`).join(', ');
            valueClauses.push(`(${placeholders})`);
            cols.forEach(c => values.push(row[c]));
          }

          try {
            await client.query(`
              INSERT INTO "${table}" (${colList})
              VALUES ${valueClauses.join(', ')}
              ON CONFLICT ${conflictTarget} DO UPDATE SET ${updateList}
            `, values);
          } catch (batchErr) {
            // Fallback to row-by-row if any error occurs
            for (const row of batch) {
              try {
                const singlePlaceholders = cols.map((_, idx) => `$${idx + 1}`).join(', ');
                await client.query(`
                  INSERT INTO "${table}" (${colList})
                  VALUES (${singlePlaceholders})
                  ON CONFLICT ${conflictTarget} DO UPDATE SET ${updateList}
                `, cols.map(c => row[c]));
              } catch (e) {}
            }
          }
        }

        // Fix sequence
        try {
          await client.query(`
            SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) + 1 FROM "${table}"), 1), false);
          `);
        } catch {}
      }
    }

    const elapsed = Date.now() - startTime;
    return { success: true, elapsedMs: elapsed };
  } catch (error) {
    console.error('⚠️ [Supabase Sync Error]:', error.message);
    return { success: false, error: error.message };
  } finally {
    if (client) client.release();
  }
}

/**
 * Compare local vs remote stats for live dashboard verification
 */
export async function getLiveSyncStatus(sqliteDb) {
  if (!pool) return { connected: false, error: 'Database URL not configured' };

  try {
    const client = await pool.connect();
    const tables = ['treasury_parties', 'cash_safes', 'cash_transactions', 'employees'];
    const comparison = [];

    for (const t of tables) {
      let localCount = 0;
      try {
        localCount = sqliteDb.prepare(`SELECT COUNT(*) as c FROM ${t}`).get().c;
      } catch (e) {}

      let remoteCount = 0;
      try {
        const res = await client.query(`SELECT COUNT(*) as c FROM "${t}"`);
        remoteCount = parseInt(res.rows[0].c, 10);
      } catch (e) {}

      comparison.push({
        table: t,
        localCount,
        remoteCount,
        synced: localCount === remoteCount
      });
    }

    client.release();
    return {
      connected: true,
      lastCheck: new Date().toISOString(),
      comparison
    };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

/**
 * Start background recurring sync
 */
export function startAutoSync(sqliteDb, intervalSeconds = 30) {
  if (!pool) return;

  console.log(`⚡ Supabase Live Auto-Sync engine initialized`);

  // Run initial cleanup and sync
  setTimeout(() => {
    syncDatabase(sqliteDb).then(res => {
      if (res.success) {
        console.log(`✅ [Supabase Initial Sync]: All tables aligned in ${res.elapsedMs}ms`);
      }
    });
  }, 1000);

  // Periodic alignment
  setInterval(() => {
    syncDatabase(sqliteDb);
  }, intervalSeconds * 1000);
}
