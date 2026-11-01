import express from 'express';
import db from '../db.js';
import { pushToSupabase, deleteFromSupabase, ensureFreshData } from '../supabaseSync.js';

const router = express.Router();

const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

// 1. Get all official holidays
router.get('/', (req, res) => {
  try {
    const { year } = req.query;
    let query = 'SELECT * FROM official_holidays';
    const params = [];
    if (year) {
      query += ' WHERE year = ?';
      params.push(Number(year));
    }
    query += ' ORDER BY holiday_date ASC';
    const holidays = db.prepare(query).all(...params);
    res.json(holidays);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Add new official holiday
router.post('/', async (req, res) => {
  try {
    const { name, holiday_date, notes, autoApplyToAttendance } = req.body;
    if (!name || !holiday_date) {
      return res.status(400).json({ error: 'اسم الإجازة وتاريخها مطلوبان' });
    }

    const year = new Date(holiday_date).getFullYear();

    const stmt = db.prepare(`
      INSERT INTO official_holidays (name, holiday_date, year, notes)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(name.trim(), holiday_date.trim(), year, notes || 'إجازة رسمية مدفوعة الأجر');
    const newHoliday = db.prepare('SELECT * FROM official_holidays WHERE id = ?').get(result.lastInsertRowid);
    if (newHoliday) {
      try { await pushToSupabase('official_holidays', newHoliday); } catch (e) {}
    }

    // If auto-apply requested: mark/create attendance records for all active employees
    let appliedCount = 0;
    if (autoApplyToAttendance) {
      const activeEmployees = db.prepare("SELECT * FROM employees WHERE status = 'active'").all();
      const d = new Date(holiday_date);
      const dayName = arabicDays[d.getDay()] || '';

      const upsertStmt = db.prepare(`
        INSERT INTO attendance (
          employee_id, employee_code, employee_name, department, date, day_name,
          status, is_absent, is_holiday, notes
        ) VALUES (
          @employee_id, @employee_code, @employee_name, @department, @date, @day_name,
          @status, 0, 1, @notes
        )
        ON CONFLICT(employee_code, date) DO UPDATE SET
          status = excluded.status,
          is_absent = 0,
          is_holiday = 1,
          notes = excluded.notes
      `);

      const applyTxn = db.transaction(() => {
        for (const emp of activeEmployees) {
          upsertStmt.run({
            employee_id: emp.id,
            employee_code: emp.code,
            employee_name: emp.name,
            department: emp.department,
            date: holiday_date,
            day_name: dayName,
            status: `إجازة رسمية (${name.trim()})`,
            notes: notes || 'إجازة رسمية مدفوعة الأجر'
          });
          appliedCount++;
        }
      });
      applyTxn();

      for (const emp of activeEmployees) {
        try {
          const savedAtt = db.prepare('SELECT * FROM attendance WHERE employee_code = ? AND date = ?').get(emp.code, holiday_date);
          if (savedAtt) await pushToSupabase('attendance', savedAtt);
        } catch (e) {}
      }
    }

    res.status(201).json({
      holiday: newHoliday,
      appliedCount,
      message: `تم حفظ الإجازة الرسمية (${name}) بنجاح${appliedCount > 0 ? ` وتطبيقها على ${appliedCount} موظف` : ''}`
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'يوجد بالفعل إجازة رسمية مسجلة بنفس هذا التاريخ' });
    }
    res.status(500).json({ error: error.message });
  }
});

// 3. Update official holiday
router.put('/:id', async (req, res) => {
  try {
    const { name, holiday_date, notes } = req.body;
    const existing = db.prepare('SELECT * FROM official_holidays WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'الإجازة غير موجودة' });

    const newDate = holiday_date || existing.holiday_date;
    const year = new Date(newDate).getFullYear();

    db.prepare(`
      UPDATE official_holidays SET
        name = COALESCE(?, name),
        holiday_date = COALESCE(?, holiday_date),
        year = ?,
        notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(name ? name.trim() : null, holiday_date ? holiday_date.trim() : null, year, notes, req.params.id);

    const updated = db.prepare('SELECT * FROM official_holidays WHERE id = ?').get(req.params.id);
    if (updated) {
      try { await pushToSupabase('official_holidays', updated); } catch (e) {}
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Delete official holiday
router.delete('/:id', async (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM official_holidays WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'الإجازة غير موجودة' });

    db.prepare('DELETE FROM official_holidays WHERE id = ?').run(req.params.id);
    try { await deleteFromSupabase('official_holidays', req.params.id); } catch (e) {}
    res.json({ success: true, message: 'تم حذف الإجازة الرسمية بنجاح' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Apply all holidays of a year/month to attendance table
router.post('/apply-all', (req, res) => {
  try {
    const { year, month } = req.body;
    let query = 'SELECT * FROM official_holidays WHERE 1=1';
    const params = [];
    if (year) {
      query += ' AND year = ?';
      params.push(Number(year));
    }
    if (month) {
      const monthStr = String(month).padStart(2, '0');
      query += " AND strftime('%m', holiday_date) = ?";
      params.push(monthStr);
    }

    const holidays = db.prepare(query).all(...params);
    if (holidays.length === 0) {
      return res.json({ success: true, count: 0, message: 'لا توجد إجازات رسمية مسجلة لهذه الفترة' });
    }

    const activeEmployees = db.prepare("SELECT * FROM employees WHERE status = 'active'").all();
    let count = 0;

    const upsertStmt = db.prepare(`
      INSERT INTO attendance (
        employee_id, employee_code, employee_name, department, date, day_name,
        status, is_absent, is_holiday, notes
      ) VALUES (
        @employee_id, @employee_code, @employee_name, @department, @date, @day_name,
        @status, 0, 1, @notes
      )
      ON CONFLICT(employee_code, date) DO UPDATE SET
        status = excluded.status,
        is_absent = 0,
        is_holiday = 1,
        notes = excluded.notes
    `);

    const applyTxn = db.transaction(() => {
      for (const h of holidays) {
        const d = new Date(h.holiday_date);
        const dayName = arabicDays[d.getDay()] || '';
        for (const emp of activeEmployees) {
          upsertStmt.run({
            employee_id: emp.id,
            employee_code: emp.code,
            employee_name: emp.name,
            department: emp.department,
            date: h.holiday_date,
            day_name: dayName,
            status: `إجازة رسمية (${h.name})`,
            notes: h.notes || 'إجازة رسمية مدفوعة الأجر'
          });
          count++;
        }
      }
    });

    applyTxn();

    res.json({
      success: true,
      count,
      holidaysCount: holidays.length,
      message: `تم تطبيق ${holidays.length} إجازة رسمية على جميع الموظفين (${count} حركة حضور مسجلة كإجازة مدفوعة)`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
