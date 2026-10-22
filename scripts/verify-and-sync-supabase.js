import pg from 'pg';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase Connection Configuration
const config = {
  user: 'postgres.pnvsmqihnrrowfqlkqjo',
  password: 'Id@22031981@2203',
  host: 'aws-0-eu-west-1.pooler.supabase.com',
  port: 5432, // Direct / session mode is required for DDL & migration
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

const tablesToCheck = [
  { name: 'employees', desc: 'الموظفون' },
  { name: 'cash_safes', desc: 'الخزائن الرئيسية والفرعية' },
  { name: 'treasury_parties', desc: 'الموردين والشركات الخارجية' },
  { name: 'official_holidays', desc: 'الإجازات الرسمية' },
  { name: 'biometric_devices', desc: 'أجهزة البصمة' },
  { name: 'loans', desc: 'السلف طويلة الأجل' },
  { name: 'leaves', desc: 'سجلات الإجازات' },
  { name: 'attendance', desc: 'حركات الحضور والغياب' },
  { name: 'mid_month_expenses', desc: 'مصروفات يوم 10 و 20' },
  { name: 'employee_requests', desc: 'طلبات البوابة' },
  { name: 'payroll_runs', desc: 'كشوفات المرتبات الشهرية' },
  { name: 'payroll_items', desc: 'بنود مرتبات الموظفين' },
  { name: 'salary_history', desc: 'سجل تدرج الرواتب' },
  { name: 'cash_transactions', desc: 'حركات الخزينة' },
  { name: 'cash_denominations', desc: 'فئات النقدية بالدرج' }
];

async function main() {
  console.log('========================================================================');
  console.log('🔌 جاري الاتصال بقاعدة بيانات Supabase السحابية مباشرة...');
  console.log(`📍 الخادم: ${config.host}:${config.port} | المستخدم: ${config.user}`);
  console.log('========================================================================');

  const { Client } = pg;
  const client = new Client(config);

  try {
    await client.connect();
    console.log('✅ تم الاتصال بنجاح بخادم Supabase PostgreSQL!\n');

    // Step 1: Check existing tables in public schema
    const checkTablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const existingTableNames = new Set(checkTablesRes.rows.map(r => r.table_name));
    console.log(`📋 الجداول الموجودة حالياً في Supabase: ${existingTableNames.size} جدول`);

    // Step 2: If schema not complete, apply schema
    const missingTables = tablesToCheck.filter(t => !existingTableNames.has(t.name));
    if (missingTables.length > 0) {
      console.log(`\n⚙️ تم اكتشاف نقص في بعض الجداول (${missingTables.length} جدول مفقود).`);
      console.log('جاري تطبيق ملف المخطط (supabase/schema.sql)...');
      const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await client.query(schemaSql);
      console.log('✅ تم إنشاء وتحديث مخطط الجداول (Schema) بنجاح!');
    } else {
      console.log('✅ جميع الجداول الأساسية موجودة في المخطط (Public Schema).');
    }

    // Step 3: Check row counts in each table and sync if needed
    console.log('\n📊 جاري فحص عدد السجلات ومزامنة البيانات من SQLite المحلي إذا لزم الأمر...');
    const sqlitePath = path.join(__dirname, '..', 'data', 'payroll.db');
    let sqlite = null;
    if (fs.existsSync(sqlitePath)) {
      sqlite = new Database(sqlitePath);
    }

    let totalSupabaseRows = 0;
    const stats = [];

    // Temporarily disable FK triggers for clean import
    await client.query("SET session_replication_role = 'replica';");

    for (const t of tablesToCheck) {
      let pgCount = 0;
      try {
        const cRes = await client.query(`SELECT COUNT(*) as count FROM "${t.name}"`);
        pgCount = parseInt(cRes.rows[0].count, 10);
      } catch (err) {
        pgCount = 0;
      }

      let sqliteCount = 0;
      let rowsToInsert = [];
      if (sqlite) {
        try {
          rowsToInsert = sqlite.prepare(`SELECT * FROM ${t.name}`).all();
          sqliteCount = rowsToInsert.length;
        } catch (e) {
          sqliteCount = 0;
        }
      }

      // If Supabase table has fewer rows than SQLite, insert missing data
      if (sqlite && rowsToInsert.length > 0 && pgCount < sqliteCount) {
        console.log(`   🔄 مزامنة جدول [${t.name}]: Supabase به (${pgCount}) بينما SQLite به (${sqliteCount}) سجل.`);
        const cols = Object.keys(rowsToInsert[0]);
        const colList = cols.map(c => `"${c}"`).join(', ');

        for (const row of rowsToInsert) {
          const values = cols.map(c => row[c]);
          const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(', ');
          const query = `
            INSERT INTO "${t.name}" (${colList})
            VALUES (${placeholders})
            ON CONFLICT DO NOTHING
          `;
          await client.query(query, values);
        }

        // Reset serial sequence
        try {
          await client.query(`
            SELECT setval(pg_get_serial_sequence('${t.name}', 'id'), COALESCE((SELECT MAX(id) + 1 FROM "${t.name}"), 1), false);
          `);
        } catch {}

        // Re-read count
        const afterRes = await client.query(`SELECT COUNT(*) as count FROM "${t.name}"`);
        pgCount = parseInt(afterRes.rows[0].count, 10);
      }

      totalSupabaseRows += pgCount;
      stats.push({
        name: t.name,
        desc: t.desc,
        supabaseCount: pgCount,
        sqliteCount: sqliteCount
      });
    }

    // Restore replication role
    await client.query("SET session_replication_role = 'origin';");

    // Step 4: Check Storage Bucket for receipts
    let bucketFound = false;
    try {
      const bucketRes = await client.query("SELECT id, name, public FROM storage.buckets WHERE id = 'receipts'");
      if (bucketRes.rows.length > 0) {
        bucketFound = true;
      } else {
        // Try creating the bucket
        await client.query("INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', true) ON CONFLICT (id) DO NOTHING;");
        bucketFound = true;
      }
    } catch (e) {
      console.log('   ℹ️ ملاحظة بخصوص Storage Bucket:', e.message);
    }

    console.log('\n========================================================================');
    console.log('✨ نتيجة الفحص والتحقق النهائي لقاعدة بيانات Supabase:');
    console.log('========================================================================');
    for (const s of stats) {
      const matchSymbol = s.supabaseCount === s.sqliteCount ? '✅' : '⚠️';
      console.log(`${matchSymbol} جدول [${s.name.padEnd(20)}] (${s.desc}): ${s.supabaseCount} سجل في Supabase (المحلي: ${s.sqliteCount})`);
    }

    console.log('------------------------------------------------------------------------');
    console.log(`📦 إجمالي السجلات في Supabase: ${totalSupabaseRows} سجل.`);
    console.log(`📁 مخزن المستندات والصور (receipts bucket): ${bucketFound ? 'جاهز ويعمل ✅' : 'يحتاج فحص يدوي'}`);
    console.log('========================================================================\n');

  } catch (error) {
    console.error('❌ حدث خطأ أثناء الاتصال أو المزامنة:', error);
  } finally {
    await client.end();
  }
}

main();
