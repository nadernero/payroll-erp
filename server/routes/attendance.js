import express from 'express';
import db from '../db.js';
import multer from 'multer';
import * as XLSX from 'xlsx';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Helper to convert Excel decimal time or string to HH:MM format
export function formatExcelTime(val) {
  if (val === null || val === undefined || val === '') return '';
  
  if (typeof val === 'number') {
    // If it's a fractional day (like 0.37013888888888885)
    let fraction = val % 1;
    if (fraction === 0 && val >= 1 && val <= 24) {
      return `${String(Math.floor(val)).padStart(2, '0')}:00`;
    }
    const totalSeconds = Math.round(fraction * 86400);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  const str = String(val).trim();
  const num = parseFloat(str);
  // Check if string is a decimal number like "0.37013888888888885"
  if (!isNaN(num) && num > 0 && num < 1 && !str.includes(':')) {
    const totalSeconds = Math.round(num * 86400);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  return str;
}

// Helper to parse delay minutes
export function formatDelayMinutes(val) {
  if (!val) return 0;
  if (typeof val === 'number') {
    if (val < 1 && val > 0) {
      return Math.round(val * 1440); // fraction of day to minutes
    }
    return Math.round(val);
  }
  const num = parseFloat(val);
  if (!isNaN(num)) {
    if (num < 1 && num > 0 && !String(val).includes(':')) {
      return Math.round(num * 1440);
    }
    return Math.round(num);
  }
  return 0;
}

// 1. Get attendance with filters and auto-linked leaves check, expanding calendar days so no day is missing
router.get('/', async (req, res) => {
  try {
    if (process.env.VERCEL) {
      try {
        const { ensureAttendanceFresh } = await import('../app.js');
        if (ensureAttendanceFresh) await ensureAttendanceFresh();
      } catch (e) {}
    }
    const { year, month, startDate, endDate, employeeCode, department } = req.query;
    let query = `
      SELECT 
        a.*,
        e.annual_leave_balance,
        COALESCE(a.overtime_days, CASE WHEN a.overtime_hours > 0 THEN ROUND(a.overtime_hours / 8.0, 1) ELSE 0 END) as overtime_days_calculated
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE 1=1
    `;
    const params = [];

    let startD = startDate;
    let endD = endDate;

    if (!startD && !endD) {
      if (year && month) {
        const mStr = String(month).padStart(2, '0');
        startD = `${year}-${mStr}-01`;
        const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
        endD = `${year}-${mStr}-${String(daysInMonth).padStart(2, '0')}`;
      }
    } else {
      if (!startD && year && month) {
        const mStr = String(month).padStart(2, '0');
        startD = `${year}-${mStr}-01`;
      }
      if (!endD && year && month) {
        const mStr = String(month).padStart(2, '0');
        const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
        endD = `${year}-${mStr}-${String(daysInMonth).padStart(2, '0')}`;
      }
    }

    if (startD && endD) {
      query += ' AND a.date BETWEEN ? AND ?';
      params.push(startD, endD);
    } else if (startD) {
      query += ' AND a.date >= ?';
      params.push(startD);
    } else if (endD) {
      query += ' AND a.date <= ?';
      params.push(endD);
    } else if (year && month) {
      const formattedMonth = String(month).padStart(2, '0');
      query += ` AND strftime('%Y-%m', a.date) = ?`;
      params.push(`${year}-${formattedMonth}`);
    }

    if (employeeCode) {
      query += ' AND a.employee_code = ?';
      params.push(String(employeeCode).trim());
    }

    if (department && department !== 'all') {
      query += ' AND a.department = ?';
      params.push(department);
    }

    query += ' ORDER BY a.date DESC, CAST(a.employee_code AS INTEGER) ASC LIMIT 2500';
    const records = db.prepare(query).all(...params);

    // Fetch approved leaves map to cross check
    const leaves = db.prepare(`
      SELECT employee_id, start_date, end_date, leave_type, status, days_count 
      FROM leaves 
      WHERE status = 'approved'
    `).all();

    // Fetch official holidays
    const officialHolidays = db.prepare('SELECT holiday_date, name FROM official_holidays').all();
    const holidayMap = new Map();
    officialHolidays.forEach(h => holidayMap.set(h.holiday_date, h.name));

    // Check taken leaves so far for balances
    const takenMap = new Map();
    db.prepare(`
      SELECT employee_id, SUM(days_count) as taken 
      FROM leaves 
      WHERE status = 'approved' AND leave_type = 'سنوية' 
      GROUP BY employee_id
    `).all().forEach(t => takenMap.set(t.employee_id, t.taken));

    const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    // Index existing records by `${employee_code}_${date}`
    const existingMap = new Map();
    for (const rec of records) {
      const matchingLeave = leaves.find(l => 
        l.employee_id === rec.employee_id && 
        rec.date >= l.start_date && 
        rec.date <= l.end_date
      );

      const holidayName = holidayMap.get(rec.date);
      const taken = takenMap.get(rec.employee_id) || 0;
      const remainingBalance = Math.max(0, (rec.annual_leave_balance || 21) - taken);
      const balancePermits = remainingBalance >= 1;

      let finalStatus = rec.status;
      let isAnnual = rec.is_annual_leave;
      let isHoliday = rec.is_holiday === 1 || !!holidayName;

      if (matchingLeave) {
        finalStatus = `إجازة ${matchingLeave.leave_type}`;
        if (matchingLeave.leave_type === 'سنوية') isAnnual = 1;
      } else if (holidayName && (!rec.status || rec.status === 'حاضر' && !rec.check_in && !rec.check_out)) {
        finalStatus = `إجازة رسمية (${holidayName})`;
      }

      const d = new Date(rec.date);
      const dayName = rec.day_name || (isNaN(d.getDay()) ? '' : arabicDays[d.getDay()]);
      const isWeekend = (dayName === 'الجمعة' || dayName === 'الأحد');

      const hasPunch = !!rec.check_in || !!rec.check_out;
      const isAbsent = rec.is_absent === 1 || (rec.absence_days > 0) || (finalStatus && finalStatus.includes('غياب'));
      const isLeave = isAnnual === 1 || (finalStatus && (finalStatus.includes('إجازة') || finalStatus.includes('مأمورية')));
      const isOfficialHoliday = isHoliday || (finalStatus && finalStatus.includes('رسمية'));

      const isPendingDecision = !hasPunch && !isAbsent && !isLeave && !isOfficialHoliday && !isWeekend;

      const processedItem = {
        ...rec,
        day_name: dayName,
        check_in: formatExcelTime(rec.check_in),
        check_out: formatExcelTime(rec.check_out),
        status: finalStatus,
        is_annual_leave: isAnnual,
        is_holiday: isOfficialHoliday ? 1 : 0,
        is_weekend: isWeekend && !hasPunch && !isAbsent ? 1 : 0,
        holiday_name: holidayName || null,
        has_approved_leave: !!matchingLeave,
        remaining_balance: remainingBalance,
        balance_permits: balancePermits,
        is_unexcused_missing: isPendingDecision,
        is_pending_decision: isPendingDecision,
        overtime_days: rec.overtime_days_calculated
      };

      existingMap.set(`${String(rec.employee_code).trim()}_${rec.date}`, processedItem);
    }

    // Now, expand calendar days for target employees so NO DAY IS MISSING
    let targetEmployeesQuery = "SELECT id, code, name, department, annual_leave_balance FROM employees WHERE status = 'active'";
    const empQueryParams = [];
    if (employeeCode) {
      targetEmployeesQuery += " AND code = ?";
      empQueryParams.push(String(employeeCode).trim());
    } else if (department && department !== 'all') {
      targetEmployeesQuery += " AND department = ?";
      empQueryParams.push(department);
    }
    targetEmployeesQuery += " ORDER BY seq ASC, CAST(code AS INTEGER) ASC";
    const targetEmployees = db.prepare(targetEmployeesQuery).all(...empQueryParams);

    const dateList = [];
    if (startD && endD) {
      const [sy, sm, sd] = startD.split('-').map(Number);
      const [ey, em, ed] = endD.split('-').map(Number);
      const cur = new Date(sy, sm - 1, sd, 12, 0, 0);
      const stop = new Date(ey, em - 1, ed, 12, 0, 0);
      while (cur <= stop) {
        const yr = cur.getFullYear();
        const mo = String(cur.getMonth() + 1).padStart(2, '0');
        const da = String(cur.getDate()).padStart(2, '0');
        dateList.push(`${yr}-${mo}-${da}`);
        cur.setDate(cur.getDate() + 1);
      }
    }

    const allCombined = [];

    for (const emp of targetEmployees) {
      const empCodeStr = String(emp.code).trim();
      const taken = takenMap.get(emp.id) || 0;
      const remainingBalance = Math.max(0, (emp.annual_leave_balance || 21) - taken);
      const balancePermits = remainingBalance >= 1;

      for (const dStr of dateList) {
        const key = `${empCodeStr}_${dStr}`;
        if (existingMap.has(key)) {
          allCombined.push(existingMap.get(key));
        } else {
          // Generate missing calendar day
          const d = new Date(dStr);
          const dayName = arabicDays[d.getDay()] || '';
          const holidayName = holidayMap.get(dStr);
          const matchingLeave = leaves.find(l => 
            l.employee_id === emp.id && 
            dStr >= l.start_date && 
            dStr <= l.end_date
          );

          let status = 'بدون بصمة (غير مسجل)';
          let isHoliday = false;
          let isAnnual = 0;
          let isWeekend = (dayName === 'الجمعة' || dayName === 'الأحد');

          if (matchingLeave) {
            status = `إجازة ${matchingLeave.leave_type}`;
            if (matchingLeave.leave_type === 'سنوية') isAnnual = 1;
          } else if (holidayName) {
            status = `إجازة رسمية (${holidayName})`;
            isHoliday = true;
          } else if (isWeekend) {
            status = `إجازة أسبوعية (${dayName})`;
          }

          const isPending = !isHoliday && !matchingLeave && !isWeekend;

          allCombined.push({
            id: 0,
            employee_id: emp.id,
            employee_code: emp.code,
            employee_name: emp.name,
            department: emp.department || 'عام',
            date: dStr,
            day_name: dayName,
            check_in: '',
            check_out: '',
            status,
            is_absent: 0,
            absence_days: 0,
            overtime_days: 0,
            is_annual_leave: isAnnual,
            is_holiday: isHoliday ? 1 : 0,
            is_weekend: isWeekend ? 1 : 0,
            holiday_name: holidayName || null,
            has_approved_leave: !!matchingLeave,
            remaining_balance: remainingBalance,
            balance_permits: balancePermits,
            is_unexcused_missing: isPending,
            is_pending_decision: isPending,
            is_virtual: true
          });
        }
      }
    }

    if (dateList.length === 0) {
      allCombined.push(...Array.from(existingMap.values()));
    }

    // Sort chronologically descending: newest date first, then employee code
    allCombined.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return parseInt(a.employee_code, 10) - parseInt(b.employee_code, 10);
    });

    res.json(allCombined);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get monthly attendance summary per employee (in days for payroll)
router.get('/summary', async (req, res) => {
  try {
    if (process.env.VERCEL) {
      try {
        const { ensureAttendanceFresh } = await import('../app.js');
        if (ensureAttendanceFresh) await ensureAttendanceFresh();
      } catch (e) {}
    }
    const { year, month } = req.query;
    if (!year || !month) {
      return res.status(400).json({ error: 'السنة والشهر مطلوبان' });
    }

    const formattedMonth = `${year}-${String(month).padStart(2, '0')}`;
    const startOfYear = `${year}-01-01`;
    const endOfYear = `${year}-12-31`;

    // 1. Approved leaves taken this year
    const leavesTaken = db.prepare(`
      SELECT employee_id, SUM(days_count) as total_days
      FROM leaves
      WHERE start_date >= ? AND start_date <= ? AND status = 'approved' AND leave_type = 'سنوية'
      GROUP BY employee_id
    `).all(startOfYear, endOfYear);
    const leavesMap = new Map();
    leavesTaken.forEach(l => leavesMap.set(l.employee_id, l.total_days));

    // 2. Active loans remaining balance
    const loansRemaining = db.prepare(`
      SELECT employee_id, SUM(remaining_amount) as total_remaining
      FROM loans
      WHERE status = 'active'
      GROUP BY employee_id
    `).all();
    const loanMap = new Map();
    loansRemaining.forEach(l => loanMap.set(l.employee_id, l.total_remaining));

    const summary = db.prepare(`
      SELECT 
        e.id as employee_id,
        e.code as employee_code,
        e.name as employee_name,
        e.department,
        e.annual_leave_balance,
        COUNT(CASE WHEN a.status = 'حاضر' OR (a.check_in IS NOT NULL AND a.check_in != '') THEN 1 END) as present_days,
        SUM(CASE 
          WHEN (a.is_absent = 1 OR a.status LIKE '%غياب%') THEN COALESCE(a.absence_days, 1.0)
          ELSE 0.0 
        END) as absent_days,
        SUM(COALESCE(a.overtime_days, CASE WHEN a.overtime_hours > 0 THEN ROUND(a.overtime_hours / 8.0, 1) ELSE 0 END)) as total_overtime_days,
        COUNT(CASE WHEN a.is_annual_leave = 1 OR a.status LIKE '%سنوي%' THEN 1 END) as annual_leave_days,
        COUNT(CASE WHEN a.is_overnight = 1 THEN 1 END) as overnight_days
      FROM employees e
      LEFT JOIN attendance a ON e.code = a.employee_code AND strftime('%Y-%m', a.date) = ?
      GROUP BY e.id
      ORDER BY e.seq ASC, CAST(e.code AS INTEGER) ASC
    `).all(formattedMonth);

    const enriched = summary.map(row => {
      const taken = leavesMap.get(row.employee_id) || 0;
      const remLeaves = Math.max(0, (row.annual_leave_balance || 21) - taken);
      const remLoan = loanMap.get(row.employee_id) || 0;

      return {
        ...row,
        absent_days: row.absent_days || 0,
        total_overtime_days: row.total_overtime_days || 0,
        remaining_annual_leave_balance: remLeaves,
        remaining_loan_balance: remLoan
      };
    });

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Record / update single day attendance
router.post('/record', (req, res) => {
  try {
    const {
      employee_code, date, day_name, status, check_in, check_out,
      late_minutes, early_leave_minutes, overtime_days, absence_days,
      is_absent, is_annual_leave, is_overnight, notes
    } = req.body;

    const emp = db.prepare('SELECT id, name, department, annual_leave_balance FROM employees WHERE code = ?').get(employee_code);
    if (!emp) {
      return res.status(404).json({ error: `الموظف ذو الكود ${employee_code} غير موجود` });
    }

    // Minimum overtime is 0.5 day
    let otDays = Number(overtime_days) || 0;
    if (otDays > 0 && otDays < 0.5) {
      otDays = 0.5;
    }

    let absDays = Number(absence_days) || 0;
    const isAbsentVal = is_absent ? 1 : (status && status.includes('غياب') ? 1 : 0);
    if (isAbsentVal && absDays <= 0) {
      absDays = 1.0;
    }

    const formattedIn = formatExcelTime(check_in);
    const formattedOut = formatExcelTime(check_out);
    const formattedLate = formatDelayMinutes(late_minutes);

    const stmt = db.prepare(`
      INSERT INTO attendance (
        employee_id, employee_code, employee_name, department, date, day_name,
        status, check_in, check_out, late_minutes, early_leave_minutes,
        overtime_hours, overtime_days, absence_days, is_absent, is_annual_leave, is_overnight, notes
      ) VALUES (
        @employee_id, @employee_code, @employee_name, @department, @date, @day_name,
        @status, @check_in, @check_out, @late_minutes, @early_leave_minutes,
        @overtime_hours, @overtime_days, @absence_days, @is_absent, @is_annual_leave, @is_overnight, @notes
      )
      ON CONFLICT(employee_code, date) DO UPDATE SET
        status = excluded.status,
        check_in = excluded.check_in,
        check_out = excluded.check_out,
        late_minutes = excluded.late_minutes,
        early_leave_minutes = excluded.early_leave_minutes,
        overtime_hours = excluded.overtime_hours,
        overtime_days = excluded.overtime_days,
        absence_days = excluded.absence_days,
        is_absent = excluded.is_absent,
        is_annual_leave = excluded.is_annual_leave,
        is_overnight = excluded.is_overnight,
        notes = excluded.notes
    `);

    stmt.run({
      employee_id: emp.id,
      employee_code,
      employee_name: emp.name,
      department: emp.department,
      date,
      day_name: day_name || '',
      status: status || (isAbsentVal ? 'غياب' : 'حاضر'),
      check_in: formattedIn,
      check_out: formattedOut,
      late_minutes: formattedLate,
      early_leave_minutes: Number(early_leave_minutes) || 0,
      overtime_hours: otDays * 8,
      overtime_days: otDays,
      absence_days: absDays,
      is_absent: isAbsentVal,
      is_annual_leave: is_annual_leave ? 1 : (status && status.includes('سنوي') ? 1 : 0),
      is_overnight: is_overnight ? 1 : 0,
      notes: notes || ''
    });

    res.json({ success: true, message: 'تم حفظ تسجيل حركة الحضور بنجاح' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Update specific attendance record by ID
router.put('/:id', (req, res) => {
  try {
    const {
      status, check_in, check_out, late_minutes,
      overtime_days, absence_days, is_absent, is_annual_leave, is_overnight, notes
    } = req.body;

    const existing = db.prepare('SELECT * FROM attendance WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'السجل غير موجود' });

    let otDays = overtime_days !== undefined ? Number(overtime_days) : (existing.overtime_days || (existing.overtime_hours / 8));
    if (otDays > 0 && otDays < 0.5) otDays = 0.5;

    let absDays = absence_days !== undefined ? Number(absence_days) : existing.absence_days;
    let isAbsentVal = is_absent !== undefined ? (is_absent ? 1 : 0) : existing.is_absent;
    if (status && status.includes('غياب')) {
      isAbsentVal = 1;
      if (absDays <= 0) absDays = 1.0;
    }

    db.prepare(`
      UPDATE attendance SET
        status = COALESCE(?, status),
        check_in = ?,
        check_out = ?,
        late_minutes = ?,
        overtime_days = ?,
        overtime_hours = ?,
        absence_days = ?,
        is_absent = ?,
        is_annual_leave = ?,
        is_overnight = ?,
        notes = ?
      WHERE id = ?
    `).run(
      status,
      formatExcelTime(check_in !== undefined ? check_in : existing.check_in),
      formatExcelTime(check_out !== undefined ? check_out : existing.check_out),
      formatDelayMinutes(late_minutes !== undefined ? late_minutes : existing.late_minutes),
      otDays,
      otDays * 8,
      absDays,
      isAbsentVal,
      is_annual_leave !== undefined ? (is_annual_leave ? 1 : 0) : existing.is_annual_leave,
      is_overnight !== undefined ? (is_overnight ? 1 : 0) : existing.is_overnight,
      notes !== undefined ? notes : existing.notes,
      req.params.id
    );

    res.json({ success: true, message: 'تم تحديث سجل الحضور بنجاح' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4.1 Quick decision on missing/unexcused or weekly-off days (Upsert)
router.post('/quick-decision', (req, res) => {
  try {
    const { employee_code, date, decisionType, notes } = req.body;
    if (!employee_code || !date || !decisionType) {
      return res.status(400).json({ error: 'كود الموظف والتاريخ ونوع الإجراء مطلوبان' });
    }

    const emp = db.prepare('SELECT id, code, name, department FROM employees WHERE code = ?').get(String(employee_code).trim());
    if (!emp) return res.status(404).json({ error: 'الموظف غير مسجل' });

    const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const d = new Date(date);
    const dayName = arabicDays[d.getDay()] || '';

    let status = 'حاضر';
    let is_absent = 0;
    let absence_days = 0;
    let is_annual_leave = 0;
    let is_holiday = 0;
    let check_in = '';
    let check_out = '';

    if (decisionType === 'absence') {
      status = 'غياب بدون إذن';
      is_absent = 1;
      absence_days = 1.0;
    } else if (decisionType === 'holiday') {
      status = notes ? `إجازة رسمية (${notes})` : 'إجازة رسمية';
      is_holiday = 1;
    } else if (decisionType === 'weekend') {
      status = `إجازة أسبوعية (${dayName})`;
    } else if (decisionType === 'annual') {
      status = 'إجازة سنوية';
      is_annual_leave = 1;
    } else if (decisionType === 'present') {
      status = 'حاضر';
      check_in = '08:00';
      check_out = '16:00';
    }

    const upsertStmt = db.prepare(`
      INSERT INTO attendance (
        employee_id, employee_code, employee_name, department, date, day_name,
        status, check_in, check_out, is_absent, absence_days, is_annual_leave, is_holiday, notes
      ) VALUES (
        @employee_id, @employee_code, @employee_name, @department, @date, @day_name,
        @status, @check_in, @check_out, @is_absent, @absence_days, @is_annual_leave, @is_holiday, @notes
      )
      ON CONFLICT(employee_code, date) DO UPDATE SET
        status = excluded.status,
        check_in = CASE WHEN excluded.check_in != '' THEN excluded.check_in ELSE attendance.check_in END,
        check_out = CASE WHEN excluded.check_out != '' THEN excluded.check_out ELSE attendance.check_out END,
        is_absent = excluded.is_absent,
        absence_days = excluded.absence_days,
        is_annual_leave = excluded.is_annual_leave,
        is_holiday = excluded.is_holiday,
        notes = COALESCE(excluded.notes, attendance.notes)
    `);

    upsertStmt.run({
      employee_id: emp.id,
      employee_code: emp.code,
      employee_name: emp.name,
      department: emp.department || 'عام',
      date,
      day_name: dayName,
      status,
      check_in,
      check_out,
      is_absent,
      absence_days,
      is_annual_leave,
      is_holiday,
      notes: notes || ''
    });

    res.json({
      success: true,
      message: `تم اعتماد اليوم (${date} - ${dayName}) كـ [${status}] للموظف ${emp.name} بنجاح`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Bulk assign overtime days to multiple attendance records or employees
router.post('/bulk-overtime', (req, res) => {
  try {
    const { recordIds, overtime_days = 1.0, notes } = req.body;
    if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
      return res.status(400).json({ error: 'لم يتم تحديد أي سجلات حضور' });
    }

    let otDays = Number(overtime_days);
    if (isNaN(otDays) || otDays < 0.5) otDays = 0.5;

    const stmt = db.prepare(`
      UPDATE attendance SET
        overtime_days = ?,
        overtime_hours = ? * 8,
        notes = CASE WHEN ? != '' THEN ? ELSE notes END
      WHERE id = ?
    `);

    const updateTransaction = db.transaction(() => {
      for (const id of recordIds) {
        stmt.run(otDays, otDays, notes || '', notes || '', id);
      }
    });

    updateTransaction();

    res.json({
      success: true,
      message: `تم تسجيل إضافي (${otDays} يوم) لعدد ${recordIds.length} موظف بنجاح`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Bulk assign absence days (0.5 or 1 or custom) to multiple records
router.post('/bulk-absence', (req, res) => {
  try {
    const { recordIds, absence_days = 1.0, notes } = req.body;
    if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
      return res.status(400).json({ error: 'لم يتم تحديد أي سجلات حضور' });
    }

    let absDays = Number(absence_days);
    if (isNaN(absDays) || absDays <= 0) absDays = 1.0;

    const statusText = absDays === 0.5 ? 'غياب نصف يوم' : 'غياب';

    const stmt = db.prepare(`
      UPDATE attendance SET
        status = ?,
        is_absent = 1,
        absence_days = ?,
        notes = CASE WHEN ? != '' THEN ? ELSE notes END
      WHERE id = ?
    `);

    const updateTransaction = db.transaction(() => {
      for (const id of recordIds) {
        stmt.run(statusText, absDays, notes || '', notes || '', id);
      }
    });

    updateTransaction();

    res.json({
      success: true,
      message: `تم تسجيل غياب (${absDays} يوم) لعدد ${recordIds.length} موظف بنجاح`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6.1. Bulk assign annual leave to multiple records or employees
router.post('/bulk-annual-leave', (req, res) => {
  try {
    const { recordIds, employeeCodes, date, days_count = 1.0, notes } = req.body;
    const days = Number(days_count) || 1.0;

    let targetRecords = [];
    if (recordIds && Array.isArray(recordIds) && recordIds.length > 0) {
      targetRecords = db.prepare(`SELECT * FROM attendance WHERE id IN (${recordIds.map(() => '?').join(',')})`).all(...recordIds);
    } else if (employeeCodes && Array.isArray(employeeCodes) && employeeCodes.length > 0 && date) {
      for (const code of employeeCodes) {
        let rec = db.prepare('SELECT * FROM attendance WHERE employee_code = ? AND date = ?').get(code, date);
        if (!rec) {
          const emp = db.prepare('SELECT * FROM employees WHERE code = ?').get(code);
          if (emp) {
            const ins = db.prepare(`
              INSERT INTO attendance (employee_id, employee_code, employee_name, department, date, status, is_annual_leave, is_absent, absence_days)
              VALUES (?, ?, ?, ?, ?, 'إجازة سنوية', 1, 0, 0)
            `).run(emp.id, emp.code, emp.name, emp.department, date);
            rec = db.prepare('SELECT * FROM attendance WHERE id = ?').get(ins.lastInsertRowid);
          }
        }
        if (rec) targetRecords.push(rec);
      }
    }

    if (targetRecords.length === 0) {
      return res.status(400).json({ error: 'لم يتم العثور على سجلات أو موظفين للتنفيذ' });
    }

    const updateAttStmt = db.prepare(`
      UPDATE attendance SET
        status = 'إجازة سنوية',
        is_annual_leave = 1,
        is_absent = 0,
        absence_days = 0,
        notes = CASE WHEN ? != '' THEN ? ELSE notes END
      WHERE id = ?
    `);

    const insertLeaveStmt = db.prepare(`
      INSERT INTO leaves (employee_id, employee_code, employee_name, leave_type, start_date, end_date, days_count, reason, status)
      VALUES (?, ?, ?, 'سنوية', ?, ?, ?, ?, 'approved')
    `);

    const leaveTx = db.transaction(() => {
      for (const r of targetRecords) {
        updateAttStmt.run(notes || 'إجازة سنوية معتمدة', notes || 'إجازة سنوية معتمدة', r.id);
        insertLeaveStmt.run(
          r.employee_id,
          r.employee_code,
          r.employee_name,
          r.date,
          r.date,
          days,
          notes || 'إجازة سنوية جماعية'
        );
      }
    });

    leaveTx();

    res.json({
      success: true,
      message: `تم بنجاح تسجيل إجازة سنوية لعدد ${targetRecords.length} موظف وخصمها من الرصيد السنوي.`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Delete specific attendance record by ID
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM attendance WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'تم حذف حركة الحضور بنجاح' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Download Attendance Excel Template
router.get('/template/download', (req, res) => {
  try {
    const templateData = [
      {
        'القسم': 'عامل',
        'الكود': '369',
        'الاسم': 'ادوار صالح يودان جرجس',
        'التاريخ': '2026-09-01',
        'اليوم': 'الثلاثاء',
        'حضور': '08:00',
        'انصراف': '16:00',
        'تأخير': 0,
        'إ. مبكر': 0,
        'غياب': 0,
        'إضافي (أيام)': 0.5,
        'مبيت': 0,
        'سنوي': 0
      },
      {
        'القسم': 'عامل',
        'الكود': '429',
        'الاسم': 'اسحق محروس زكي',
        'التاريخ': '2026-09-01',
        'اليوم': 'الثلاثاء',
        'حضور': '',
        'انصراف': '',
        'تأخير': 0,
        'إ. مبكر': 0,
        'غياب': 1,
        'إضافي (أيام)': 0,
        'مبيت': 0,
        'سنوي': 0
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'قالب_الحضور');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="attendance_template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Preview & Import Attendance from Excel with time cleaning & day overtime
router.post('/import/preview', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'برجاء رفع ملف إكسيل للحضور' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

    if (rawRows.length < 2) {
      return res.status(400).json({ error: 'الملف فارغ أو غير منسق' });
    }

    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
      const row = rawRows[i].map(c => String(c || '').trim());
      if (row.some(c => c.includes('كود') || c.includes('الكود') || c.includes('التاريخ') || c.includes('حضور'))) {
        headerRowIdx = i;
        break;
      }
    }

    const headers = rawRows[headerRowIdx].map(c => String(c || '').trim());
    const dataRows = rawRows.slice(headerRowIdx + 1);

    const findCol = (terms) => headers.findIndex(h => terms.some(t => h.toLowerCase().includes(t.toLowerCase())));

    const deptIdx = findCol(['قسم', 'القسم']);
    const codeIdx = findCol(['كود', 'الكود']);
    const nameIdx = findCol(['اسم', 'الاسم', 'اسم الموظف']);
    const dateIdx = findCol(['تاريخ', 'التاريخ']);
    const dayIdx = findCol(['يوم', 'اليوم']);
    const inIdx = findCol(['حضور']);
    const outIdx = findCol(['انصراف']);
    const lateIdx = findCol(['تأخير']);
    const earlyIdx = findCol(['إ. مبكر', 'مبكر']);
    const absIdx = findCol(['غياب']);
    const otIdx = findCol(['إضافي', 'اضافي', 'إضافي (أيام)']);
    const overnightIdx = findCol(['مبيت']);
    const annualIdx = findCol(['سنوي']);

    const employeesMap = new Map();
    db.prepare('SELECT id, code, name, department, annual_leave_balance FROM employees').all().forEach(e => {
      employeesMap.set(String(e.code).trim(), e);
    });

    // Approved leaves for cross-checking
    const approvedLeaves = db.prepare(`SELECT employee_id, start_date, end_date, leave_type FROM leaves WHERE status = 'approved'`).all();

    const parsed = [];
    dataRows.forEach(row => {
      if (!row || row.length === 0) return;
      const code = codeIdx !== -1 ? String(row[codeIdx] || '').trim() : '';
      if (!code) return;

      const emp = employeesMap.get(code);
      let rawDate = dateIdx !== -1 ? row[dateIdx] : '';
      let dateStr = '';
      if (typeof rawDate === 'number') {
        const dateObj = new Date((rawDate - (25567 + 2)) * 86400 * 1000);
        dateStr = dateObj.toISOString().split('T')[0];
      } else if (rawDate) {
        dateStr = String(rawDate).trim().replace(/\//g, '-');
      }

      const formattedIn = inIdx !== -1 ? formatExcelTime(row[inIdx]) : '';
      const formattedOut = outIdx !== -1 ? formatExcelTime(row[outIdx]) : '';
      const formattedLate = lateIdx !== -1 ? formatDelayMinutes(row[lateIdx]) : 0;

      const isAbs = absIdx !== -1 && (row[absIdx] === 1 || String(row[absIdx]).includes('غياب') || String(row[absIdx]) === '1');
      const isAnnual = annualIdx !== -1 && (row[annualIdx] === 1 || String(row[annualIdx]).includes('سنوي') || String(row[annualIdx]) === '1');
      const isOver = overnightIdx !== -1 && (row[overnightIdx] === 1 || String(row[overnightIdx]) === '1');

      // Overtime in days: if >= 3 it's probably hours -> convert to days with min 0.5
      let otRaw = otIdx !== -1 ? (Number(row[otIdx]) || 0) : 0;
      let otDays = 0;
      if (otRaw > 0) {
        if (otRaw >= 3) {
          otDays = Math.round((otRaw / 8) * 2) / 2; // e.g. 4h -> 0.5 day
        } else {
          otDays = Math.max(0.5, Math.round(otRaw * 2) / 2);
        }
      }

      // Check approved leaves
      const matchingLeave = emp ? approvedLeaves.find(l => l.employee_id === emp.id && dateStr >= l.start_date && dateStr <= l.end_date) : null;

      let status = 'حاضر';
      if (matchingLeave) {
        status = `إجازة ${matchingLeave.leave_type}`;
      } else if (isAbs) {
        status = 'غياب';
      } else if (isAnnual) {
        status = 'إجازة سنوية';
      } else if (!formattedIn && !formattedOut) {
        status = 'غياب بدون إذن';
      }

      const isUnexcused = !formattedIn && !formattedOut && !matchingLeave && !isAnnual;

      parsed.push({
        employee_id: emp ? emp.id : null,
        employee_code: code,
        employee_name: emp ? emp.name : (nameIdx !== -1 ? String(row[nameIdx] || '') : 'غير مسجل'),
        department: emp ? emp.department : (deptIdx !== -1 ? String(row[deptIdx] || '') : ''),
        date: dateStr,
        day_name: dayIdx !== -1 ? String(row[dayIdx] || '') : '',
        check_in: formattedIn,
        check_out: formattedOut,
        late_minutes: formattedLate,
        early_leave_minutes: earlyIdx !== -1 ? (Number(row[earlyIdx]) || 0) : 0,
        overtime_days: otDays,
        is_absent: isAbs ? 1 : 0,
        is_annual_leave: isAnnual || (matchingLeave?.leave_type === 'سنوية') ? 1 : 0,
        is_overnight: isOver ? 1 : 0,
        status,
        is_unexcused_missing: isUnexcused,
        valid: !!emp && !!dateStr,
        error: !emp ? 'كود الموظف غير مسجل بالنظام' : (!dateStr ? 'التاريخ غير صحيح' : null)
      });
    });

    res.json({
      total: parsed.length,
      validCount: parsed.filter(p => p.valid).length,
      invalidCount: parsed.filter(p => !p.valid).length,
      items: parsed
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Confirm Attendance Import
router.post('/import/confirm', (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'لا توجد بيانات حضور لتأكيدها' });
    }

    const stmt = db.prepare(`
      INSERT INTO attendance (
        employee_id, employee_code, employee_name, department, date, day_name,
        status, check_in, check_out, late_minutes, early_leave_minutes,
        overtime_hours, overtime_days, is_absent, is_annual_leave, is_overnight, notes
      ) VALUES (
        @employee_id, @employee_code, @employee_name, @department, @date, @day_name,
        @status, @check_in, @check_out, @late_minutes, @early_leave_minutes,
        @overtime_hours, @overtime_days, @is_absent, @is_annual_leave, @is_overnight, @notes
      )
      ON CONFLICT(employee_code, date) DO UPDATE SET
        status = excluded.status,
        check_in = excluded.check_in,
        check_out = excluded.check_out,
        late_minutes = excluded.late_minutes,
        early_leave_minutes = excluded.early_leave_minutes,
        overtime_hours = excluded.overtime_hours,
        overtime_days = excluded.overtime_days,
        is_absent = excluded.is_absent,
        is_annual_leave = excluded.is_annual_leave,
        is_overnight = excluded.is_overnight
    `);

    let count = 0;
    const runAll = db.transaction(() => {
      items.forEach(item => {
        if (!item.employee_id || !item.date) return;
        const otDays = Number(item.overtime_days) || 0;
        stmt.run({
          employee_id: item.employee_id,
          employee_code: item.employee_code,
          employee_name: item.employee_name,
          department: item.department || '',
          date: item.date,
          day_name: item.day_name || '',
          status: item.status || 'حاضر',
          check_in: item.check_in || '',
          check_out: item.check_out || '',
          late_minutes: Number(item.late_minutes) || 0,
          early_leave_minutes: Number(item.early_leave_minutes) || 0,
          overtime_hours: otDays * 8,
          overtime_days: otDays,
          is_absent: item.is_absent ? 1 : 0,
          is_annual_leave: item.is_annual_leave ? 1 : 0,
          is_overnight: item.is_overnight ? 1 : 0,
          notes: ''
        });
        count++;
      });
    });

    runAll();
    res.json({ success: true, message: `تم حفظ ${count} سجل حضور بنجاح!` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
