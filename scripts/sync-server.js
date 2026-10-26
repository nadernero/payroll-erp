import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

const serverSrc = path.join(root, 'server');
const serverDest = path.join(root, 'client', 'server');

const dataSrc = path.join(root, 'data', 'payroll.db');
const dataDestDir = path.join(root, 'client', 'data');
const dataDest = path.join(dataDestDir, 'payroll.db');

// Sync server/ -> client/server/
if (fs.existsSync(serverSrc)) {
  fs.cpSync(serverSrc, serverDest, { recursive: true });
  console.log('✓ Synced server/ to client/server/');
}

// Checkpoint WAL in data/payroll.db so the main file contains all latest commits
if (fs.existsSync(dataSrc)) {
  try {
    const { default: BetterSqlite3 } = await import('better-sqlite3');
    const localDb = new BetterSqlite3(dataSrc);
    localDb.pragma('wal_checkpoint(TRUNCATE)');
    localDb.close();
    console.log('✓ Checkpointed SQLite WAL journal to data/payroll.db');
  } catch (cpErr) {
    console.warn('Notice: checkpoint skipped:', cpErr.message);
  }
}

// Sync data/payroll.db -> client/data/payroll.db
if (!fs.existsSync(dataDestDir)) {
  fs.mkdirSync(dataDestDir, { recursive: true });
}

if (fs.existsSync(dataSrc)) {
  fs.copyFileSync(dataSrc, dataDest);
  console.log('✓ Synced data/payroll.db to client/data/payroll.db');
}

// Remove any temporary WAL/SHM from client/data
for (const f of ['payroll.db-shm', 'payroll.db-wal']) {
  const p = path.join(dataDestDir, f);
  if (fs.existsSync(p)) {
    try { fs.unlinkSync(p); } catch {}
  }
}

console.log('✓ All backend server & database files synchronized for Vercel deployment.');
