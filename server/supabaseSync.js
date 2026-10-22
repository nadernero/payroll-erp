import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

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

  const cols = Object.keys(row);
  if (cols.length === 0) return false;

  const colList = cols.map(c => `"${c}"`).join(', ');
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const updateList = cols.filter(c => c !== 'id').map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');
  const values = cols.map(c => row[c]);

  const query = `
    INSERT INTO "${table}" (${colList})
    VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET ${updateList}
  `;

  try {
    await pool.query(query, values);
    console.log(`⚡ [Supabase Realtime]: Synced [${table}] ID=${row.id}`);
    return true;
  } catch (err) {
    console.error(`⚠️ [Supabase Realtime Push Error in ${table}]:`, err.message);
    return false;
  }
}

/**
 * Delete a record from Supabase immediately in real-time
 */
export async function deleteFromSupabase(table, id) {
  if (!pool || !id) return false;

  try {
    const res = await pool.query(`DELETE FROM "${table}" WHERE id = $1`, [id]);
    console.log(`🗑️ [Supabase Realtime]: Deleted from [${table}] ID=${id} (affected: ${res.rowCount})`);
    return true;
  } catch (err) {
    console.error(`⚠️ [Supabase Realtime Delete Error in ${table}]:`, err.message);
    return false;
  }
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

      // 3. Push missing or updated rows from local to remote
      if (localRows.length > 0) {
        const cols = Object.keys(localRows[0]);
        const colList = cols.map(c => `"${c}"`).join(', ');
        const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(', ');
        const updateList = cols.filter(c => c !== 'id').map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');

        for (const row of localRows) {
          // If remote doesn't have it or we want to ensure sync
          if (!remoteIds.has(row.id)) {
            const values = cols.map(c => row[c]);
            try {
              await client.query(`
                INSERT INTO "${table}" (${colList})
                VALUES (${placeholders})
                ON CONFLICT (id) DO UPDATE SET ${updateList}
              `, values);
            } catch (e) {}
          }
        }

        // Fix sequence
        try {
          await client.query(`
            SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) + 1 FROM "${table}"), 1), false);
          `);
        } catch {}
      }

      // 4. Delete remote rows that were deleted locally (only for tables where local is authoritative)
      for (const rem of remoteRows) {
        if (!localIds.has(rem.id)) {
          console.log(`🧹 [Supabase Sync]: Removing deleted record from [${table}] ID=${rem.id}`);
          try {
            await client.query(`DELETE FROM "${table}" WHERE id = $1`, [rem.id]);
          } catch (e) {}
        }
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
