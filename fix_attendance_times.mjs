/**
 * Fix attendance records that have decimal time values instead of HH:MM format
 * e.g. 0.37013888 → "08:53" (Excel serial time: fraction of a day)
 */
import db from './server/db.js';

function decimalToTime(val) {
  if (!val || val === '') return '';
  // If already looks like HH:MM, return as-is
  if (/^\d{1,2}:\d{2}/.test(String(val))) return val;
  
  const num = parseFloat(val);
  if (isNaN(num)) return val;
  
  // Excel serial time: 0.0 = 00:00, 1.0 = 24:00
  const totalMinutes = Math.round(num * 24 * 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

const rows = db.prepare('SELECT id, check_in, check_out FROM attendance').all();
let fixedCount = 0;

const update = db.prepare('UPDATE attendance SET check_in = ?, check_out = ? WHERE id = ?');

const txn = db.transaction(() => {
  for (const row of rows) {
    let needsUpdate = false;
    let newIn = row.check_in;
    let newOut = row.check_out;

    if (row.check_in && /^0\.\d+/.test(String(row.check_in))) {
      newIn = decimalToTime(row.check_in);
      needsUpdate = true;
    }
    if (row.check_out && /^0\.\d+/.test(String(row.check_out))) {
      newOut = decimalToTime(row.check_out);
      needsUpdate = true;
    }

    if (needsUpdate) {
      update.run(newIn, newOut, row.id);
      fixedCount++;
      console.log(`Fixed id=${row.id}: ${row.check_in} → ${newIn}, ${row.check_out} → ${newOut}`);
    }
  }
});

txn();
console.log(`\nTotal fixed: ${fixedCount} records`);
