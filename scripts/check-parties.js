import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT id, name, contact_person, party_type FROM treasury_parties ORDER BY id DESC LIMIT 5');
  console.log('--- LATEST SUPABASE PARTIES ---');
  console.table(res.rows);
  await client.end();
}
run();
