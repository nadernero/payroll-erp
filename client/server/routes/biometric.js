import express from 'express';
import db from '../db.js';
import { testDeviceConnection, fetchDeviceAttendances } from '../biometricService.js';
import { pushToSupabase, deleteFromSupabase, ensureFreshData } from '../supabaseSync.js';

const router = express.Router();

// 1. Get all registered biometric devices
router.get('/devices', async (req, res) => {
  try {
    if (process.env.VERCEL) {
      try { await ensureFreshData(db); } catch (e) {}
    }
    const devices = db.prepare('SELECT * FROM biometric_devices ORDER BY id ASC').all();
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Add new biometric device
router.post('/devices', async (req, res) => {
  try {
    const { name, ip, port, protocol, timeout, location } = req.body;
    if (!name || !ip) {
      return res.status(400).json({ error: 'اسم الماكينة وعنوان IP مطلوبان' });
    }

    const stmt = db.prepare(`
      INSERT INTO biometric_devices (name, ip, port, protocol, timeout, location)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      name,
      ip.trim(),
      Number(port) || 4370,
      protocol || 'udp',
      Number(timeout) || 5000,
      location || ''
    );

    const device = db.prepare('SELECT * FROM biometric_devices WHERE id = ?').get(result.lastInsertRowid);
    if (device) {
      try { await pushToSupabase('biometric_devices', device); } catch (e) {}
    }
    res.status(201).json(device);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Update biometric device
router.put('/devices/:id', async (req, res) => {
  try {
    const { name, ip, port, protocol, timeout, location, status } = req.body;
    const existing = db.prepare('SELECT * FROM biometric_devices WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'الماكينة غير موجودة' });

    db.prepare(`
      UPDATE biometric_devices SET
        name = COALESCE(?, name),
        ip = COALESCE(?, ip),
        port = COALESCE(?, port),
        protocol = COALESCE(?, protocol),
        timeout = COALESCE(?, timeout),
        location = COALESCE(?, location),
        status = COALESCE(?, status)
      WHERE id = ?
    `).run(
      name,
      ip ? ip.trim() : null,
      port ? Number(port) : null,
      protocol,
      timeout ? Number(timeout) : null,
      location,
      status,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM biometric_devices WHERE id = ?').get(req.params.id);
    if (updated) {
      try { await pushToSupabase('biometric_devices', updated); } catch (e) {}
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Delete biometric device
router.delete('/devices/:id', async (req, res) => {
  try {
    db.prepare('DELETE FROM biometric_devices WHERE id = ?').run(req.params.id);
    try { await deleteFromSupabase('biometric_devices', req.params.id); } catch (e) {}
    res.json({ success: true, message: 'تم حذف الماكينة بنجاح' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Test connection to device
router.post('/test', async (req, res) => {
  try {
    const { ip, port, timeout, protocol, deviceId } = req.body;
    let targetIp = ip;
    let targetPort = port || 4370;
    let targetTimeout = timeout || 5000;
    let targetProtocol = protocol || 'udp';

    if (deviceId && (!targetIp || !targetPort)) {
      const dev = db.prepare('SELECT * FROM biometric_devices WHERE id = ?').get(deviceId);
      if (dev) {
        targetIp = dev.ip;
        targetPort = dev.port;
        targetTimeout = dev.timeout;
        targetProtocol = dev.protocol;
      }
    }

    if (!targetIp) {
      return res.status(400).json({ error: 'عنوان IP مطلوب للتجربة' });
    }

    const testRes = await testDeviceConnection(targetIp, targetPort, targetTimeout, targetProtocol);
    res.json(testRes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Preview attendance from device before saving
router.post('/preview', async (req, res) => {
  try {
    const { deviceId, employeeCode, startDate, endDate, ignoreDateRange } = req.body;
    const device = db.prepare('SELECT * FROM biometric_devices WHERE id = ?').get(deviceId);
    if (!device) return res.status(404).json({ error: 'الماكينة المحددة غير موجودة' });

    const logsResult = await fetchDeviceAttendances(
      device.ip,
      device.port,
      Math.max(Number(device.timeout) || 45000, 45000),
      device.protocol || 'tcp',
      { employeeCode, startDate, endDate, ignoreDateRange }
    );

    // Preload employees map with string and number keys
    const employees = db.prepare('SELECT id, code, name, department FROM employees').all();
    const empMap = new Map();
    const empNumMap = new Map();
    employees.forEach(e => {
      const codeStr = String(e.code).trim();
      empMap.set(codeStr, e);
      const num = parseInt(codeStr, 10);
      if (!isNaN(num)) empNumMap.set(num, e);
    });

    // Enrich logs with employee name, department and registration status
    let registeredCount = 0;
    let unregisteredCount = 0;

    const enrichedLogs = (logsResult.logs || []).map(log => {
      const rawCode = String(log.employee_code).trim();
      const rawNum = parseInt(rawCode, 10);
      const emp = empMap.get(rawCode) || (!isNaN(rawNum) ? empNumMap.get(rawNum) : null);

      if (emp) {
        registeredCount++;
        return {
          ...log,
          employee_name: emp.name,
          department: emp.department || 'عام',
          is_registered: true,
          employee_id: emp.id
        };
      } else {
        unregisteredCount++;
        return {
          ...log,
          employee_name: 'غير مسجل بالشركة (موظف خارجي)',
          department: 'خارجي',
          is_registered: false,
          employee_id: null
        };
      }
    });

    res.json({
      ...logsResult,
      logs: enrichedLogs,
      registeredLogsCount: registeredCount,
      unregisteredLogsCount: unregisteredCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Sync attendance logs from machine into the ERP database
// ONLY syncs employees whose code and name exist in the employees table, ignoring all others
router.post('/sync', async (req, res) => {
  try {
    const { deviceId, employeeCode, startDate, endDate, ignoreDateRange } = req.body;
    const device = db.prepare('SELECT * FROM biometric_devices WHERE id = ?').get(deviceId);
    if (!device) return res.status(404).json({ error: 'الماكينة المحددة غير موجودة' });

    const logsResult = await fetchDeviceAttendances(
      device.ip,
      device.port,
      Math.max(Number(device.timeout) || 45000, 45000),
      device.protocol || 'tcp',
      { employeeCode, startDate, endDate, ignoreDateRange }
    );

    const logs = logsResult.logs;
    if (logs.length === 0) {
      return res.json({
        success: true,
        message: logsResult.message || 'لا توجد حركات بصمة جديدة ضمن الفترة المحددة أو للموظف المختار',
        syncedRecordsCount: 0,
        skippedRecordsCount: 0,
        totalDeviceLogs: logsResult.totalDeviceLogs
      });
    }

    // Group logs by employee_code + date
    const grouped = new Map(); // key: `${code}_${date}`
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

    // Preload employees map with both string and integer keys
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
    const skippedCodes = new Set();

    const syncTransaction = db.transaction(() => {
      for (const [key, item] of grouped.entries()) {
        const rawCode = String(item.employee_code).trim();
        const rawNum = parseInt(rawCode, 10);
        const emp = empMap.get(rawCode) || (!isNaN(rawNum) ? empNumMap.get(rawNum) : null);
        
        // Strict filter: Ignore anyone whose code and name are NOT registered in employees table
        if (!emp) {
          skippedCount++;
          skippedCodes.add(rawCode);
          continue;
        }

        item.times.sort();
        const checkIn = item.times[0] || '';
        const checkOut = item.times.length > 1 ? item.times[item.times.length - 1] : '';

        const d = new Date(item.date);
        const dayName = arabicDays[d.getDay()] || '';

        upsertStmt.run({
          employee_id: emp.id,
          employee_code: emp.code,
          employee_name: emp.name,
          department: emp.department || 'عام',
          date: item.date,
          day_name: dayName,
          check_in: checkIn,
          check_out: checkOut
        });

        syncedCount++;
      }

      // Record sync time on device
      db.prepare(`
        UPDATE biometric_devices 
        SET last_sync_at = datetime('now', 'localtime'),
            last_sync_status = 'success'
        WHERE id = ?
      `).run(device.id);
    });

    syncTransaction();

    const skippedCodesList = Array.from(skippedCodes).slice(0, 10).join(', ');
    const skippedMsg = skippedCount > 0 
      ? ` (تم تجاهل واستبعاد ${skippedCount} حركة حضور لموظفين غير مسجلين بالنظام: [${skippedCodesList}${skippedCodes.size > 10 ? '...' : ''}])`
      : '';

    res.json({
      success: true,
      message: `تمت مزامنة ${syncedCount} يوم حضور بنجاح لموظفي الشركة المسجلين فقط من ماكينة (${device.name})${skippedMsg}`,
      syncedRecordsCount: syncedCount,
      skippedRecordsCount: skippedCount,
      totalDeviceLogs: logsResult.totalDeviceLogs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
