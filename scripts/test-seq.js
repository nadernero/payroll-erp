import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testSeq() {
  await client.connect();
  const nextVal = await client.query("SELECT nextval('treasury_parties_id_seq')");
  console.log('Nextval of treasury_parties_id_seq:', nextVal.rows[0].nextval);
  await client.end();
}

testSeq().catch(console.error);
