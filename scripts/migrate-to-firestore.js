import db from '../server/db.js';
import { pushBatchToFirestore, syncDatabaseToFirestore } from '../server/firestoreSync.js';
import admin from 'firebase-admin';

console.log('=======================================================');
console.log('🚀 بدء ترحيل كافة البيانات من SQLite إلى Firebase Firestore');
console.log('=======================================================');

const TABLES = [
  'employees',
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
  'treasury_parties',
  'cash_safes',
  'cash_transactions',
  'cash_trusts',
  'cash_denominations'
];

async function runMigration() {
  let totalMigrated = 0;

  for (const table of TABLES) {
    try {
      const rows = db.prepare(`SELECT * FROM ${table}`).all();
      console.log(`📦 جاري ترحيل جدول [${table}]: عدد السجلات = ${rows.length}...`);

      if (rows.length > 0) {
        const ok = await pushBatchToFirestore(table, rows);
        if (ok) {
          totalMigrated += rows.length;
          console.log(`✅ تم ترحيل [${table}] بنجاح (${rows.length} سجل).`);
        } else {
          console.warn(`⚠️ فشل أو تعذر ترحيل [${table}] - يرجى التحقق من اتصال Firebase.`);
        }
      }
    } catch (err) {
      console.error(`❌ خطأ أثناء ترحيل [${table}]:`, err.message);
    }
  }

  console.log('=======================================================');
  console.log(`🎉 اكتمل الترحيل! إجمالي السجلات التي تم رفعها: ${totalMigrated}`);
  console.log('=======================================================');
  process.exit(0);
}

runMigration().catch(err => {
  console.error('Fatal Migration Error:', err);
  process.exit(1);
});
