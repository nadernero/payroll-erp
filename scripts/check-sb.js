import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres.pnvsmqihnrrowfqlkqjo:Id%4022031981%402203@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const tables = [
    'employees', 'attendance', 'mid_month_expenses', 'loans', 'leaves',
    'payroll_runs', 'payroll_items', 'cash_safes', 'treasury_parties',
    'cash_transactions', 'employee_requests'
  ];
  console.log('--- SUPABASE TABLE STATS ---');
  let total = 0;
  for (const t of tables) {
    try {
      const res = await pool.query(`SELECT count(*) FROM "${t}"`);
      const cnt = parseInt(res.rows[0].count, 10);
      total += cnt;
      console.log(`  ${t.padEnd(22)}: ${cnt}`);
    } catch (e) {
      console.log(`  ${t.padEnd(22)}: Error: ${e.message}`);
    }
  }
  console.log(`Total: ${total}`);
  await pool.end();
}

run();
