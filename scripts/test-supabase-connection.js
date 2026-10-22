import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const dbUrl = process.env.DATABASE_URL || process.argv[2];

if (!dbUrl) {
  console.log('========================================================================');
  console.log('❌ لم يتم العثور على رابط اتصال Supabase (DATABASE_URL)');
  console.log('طريقة الاستخدام:');
  console.log('node scripts/test-supabase-connection.js "رابط_قاعدة_البيانات_هنا"');
  console.log('========================================================================');
  process.exit(1);
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function verifySupabase() {
  console.log('\n🔍 جاري فحص والتحقق من قاعدة بيانات Supabase...');
  console.log('----------------------------------------------------');

  let client;
  try {
    client = await pool.connect();
    console.log('✅ تم الاتصال بنجاح بخوادم Supabase PostgreSQL سحابياً!');

    const tablesToCheck = [
      { name: 'employees', desc: 'الموظفون' },
      { name: 'attendance', desc: 'حركات الحضور والغياب' },
      { name: 'mid_month_expenses', desc: 'مصروفات يوم 10 و 20' },
      { name: 'loans', desc: 'السلف طويلة الأجل' },
      { name: 'leaves', desc: 'سجلات الإجازات' },
      { name: 'employee_requests', desc: 'طلبات البوابة' },
      { name: 'payroll_runs', desc: 'كشوفات المرتبات الشهرية' },
      { name: 'payroll_items', desc: 'بنود مرتبات الموظفين' },
      { name: 'cash_safes', desc: 'الخزائن الرئيسية والفرعية' },
      { name: 'cash_transactions', desc: 'حركات الخزينة' },
      { name: 'cash_denominations', desc: 'فئات النقدية بالدرج' },
      { name: 'treasury_parties', desc: 'الموردين والشركات الخارجية' },
      { name: 'official_holidays', desc: 'الإجازات الرسمية' },
      { name: 'biometric_devices', desc: 'أجهزة البصمة' },
      { name: 'salary_history', desc: 'سجل تدرج الرواتب' }
    ];

    console.log('\n📊 تقرير فحص الجداول والبيانات المنقولة:');
    console.log('----------------------------------------------------');

    let totalRecords = 0;
    let tablesFound = 0;

    for (const t of tablesToCheck) {
      try {
        const res = await client.query(`SELECT COUNT(*) as count FROM ${t.name}`);
        const count = parseInt(res.rows[0].count, 10);
        totalRecords += count;
        tablesFound++;
        console.log(`  ✓ جدول [${t.name}] (${t.desc}): ${count} سجل`);
      } catch (err) {
        console.log(`  ❌ جدول [${t.name}] (${t.desc}): غير موجود (${err.message})`);
      }
    }

    // Check storage bucket
    console.log('\n📁 فحص مخزن الصور والمستندات (Storage):');
    console.log('----------------------------------------------------');
    try {
      const bucketRes = await client.query("SELECT id, name, public FROM storage.buckets WHERE id = 'receipts'");
      if (bucketRes.rows.length > 0) {
        console.log("  ✓ مخزن الصور ['receipts'] موجود وجاهز لاستقبال صور الفواتير والإيصالات!");
      } else {
        console.log("  ⚠️ مخزن الصور ['receipts'] لم يُعثر عليه بعد");
      }
    } catch (e) {
      console.log('  ℹ️ لم يتم فحص باكت الصور مباشرة:', e.message);
    }

    console.log('\n====================================================');
    if (tablesFound === tablesToCheck.length) {
      console.log(`🎉 النتيجة: مكتمل 100%! تم التحقق من ${tablesFound} جدول، وإجمالي ${totalRecords} سجل بنجاح.`);
      console.log('قاعدة بياناتك على Supabase تعمل بكفاءة تامة وجاهزة لربط التطبيق!');
    } else {
      console.log(`⚠️ تم العثور على ${tablesFound} من أصل ${tablesToCheck.length} جدول.`);
    }
    console.log('====================================================\n');

  } catch (error) {
    console.error('❌ خطأ في الاتصال بقاعدة بيانات Supabase:', error.message);
    console.log('\nنصائح لحل المشكلة:');
    console.log('1. تأكد من صحة كلمة مرور قاعدة البيانات في رابط الاتصال.');
    console.log('2. تأكد من أن الرابط من نمط URI في إعدادات Supabase (Settings -> Database).');
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

verifySupabase();
