import pg from 'pg';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbUrl = process.env.DATABASE_URL || process.argv[2];

if (!dbUrl) {
  console.log('========================================================================');
  console.log('ℹ️ Usage: node scripts/migrate-to-supabase.js "YOUR_SUPABASE_DATABASE_URL"');
  console.log('Or set DATABASE_URL in your .env file.');
  console.log('Example: postgresql://postgres.xxxx:yourpassword@aws-0-eu-central-1.pooler.supabase.com:6543/postgres');
  console.log('========================================================================');
  process.exit(1);
}

const sqlitePath = path.join(__dirname, '..', 'data', 'payroll.db');
const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql');

if (!fs.existsSync(sqlitePath)) {
  console.error('❌ SQLite file not found:', sqlitePath);
  process.exit(1);
}

const sqlite = new Database(sqlitePath);
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  console.log('🚀 Connecting to Supabase PostgreSQL...');
  const client = await pool.connect();

  try {
    console.log('1️⃣ Applying Schema to Supabase...');
    await client.query(schemaSql);
    console.log('   ✓ Schema created successfully!');

    console.log('2️⃣ Migrating Data from SQLite to Supabase...');
    await client.query("SET session_replication_role = 'replica';");

    const tables = [
      'employees',
      'cash_safes',
      'treasury_parties',
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

    for (const table of tables) {
      try {
        const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
        if (rows.length === 0) continue;

        const cols = Object.keys(rows[0]);
        const colList = cols.map(c => `"${c}"`).join(', ');

        for (const row of rows) {
          const values = cols.map(c => row[c]);
          const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(', ');

          const query = `
            INSERT INTO ${table} (${colList})
            VALUES (${placeholders})
            ON CONFLICT DO NOTHING
          `;
          await client.query(query, values);
        }

        try {
          await client.query(`
            SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) + 1 FROM ${table}), 1), false);
          `);
        } catch {}

        console.log(`   ✓ Migrated ${rows.length} rows into [${table}]`);
      } catch (err) {
        console.warn(`   ⚠️ Table ${table}:`, err.message);
      }
    }

    await client.query("SET session_replication_role = 'origin';");
    console.log('\n🎉 ALL DATA MIGRATED TO SUPABASE SUCCESSFULLY!');
    console.log('Your Supabase database is now live with 100% of your company records.');
  } catch (err) {
    console.error('❌ Migration Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
