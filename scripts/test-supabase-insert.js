import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false }
});

async function testInsert() {
  await client.connect();
  try {
    const res = await client.query(`
      INSERT INTO treasury_parties (name, party_type, category, contact_person, phone)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, ['تجربة مورد فحص', 'company', 'أخرى', 'مسؤول فحص', '01000000000']);
    console.log('Inserted successfully:', res.rows[0]);

    // Delete the test row
    await client.query('DELETE FROM treasury_parties WHERE id = $1', [res.rows[0].id]);
    console.log('Deleted test row successfully');
  } catch (err) {
    console.error('Insert error in Supabase:', err);
  } finally {
    await client.end();
  }
}

testInsert();
