import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data', 'payroll.db');
const outDir = path.join(__dirname, '..', 'supabase');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
const outSqlPath = path.join(outDir, 'data_export.sql');

if (!fs.existsSync(dbPath)) {
  console.error('❌ SQLite database not found at:', dbPath);
  process.exit(1);
}

const db = new Database(dbPath);

console.log('🔄 Exporting data from SQLite to Supabase SQL format...');

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

let sqlOutput = `-- ==============================================================================
-- Payroll ERP - Data Export from SQLite for Supabase PostgreSQL
-- Generated At: ${new Date().toISOString()}
-- ==============================================================================

-- Temporarily disable triggers / foreign keys check for seamless insertion
SET session_replication_role = 'replica';

`;

function escapeSqlVal(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

let totalRows = 0;

for (const table of tables) {
  try {
    const rows = db.prepare(`SELECT * FROM ${table}`).all();
    if (rows.length === 0) continue;

    sqlOutput += `\n-- ------------------------------------------------------------------------------\n`;
    sqlOutput += `-- Data for table: ${table} (${rows.length} rows)\n`;
    sqlOutput += `-- ------------------------------------------------------------------------------\n`;

    const cols = Object.keys(rows[0]);
    const colList = cols.map(c => `"${c}"`).join(', ');

    // Generate batch inserts
    const chunkSize = 50;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const valuesList = chunk.map(row => {
        const vals = cols.map(c => escapeSqlVal(row[c]));
        return `(${vals.join(', ')})`;
      }).join(',\n  ');

      sqlOutput += `INSERT INTO ${table} (${colList}) VALUES\n  ${valuesList}\nON CONFLICT DO NOTHING;\n\n`;
    }

    // Reset sequence for SERIAL id
    sqlOutput += `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) + 1 FROM ${table}), 1), false);\n`;

    totalRows += rows.length;
    console.log(`  ✓ Exported ${rows.length} rows from [${table}]`);
  } catch (err) {
    console.warn(`  ⚠️ Skipped table [${table}]:`, err.message);
  }
}

sqlOutput += `\n-- Restore foreign keys constraint checks\nSET session_replication_role = 'origin';\n`;

fs.writeFileSync(outSqlPath, sqlOutput, 'utf8');

console.log(`\n✅ Data export completed successfully!`);
console.log(`📊 Total rows exported: ${totalRows}`);
console.log(`📁 File saved to: ${outSqlPath}`);
