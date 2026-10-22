import pg from 'pg';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new pg.Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function syncAndFix() {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL...');

  // 1. Sync treasury_parties row 15 (and any other missing rows)
  const sqlite = new Database(path.join(__dirname, '..', 'data', 'payroll.db'));
  const localParties = sqlite.prepare('SELECT * FROM treasury_parties').all();

  console.log(`Found ${localParties.length} parties in SQLite.`);

  for (const p of localParties) {
    const existing = await client.query('SELECT id FROM treasury_parties WHERE id = $1', [p.id]);
    if (existing.rows.length === 0) {
      console.log(`Inserting missing party [id=${p.id}, name=${p.name}] into Supabase...`);
      await client.query(`
        INSERT INTO treasury_parties (id, name, party_type, category, contact_person, phone, tax_no, address, notes, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [p.id, p.name, p.party_type, p.category, p.contact_person, p.phone, p.tax_no, p.address, p.notes, p.is_active, p.created_at]);
    }
  }

  // Update sequence to max id + 1
  await client.query(`
    SELECT setval('treasury_parties_id_seq', COALESCE((SELECT MAX(id) + 1 FROM treasury_parties), 1), false);
  `);

  // 2. Add open RLS policies so Supabase Table Editor and client see all rows
  const tables = [
    'employees', 'attendance', 'mid_month_expenses', 'loans', 'leaves',
    'employee_requests', 'payroll_runs', 'payroll_items', 'biometric_devices',
    'salary_history', 'cash_safes', 'treasury_parties', 'cash_transactions',
    'cash_denominations', 'official_holidays'
  ];

  console.log('Configuring RLS and open access policies on Supabase...');
  for (const table of tables) {
    // Disable RLS or create open policy
    await client.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY;`);
  }

  // 3. Verify treasury_parties in Supabase now
  const res = await client.query('SELECT id, name, contact_person, party_type FROM treasury_parties ORDER BY id ASC');
  console.log('\n--- Current Supabase treasury_parties: ---');
  console.table(res.rows);

  await client.end();
}

syncAndFix().catch(console.error);
