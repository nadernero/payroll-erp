import db from '../server/db.js';
import { testDeviceConnection, fetchDeviceAttendances } from '../server/biometricService.js';
import { pushToSupabase, syncDatabase } from '../server/supabaseSync.js';

async function main() {
  console.log('====================================================');
  console.log('   🚀 أداة سحب حركات البصمة من الماكينة ورفعها سحابياً');
  console.log('====================================================\n');

  // Find local machine (device 1 or any IP starting with 192.168)
  const device = db.prepare("SELECT * FROM biometric_devices WHERE ip LIKE '192.168.%' OR id = 1").get();
  
  if (!device) {
    console.error('❌ لم يتم العثور على ماكينة بصمة بعنوان محلي في قاعدة البيانات!');
    process.exit(1);
  }

  console.log(`📡 جاري فحص الاتصال بالماكينة: [${device.name}] (${device.ip}:${device.port})...`);
  const testRes = await testDeviceConnection(device.ip, device.port, 10000);

  if (!testRes.success) {
    console.error(`\n❌ ${testRes.message}`);
    console.error('💡 تأكد من أن ماكينة البصمة قيد التشغيل ومتصلة بنفس شبكة الراوتر (Wi-Fi / Ethernet).');
    process.exit(1);
  }

  console.log(`✅ ${testRes.message}`);
  if (testRes.info) {
    console.log(`📊 إجمالي حركات البصمة في الماكينة: ${testRes.info.logCounts?.toLocaleString() || 'غير معروف'}`);
    console.log(`👥 عدد الموظفين المسجلين في الماكينة: ${testRes.info.userCounts || 'غير معروف'}`);
  }

  console.log('\n📥 جاري سحب الحركات الحديثة وتحليل أوقات الحضور والانصراف...');
  const logsResult = await fetchDeviceAttendances(
    device.ip,
    device.port,
    45000,
    device.protocol || 'tcp',
    { ignoreDateRange: false }
  );

  const logs = logsResult.logs || [];
  console.log(`📋 تم فحص وسحب ${logs.length} حركة بصمة مطابقة للشهر الحالي.`);

  if (logs.length === 0) {
    console.log('ℹ️ لا توجد حركات جديدة.');
    process.exit(0);
  }

  // Group logs by employee_code + date
  const grouped = new Map();
  for (const log of logs) {
    const key = `${log.employee_code}_${log.date}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        employee_code: log.employee_code,
        date: log.date,
        times: []
      });
    }
    grouped.get(key).times.push(log.time);
  }

  // Preload employees
  const employees = db.prepare('SELECT id, code, name, department FROM employees').all();
  const empMap = new Map();
  const empNumMap = new Map();
  employees.forEach(e => {
    const codeStr = String(e.code).trim();
    empMap.set(codeStr, e);
    const num = parseInt(codeStr, 10);
    if (!isNaN(num)) empNumMap.set(num, e);
  });

  const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  const upsertStmt = db.prepare(`
    INSERT INTO attendance (
      employee_id, employee_code, employee_name, department, date, day_name,
      status, check_in, check_out, is_absent
    ) VALUES (
      @employee_id, @employee_code, @employee_name, @department, @date, @day_name,
      'حاضر', @check_in, @check_out, 0
    )
    ON CONFLICT(employee_code, date) DO UPDATE SET
      check_in = CASE WHEN attendance.check_in IS NULL OR attendance.check_in = '' THEN excluded.check_in ELSE attendance.check_in END,
      check_out = excluded.check_out,
      status = 'حاضر',
      is_absent = 0
  `);

  let syncedCount = 0;
  let skippedCount = 0;
  const syncedRows = [];

  db.transaction(() => {
    for (const [key, item] of grouped.entries()) {
      const rawCode = String(item.employee_code).trim();
      const rawNum = parseInt(rawCode, 10);
      const emp = empMap.get(rawCode) || (!isNaN(rawNum) ? empNumMap.get(rawNum) : null);

      if (!emp) {
        skippedCount++;
        continue;
      }

      item.times.sort();
      const checkIn = item.times[0] || '';
      const checkOut = item.times.length > 1 ? item.times[item.times.length - 1] : '';

      const d = new Date(item.date);
      const dayName = arabicDays[d.getDay()] || '';

      const row = {
        employee_id: emp.id,
        employee_code: emp.code,
        employee_name: emp.name,
        department: emp.department || 'عام',
        date: item.date,
        day_name: dayName,
        check_in: checkIn,
        check_out: checkOut
      };

      upsertStmt.run(row);
      syncedRows.push(row);
      syncedCount++;
    }

    db.prepare(`
      UPDATE biometric_devices 
      SET last_sync_at = datetime('now', 'localtime'),
          last_sync_status = 'success'
      WHERE id = ?
    `).run(device.id);
  })();

  console.log(`\n✅ تم تسجيل ${syncedCount} يوم حضور بنجاح لموظفي الشركة المسجلين.`);
  if (skippedCount > 0) {
    console.log(`ℹ️ تم استبعاد ${skippedCount} حركة حضور لموظفين غير مدرجين في جدول الموظفين.`);
  }

  // Cloud Sync to Supabase
  console.log('\n☁️ جاري المزامنة مع قاعدة البيانات السحابية (Supabase)...');
  try {
    const syncRes = await syncDatabase(db);
    if (syncRes.success) {
      console.log(`⚡ تمت المزامنة السحابية بنجاح في ${syncRes.elapsedMs}ms!`);

      // Notify Vercel server to pull immediately
      try {
        console.log('📡 جاري إشعار السيرفر السحابي (Vercel) لتحديث البصمات فوراً...');
        await fetch('https://payroll-erp-rho.vercel.app/api/sync/pull', { 
          method: 'POST',
          signal: AbortSignal.timeout(8000)
        });
        console.log('✅ تم إشعار السيرفر السحابي بنجاح!');
      } catch (notifyErr) {
        // Non-blocking
      }

      console.log('🌐 أصبحت بيانات الحضور متاحة الآن 24/7 على:');
      console.log('   - https://company-payroll-erp-2026.web.app');
      console.log('   - https://payroll-erp-rho.vercel.app');
    } else {
      console.warn('⚠️ تنبيه أثناء المزامنة السحابية:', syncRes.reason || syncRes.error);
    }
  } catch (syncErr) {
    console.error('⚠️ خطأ في المزامنة السحابية:', syncErr.message);
  }

  console.log('\n====================================================');
  console.log('   🎉 اكتملت العملية بنجاح 100%!');
  console.log('====================================================');
}

main().catch(err => {
  console.error('\n❌ خطأ غير متوقع:', err.message);
  process.exit(1);
});
