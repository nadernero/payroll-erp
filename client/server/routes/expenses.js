import express from 'express';
import db from '../db.js';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { pushToSupabase, ensureFreshData } from '../supabaseSync.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// 1. Get expenses for specific month and year
router.get('/', (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || (new Date().getMonth() + 1);

    // Get all active employees with their recorded expenses for this month
    const employeesWithExpenses = db.prepare(`
      SELECT 
        e.id as employee_id,
        e.seq,
        e.code as employee_code,
        e.name as employee_name,
        e.department,
        e.job_title,
        COALESCE(m.id, 0) as expense_id,
        COALESCE(m.amount_day_10, 0) as amount_day_10,
        COALESCE(m.amount_day_20, 0) as amount_day_20,
        COALESCE(m.total_amount, 0) as total_amount,
        COALESCE(m.notes, '') as notes
      FROM employees e
      LEFT JOIN mid_month_expenses m 
        ON e.id = m.employee_id AND m.year = ? AND m.month = ?
      WHERE e.status = 'active'
      ORDER BY e.seq ASC, CAST(e.code AS INTEGER) ASC
    `).all(year, month);

    // Calculate totals
    const totalDay10 = employeesWithExpenses.reduce((sum, item) => sum + item.amount_day_10, 0);
    const totalDay20 = employeesWithExpenses.reduce((sum, item) => sum + item.amount_day_20, 0);
    const grandTotal = totalDay10 + totalDay20;

    res.json({
      year,
      month,
      totalDay10,
      totalDay20,
      grandTotal,
      items: employeesWithExpenses
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Save / update employee expenses
router.post('/save', async (req, res) => {
  try {
    const { year, month, items } = req.body;
    if (!year || !month || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'البيانات غير مكتملة' });
    }

    const stmt = db.prepare(`
      INSERT INTO mid_month_expenses (
        year, month, employee_id, employee_code, employee_name,
        amount_day_10, amount_day_20, total_amount, notes
      ) VALUES (
        @year, @month, @employee_id, @employee_code, @employee_name,
        @amount_day_10, @amount_day_20, @total_amount, @notes
      )
      ON CONFLICT(year, month, employee_id) DO UPDATE SET
        amount_day_10 = excluded.amount_day_10,
        amount_day_20 = excluded.amount_day_20,
        total_amount = excluded.total_amount,
        notes = excluded.notes
    `);

    const runSave = db.transaction(() => {
      items.forEach(item => {
        const d10 = Number(item.amount_day_10) || 0;
        const d20 = Number(item.amount_day_20) || 0;
        const total = d10 + d20;

        stmt.run({
          year: Number(year),
          month: Number(month),
          employee_id: item.employee_id,
          employee_code: item.employee_code,
          employee_name: item.employee_name,
          amount_day_10: d10,
          amount_day_20: d20,
          total_amount: total,
          notes: item.notes || ''
        });
      });
    });

    runSave();

    for (const item of items) {
      try {
        const saved = db.prepare('SELECT * FROM mid_month_expenses WHERE year = ? AND month = ? AND employee_id = ?').get(Number(year), Number(month), item.employee_id);
        if (saved) await pushToSupabase('mid_month_expenses', saved);
      } catch (e) {}
    }

    res.json({ success: true, message: 'تم حفظ المصروفات وربطها بالموظفين وتحديث الراتب بنجاح' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Export Monthly Expenses to Excel without recipient columns
router.get('/export/excel', (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || (new Date().getMonth() + 1);

    const rows = db.prepare(`
      SELECT 
        e.seq as 'م',
        e.code as 'كود الموظف',
        e.name as 'اسم الموظف',
        e.department as 'القسم',
        COALESCE(m.amount_day_10, 0) as 'مصروف يوم 10 (ج.م)',
        COALESCE(m.amount_day_20, 0) as 'مصروف يوم 20 (ج.م)',
        COALESCE(m.total_amount, 0) as 'إجمالي المصروفات (خصم المرتب)',
        COALESCE(m.notes, '') as 'ملاحظات'
      FROM employees e
      LEFT JOIN mid_month_expenses m 
        ON e.id = m.employee_id AND m.year = ? AND m.month = ?
      WHERE e.status = 'active'
      ORDER BY e.seq ASC, CAST(e.code AS INTEGER) ASC
    `).all(year, month);

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `مصروفات_${year}_${month}`);

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename="expenses_${year}_${month}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
