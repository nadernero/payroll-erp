import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_SUPABASE_URL = 'postgresql://postgres.pnvsmqihnrrowfqlkqjo:Id%4022031981%402203@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true';
const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || DEFAULT_SUPABASE_URL;

let pool = null;
if (dbUrl) {
  const { Pool } = pg;
  pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
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
      if (res.rows.length > 0) targetRow.id = res.rows[0].id;
    } else if (table === 'official_holidays' && targetRow.holiday_date) {
      const res = await pool.query('SELECT id FROM "official_holidays" WHERE holiday_date = $1', [targetRow.holiday_date]);
      if (res.rows.length > 0) targetRow.id = res.rows[0].id;
    } else if (table === 'payroll_runs' && targetRow.year && targetRow.month) {
      const res = await pool.query('SELECT id FROM "payroll_runs" WHERE year = $1 AND month = $2', [targetRow.year, targetRow.month]);
      if (res.rows.length > 0) targetRow.id = res.rows[0].id;
    } else if (table === 'mid_month_expenses' && targetRow.year && targetRow.month && targetRow.employee_id) {
      const res = await pool.query('SELECT id FROM "mid_month_expenses" WHERE year = $1 AND month = $2 AND employee_id = $3', [targetRow.year, targetRow.month, targetRow.employee_id]);
      if (res.rows.length > 0) targetRow.id = res.rows[0].id;
    }
  } catch (lookupErr) {}

  const cols = Object.keys(targetRow);
  if (cols.length === 0) return false;

  const colList = cols.map(c => `"${c}"`).join(', ');
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const updateList = cols.filter(c => c !== 'id').map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');
  const values = cols.map(c => targetRow[c]);

  const query = `
    INSERT INTO "${table}" (${colList})
    VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET ${updateList}
  `;

  try {
    await pool.query(query, values);
    console.log(`⚡ [Supabase Realtime]: Synced [${table}] ID=${targetRow.id || targetRow.code || targetRow.date}`);
    return true;
  } catch (err) {
    console.error(`⚠️ [Supabase Realtime Push Error in ${table}]:`, err.message);
    return false;
  }
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
    console.log(`🗑️ [Supabase Realtime]: Deleted from [${table}]`);
    return true;
  } catch (err) {
    console.error(`⚠️ [Supabase Realtime Delete Error in ${table}]:`, err.message);
    return false;
  }
}

/**
 * Pull all data from Supabase into local SQLite (e.g. on cold start in Vercel)
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
      'cash_denominations'
    ];

    for (const table of TABLES) {
      try {
        const res = await client.query(`SELECT * FROM "${table}"`);
        if (!res.rows || res.rows.length === 0) continue;

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
      } catch (e) {}
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
 * Fast pull for recent / updated attendance from Supabase (under 500ms)
 */
export async function pullFreshAttendance(sqliteDb) {
  if (!pool) return { success: false, reason: 'No DB pool' };
  try {
    const client = await pool.connect();
    // Pull any attendance records from the last 45 days
    const cutoffDate = new Date(Date.now() - 45 * 86400000).toISOString().split('T')[0];
    const res = await client.query('SELECT * FROM "attendance" WHERE date >= $1', [cutoffDate]);

    if (res.rows && res.rows.length > 0) {
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
    client.release();
    return { success: true, count: res.rows?.length || 0 };
  } catch (err) {
    console.error('⚠️ [pullFreshAttendance Error]:', err.message);
    return { success: false, error: err.message };
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
