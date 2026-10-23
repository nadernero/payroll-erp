import express from 'express';
import db from '../db.js';

const router = express.Router();

// 1. Get all loans
router.get('/', (req, res) => {
  try {
    const { status, search } = req.query;
    let query = `
      SELECT l.*, e.department, e.job_title
      FROM loans l
      JOIN employees e ON l.employee_id = e.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ' AND l.status = ?';
      params.push(status);
    }
    if (search) {
      query += ' AND (l.employee_name LIKE ? OR l.employee_code LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY l.id DESC';
    const loans = db.prepare(query).all(...params);
    res.json(loans);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get loans for specific employee
router.get('/employee/:employeeId', (req, res) => {
  try {
    const loans = db.prepare('SELECT * FROM loans WHERE employee_id = ? ORDER BY id DESC').all(req.params.employeeId);
    res.json(loans);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Create a new loan
router.post('/', (req, res) => {
  try {
    const { employee_id, total_amount, months_count, start_date, notes } = req.body;

    if (!employee_id || !total_amount || !months_count || !start_date) {
      return res.status(400).json({ error: 'برجاء ملء جميع الحقول المطلوبة' });
    }

    const emp = db.prepare('SELECT id, code, name FROM employees WHERE id = ?').get(employee_id);
    if (!emp) {
      return res.status(404).json({ error: 'الموظف غير موجود' });
    }

    const amount = Number(total_amount);
    const months = parseInt(months_count, 10);
    const installment = Math.round((amount / months) * 100) / 100;

    // Calculate end_date from start_date (YYYY-MM)
    const [startYear, startMonth] = start_date.split('-').map(Number);
    const endDateObj = new Date(startYear, (startMonth - 1) + (months - 1), 1);
    const endYear = endDateObj.getFullYear();
    const endMonth = String(endDateObj.getMonth() + 1).padStart(2, '0');
    const end_date = `${endYear}-${endMonth}`;

    const stmt = db.prepare(`
      INSERT INTO loans (
        employee_id, employee_code, employee_name,
        total_amount, months_count, monthly_installment,
        start_date, end_date, paid_installments,
        remaining_amount, status, notes
      ) VALUES (
        @employee_id, @employee_code, @employee_name,
        @total_amount, @months_count, @monthly_installment,
        @start_date, @end_date, 0,
        @remaining_amount, 'active', @notes
      )
    `);

    const result = stmt.run({
      employee_id: emp.id,
      employee_code: emp.code,
      employee_name: emp.name,
      total_amount: amount,
      months_count: months,
      monthly_installment: installment,
      start_date,
      end_date,
      remaining_amount: amount,
      notes: notes || ''
    });

    const newLoan = db.prepare('SELECT * FROM loans WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newLoan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Update full loan details (editing and recording installments)
router.put('/:id', (req, res) => {
  try {
    const { total_amount, months_count, start_date, paid_installments, status, notes } = req.body;
    const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
    if (!loan) return res.status(404).json({ error: 'السلفة غير موجودة' });

    const total = total_amount !== undefined ? Number(total_amount) : loan.total_amount;
    const months = months_count !== undefined ? parseInt(months_count, 10) : loan.months_count;
    const installment = Math.round((total / months) * 100) / 100;

    const startDate = start_date || loan.start_date;
    const [startYear, startMonth] = startDate.split('-').map(Number);
    const endDateObj = new Date(startYear, (startMonth - 1) + (months - 1), 1);
    const endYear = endDateObj.getFullYear();
    const endMonth = String(endDateObj.getMonth() + 1).padStart(2, '0');
    const endDate = `${endYear}-${endMonth}`;

    let paid = paid_installments !== undefined ? Number(paid_installments) : loan.paid_installments;
    const remaining = Math.max(0, total - (paid * installment));

    let finalStatus = status || loan.status;
    if (remaining <= 0) {
      finalStatus = 'completed';
    }

    db.prepare(`
      UPDATE loans SET
        total_amount = ?,
        months_count = ?,
        monthly_installment = ?,
        start_date = ?,
        end_date = ?,
        paid_installments = ?,
        remaining_amount = ?,
        status = ?,
        notes = ?
      WHERE id = ?
    `).run(
      total,
      months,
      installment,
      startDate,
      endDate,
      paid,
      Math.round(remaining * 100) / 100,
      finalStatus,
      notes !== undefined ? notes : loan.notes,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Delete loan
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM loans WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'تم حذف سجل السلفة بنجاح' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
