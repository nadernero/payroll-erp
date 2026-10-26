import db from '../server/db.js';
import { testDeviceConnection, fetchDeviceAttendances } from '../server/biometricService.js';
import { syncDatabase } from '../server/supabaseSync.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const logsDir = path.join(rootDir, 'logs');
const logFile = path.join(logsDir, 'biometric-sync.log');

if (!fs.existsSync(logsDir)) {
  try { fs.mkdirSync(logsDir, { recursive: true }); } catch (e) {}
}

function writeLog(line) {
  const timestamp = new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' });
  const entry = `[${timestamp}] ${line}\n`;
  try {
    fs.appendFileSync(logFile, entry, 'utf8');
  } catch (e) {}
}

async function main() {
  const isSilent = process.argv.includes('--silent');
  const log = (...args) => {
    console.log(...args);
  };

  log('========================================================================');
  log('   🚀 محرك المزامنة الآلي الشامل لماكينات البصمة (الداخلية والخارجية)');
  log('========================================================================\n');

  // Pre-sync: pull latest employees and biometric devices from cloud to guarantee fresh local state
  try {
    const { pullFromSupabase } = await import('../server/supabaseSync.js');
    await pullFromSupabase(db, ['employees', 'biometric_devices']);
  } catch (pullErr) {
    // Continue with local cache if remote pull fails
  }

  // Fetch all active biometric devices
  const devices = db.prepare("SELECT * FROM biometric_devices WHERE status = 'active' ORDER BY id ASC").all();

  if (devices.length === 0) {
    log('⚠️ لا توجد أي ماكينات بصمة مفعلة في النظام.');
    writeLog('⚠️ لا توجد أي ماكينات بصمة مفعلة في النظام.');
    process.exit(0);
  }

  log(`📋 تم العثور على (${devices.length}) ماكينة بصمة مسجلة في النظام:`);
  devices.forEach((d, idx) => {
    log(`   [${idx + 1}] ${d.name} (${d.ip}:${d.port}) - ${d.location || 'عام'}`);
  });
  log('');

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
      check_out = CASE WHEN excluded.check_out != '' THEN excluded.check_out ELSE attendance.check_out END,
      status = 'حاضر',
      is_absent = 0
  `);

  let totalNewPunches = 0;
  let totalNewDays = 0;
  let successDevices = 0;
  let failedDevices = 0;

  for (const device of devices) {
    log(`------------------------------------------------------------------------`);
    log(`📡 [${device.id}] فحص الاتصال بالماكينة: "${device.name}" (${device.ip}:${device.port})...`);

    const isPrivate = device.ip.startsWith('192.168.') || device.ip.startsWith('10.') || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(device.ip);
    const testTimeout = isPrivate ? 8000 : 12000;

    const testRes = await testDeviceConnection(device.ip, device.port, testTimeout);

    if (!testRes.success) {
      failedDevices++;
      log(`⚠️ تعذر الاتصال بهذه الماكينة: ${testRes.message}`);
      if (isPrivate) {
        log(`💡 ملاحظة: هذه ماكينة داخلية (LAN)؛ يجب أن يكون الكمبيوتر متصلاً بنفس شبكة الراوتر في المقر.`);
      }
      writeLog(`❌ فشل الاتصال بالماكينة [${device.name}] (${device.ip}): ${testRes.message}`);
      db.prepare(`
        UPDATE biometric_devices 
        SET last_sync_at = datetime('now', 'localtime'),
            last_sync_status = 'error'
        WHERE id = ?
      `).run(device.id);
      continue;
    }

    successDevices++;
    log(`✅ متصلة بنجاح!`);
    if (testRes.info) {
      log(`📊 إجمالي حركات الماكينة: ${testRes.info.logCounts?.toLocaleString() || 'غير معروف'} | الموظفون: ${testRes.info.userCounts || 0}`);
    }

    log(`📥 جاري سحب أحدث الحركات المطابقة لموظفي الشركة...`);
    try {
      const logsResult = await fetchDeviceAttendances(
        device.ip,
        device.port,
        35000,
        device.protocol || 'tcp',
        { ignoreDateRange: false }
      );

      const logs = logsResult.logs || [];
      log(`📋 تم فحص (${logs.length}) حركة بصمة حديثة.`);

      if (logs.length > 0) {
        // Group logs by employee_code + date
        const grouped = new Map();
        for (const l of logs) {
          const key = `${l.employee_code}_${l.date}`;
          if (!grouped.has(key)) {
            grouped.set(key, {
              employee_code: l.employee_code,
              date: l.date,
              times: []
            });
          }
          grouped.get(key).times.push(l.time);
        }

        let deviceSyncedDays = 0;
        let deviceSkippedPunches = 0;

        db.transaction(() => {
          for (const [key, item] of grouped.entries()) {
            const rawCode = String(item.employee_code).trim();
            const rawNum = parseInt(rawCode, 10);
            const emp = empMap.get(rawCode) || (!isNaN(rawNum) ? empNumMap.get(rawNum) : null);

            if (!emp) {
              deviceSkippedPunches += item.times.length;
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
            deviceSyncedDays++;
          }

          db.prepare(`
            UPDATE biometric_devices 
            SET last_sync_at = datetime('now', 'localtime'),
                last_sync_status = 'success'
            WHERE id = ?
          `).run(device.id);
        })();

        totalNewDays += deviceSyncedDays;
        totalNewPunches += logs.length;

        log(`✓ تم تسجيل/تحديث ${deviceSyncedDays} يوم حضور بنجاح لموظفي هذه الماكينة.`);
        if (deviceSkippedPunches > 0) {
          log(`ℹ️ تم استبعاد ${deviceSkippedPunches} حركة لأشخاص غير مسجلين في جدول موظفي الشركة.`);
        }
        writeLog(`✅ تم سحب الماكينة [${device.name}] (${device.ip}): ${deviceSyncedDays} يوم حضور مسجل.`);
      } else {
        log(`ℹ️ لا توجد حركات جديدة في هذه الماكينة.`);
        db.prepare(`
          UPDATE biometric_devices 
          SET last_sync_at = datetime('now', 'localtime'),
              last_sync_status = 'success'
          WHERE id = ?
        `).run(device.id);
      }
    } catch (fetchErr) {
      log(`⚠️ خطأ أثناء سحب حركات الماكينة: ${fetchErr.message}`);
      writeLog(`⚠️ خطأ أثناء سحب حركات [${device.name}]: ${fetchErr.message}`);
    }
  }

  log(`\n========================================================================`);
  log(`📊 ملخص المزامنة: نجحت (${successDevices}/${devices.length}) ماكينة | إجمالي الأيام المحدثة: ${totalNewDays}`);
  log(`========================================================================\n`);

  // Cloud Sync to Supabase
  log('☁️ جاري المزامنة السحابية الفورية مع Supabase...');
  try {
    const syncRes = await syncDatabase(db);
    if (syncRes.success) {
      log(`⚡ تمت المزامنة السحابية بنجاح في ${syncRes.elapsedMs}ms!`);

      // Notify Vercel server to pull immediately
      try {
        log('📡 جاري إشعار السيرفر السحابي (Vercel) لتحديث البصمات فوراً...');
        await fetch('https://payroll-erp-rho.vercel.app/api/sync/pull', { 
          method: 'POST',
          signal: AbortSignal.timeout(8000)
        });
        log('✅ تم إشعار السيرفر السحابي بنجاح!');
      } catch (notifyErr) {}

      log('🌐 أصبحت بيانات الحضور متاحة ومحدثة 24/7 على:');
      log('   - https://company-payroll-erp-2026.web.app');
      log('   - https://payroll-erp-rho.vercel.app');
      writeLog(`⚡ اكتملت المزامنة السحابية بنجاح: ${totalNewDays} يوم عمل، ${successDevices}/${devices.length} ماكينة.`);
    } else {
      log('⚠️ تنبيه أثناء المزامنة السحابية:', syncRes.reason || syncRes.error);
      writeLog(`⚠️ تنبيه المزامنة السحابية: ${syncRes.reason || syncRes.error}`);
    }
  } catch (syncErr) {
    log('⚠️ خطأ في المزامنة السحابية:', syncErr.message);
    writeLog(`❌ خطأ في المزامنة السحابية: ${syncErr.message}`);
  }

  log('\n🎉 اكتملت الدورة بنجاح 100%!');
}

main().catch(err => {
  console.error('\n❌ خطأ غير متوقع:', err.message);
  writeLog(`❌ خطأ عام: ${err.message}`);
  process.exit(1);
});
