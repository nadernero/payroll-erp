import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  
  // Check sequences
  const seqRes = await client.query(`
    SELECT sequencename, last_value 
    FROM pg_sequences 
    WHERE schemaname = 'public'
  `);
  console.log('--- PUBLIC SEQUENCES ---');
  console.log(seqRes.rows);

  // Check max ids for key tables
  const tables = ['treasury_parties', 'employees', 'cash_safes', 'attendance', 'mid_month_expenses', 'employee_requests'];
  for (const t of tables) {
    const r = await client.query(`SELECT MAX(id) as max_id FROM "${t}"`);
    console.log(`Table ${t}: MAX(id) = ${r.rows[0].max_id}`);
  }

  // Check RLS (Row Level Security) on treasury_parties and others!
  const rlsRes = await client.query(`
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public'
  `);
  console.log('--- RLS STATUS ---');
  console.log(rlsRes.rows);

  // Check policies
  const polRes = await client.query(`
    SELECT tablename, policyname, permissive, roles, cmd, qual
    FROM pg_policies
    WHERE schemaname = 'public'
  `);
  console.log('--- POLICIES ---');
  console.log(polRes.rows);

  await client.end();
}

main().catch(console.error);
