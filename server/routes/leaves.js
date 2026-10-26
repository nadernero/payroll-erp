import express from 'express';
import db from '../db.js';
import { pushToSupabase, deleteFromSupabase, ensureFreshData } from '../supabaseSync.js';

const router = express.Router();

// 1. Get leaves list
router.get('/', async (req, res) => {
  try {
    if (process.env.VERCEL) {
      try {
        const { ensureTableFresh } = await import('../supabaseSync.js');
        await ensureTableFresh(db, 'leaves', 15000);
      } catch (e) {}
    }
    const { employeeId, year } = req.query;
    let query = `
      SELECT l.*, e.department, e.job_title, e.annual_leave_balance
      FROM leaves l
      JOIN employees e ON l.employee_id = e.id
      WHERE 1=1
    `;
    const params = [];

    if (employeeId) {
      query += ' AND l.employee_id = ?';
      params.push(employeeId);
    }
    if (year) {
      query += " AND strftime('%Y', l.start_date) = ?";
      params.push(String(year));
    }

    query += ' ORDER BY l.start_date DESC';
    const leaves = db.prepare(query).all(...params);
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get leave balances for all employees
router.get('/balances', async (req, res) => {
  try {
    if (process.env.VERCEL) {
      try {
        const { ensureTableFresh } = await import('../supabaseSync.js');
        await ensureTableFresh(db, 'employees', 15000);
      } catch (e) {}
    }
    const currentYear = new Date().getFullYear();
    const rows = db.prepare(`
      SELECT 
        e.id,
        e.seq,
        e.code,
        e.name,
        e.department,
        e.job_title,
        e.annual_leave_balance as total_balance,
        COALESCE(SUM(CASE WHEN l.leave_type = 'سنوية' AND l.status = 'approved' AND strftime('%Y', l.start_date) = ? THEN l.days_count ELSE 0 END), 0) as taken_days
      FROM employees e
      LEFT JOIN leaves l ON e.id = l.employee_id
      WHERE e.status = 'active'
      GROUP BY e.id
      ORDER BY e.seq ASC, CAST(e.code AS INTEGER) ASC
    `).all(String(currentYear));

    const result = rows.map(r => ({
      ...r,
      remaining_balance: Math.max(0, r.total_balance - r.taken_days)
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Record an approved leave
router.post('/', async (req, res) => {
  try {
    const { employee_id, leave_type, start_date, end_date, days_count, reason } = req.body;

    if (!employee_id || !start_date || !end_date) {
      return res.status(400).json({ error: 'برجاء استكمال بيانات الإجازة' });
    }

    const emp = db.prepare('SELECT id, code, name FROM employees WHERE id = ?').get(employee_id);
    if (!emp) return res.status(404).json({ error: 'الموظف غير موجود' });

    const days = Number(days_count) || 1;

    const stmt = db.prepare(`
      INSERT INTO leaves (
        employee_id, employee_code, employee_name,
        leave_type, start_date, end_date, days_count,
        reason, status
      ) VALUES (
        @employee_id, @employee_code, @employee_name,
        @leave_type, @start_date, @end_date, @days_count,
        @reason, 'approved'
      )
    `);

    const result = stmt.run({
      employee_id: emp.id,
      employee_code: emp.code,
      employee_name: emp.name,
      leave_type: leave_type || 'سنوية',
      start_date,
      end_date,
      days_count: days,
      reason: reason || ''
    });

    const newLeave = db.prepare('SELECT * FROM leaves WHERE id = ?').get(result.lastInsertRowid);
    if (newLeave) {
      try { await pushToSupabase('leaves', newLeave); } catch (e) {}
    }
    res.status(201).json(newLeave);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Update an existing leave record
router.put('/:id', async (req, res) => {
  try {
    const { leave_type, start_date, end_date, days_count, reason, status } = req.body;
    const leave = db.prepare('SELECT * FROM leaves WHERE id = ?').get(req.params.id);
    if (!leave) return res.status(404).json({ error: 'سجل الإجازة غير موجود' });

    db.prepare(`
      UPDATE leaves SET
        leave_type = COALESCE(?, leave_type),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        days_count = COALESCE(?, days_count),
        reason = COALESCE(?, reason),
        status = COALESCE(?, status)
      WHERE id = ?
    `).run(
      leave_type,
      start_date,
      end_date,
      days_count !== undefined ? Number(days_count) : leave.days_count,
      reason,
      status,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM leaves WHERE id = ?').get(req.params.id);
    if (updated) {
      try { await pushToSupabase('leaves', updated); } catch (e) {}
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Update employee's total annual leave balance
router.put('/balances/:employeeId', async (req, res) => {
  try {
    const { annual_leave_balance } = req.body;
    if (annual_leave_balance === undefined) {
      return res.status(400).json({ error: 'الرصيد مطلوب' });
    }

    db.prepare('UPDATE employees SET annual_leave_balance = ? WHERE id = ?')
      .run(Number(annual_leave_balance), req.params.employeeId);

    const updatedEmp = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.employeeId);
    if (updatedEmp) {
      try { await pushToSupabase('employees', updatedEmp); } catch (e) {}
    }

    res.json({ success: true, message: 'تم تحديث رصيد الإجازات السنوية للموظف' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Delete a leave
router.delete('/:id', async (req, res) => {
  try {
    db.prepare('DELETE FROM leaves WHERE id = ?').run(req.params.id);
    try { await deleteFromSupabase('leaves', req.params.id); } catch (e) {}
    res.json({ success: true, message: 'تم حذف الإجازة وإعادة الرصيد' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
