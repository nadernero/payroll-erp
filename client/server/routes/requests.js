import express from 'express';
import db from '../db.js';
import { pushToSupabase, deleteFromSupabase, ensureFreshData } from '../supabaseSync.js';

const router = express.Router();

// 1. Get all requests
router.get('/', (req, res) => {
  try {
    const { status, type } = req.query;
    let query = `
      SELECT r.*, e.department, e.job_title
      FROM employee_requests r
      JOIN employees e ON r.employee_id = e.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ' AND r.status = ?';
      params.push(status);
    }
    if (type && type !== 'all') {
      query += ' AND r.request_type = ?';
      params.push(type);
    }

    query += ' ORDER BY r.id DESC';
    const requests = db.prepare(query).all(...params);
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Warehouse Manager Action (approve to advance to admin, or reject)
router.put('/:id/manager-action', async (req, res) => {
  try {
    const { action, manager_notes } = req.body;
    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'الإجراء يجب أن يكون approved أو rejected' });
    }

    const request = db.prepare('SELECT * FROM employee_requests WHERE id = ?').get(req.params.id);
    if (!request) return res.status(404).json({ error: 'الطلب غير موجود' });

    const newStatus = action === 'approved' ? 'pending_admin' : 'rejected';
    db.prepare(`
      UPDATE employee_requests SET
        manager_status = ?,
        manager_notes = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(action, manager_notes || '', newStatus, req.params.id);

    const updated = db.prepare('SELECT * FROM employee_requests WHERE id = ?').get(req.params.id);
    if (updated) {
      try { await pushToSupabase('employee_requests', updated); } catch (e) {}
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2.1. Submit Request on Behalf of Driver/Worker by Warehouse Manager
router.post('/on-behalf', async (req, res) => {
  try {
    const { employee_id, request_type, title, date_from, date_to, quantity, details } = req.body;

    const emp = db.prepare('SELECT id, code, name, department, annual_leave_balance FROM employees WHERE id = ?').get(employee_id);
    if (!emp) return res.status(404).json({ error: 'الموظف غير موجود' });

    if (!request_type || !title) {
      return res.status(400).json({ error: 'نوع الطلب وعنوانه مطلوبان' });
    }

    // 1. Validation for annual leave remaining balance
    if (request_type === 'leave') {
      const initialBal = Number(emp.annual_leave_balance) || 21;
      const usedRow = db.prepare(`
        SELECT SUM(days_count) as used FROM leaves WHERE employee_id = ? AND status = 'approved' AND leave_type = 'سنوية'
      `).get(emp.id);
      const used = Number(usedRow?.used) || 0;
      const remaining = Math.max(0, initialBal - used);
      const requestedDays = Number(quantity) || 1;
      if (requestedDays > remaining) {
        return res.status(400).json({ 
          error: `لا يمكن تقديم طلب إجازة (${requestedDays} يوم) يتجاوز رصيد الإجازات السنوية المتبقي للعامل (${remaining} يوم).` 
        });
      }
    }

    // 2. Validation for deduction / penalty
    if (request_type === 'deduction') {
      const deductDays = Number(quantity);
      if (isNaN(deductDays) || deductDays < 0.5) {
        return res.status(400).json({ error: 'مقدار الخصم يجب أن يبدأ من نصف يوم (0.5) على الأقل' });
      }
      if (!details || !details.trim()) {
        return res.status(400).json({ error: 'سبب الخصم إلزامي ويجب توضيحه وكتابته بوضوح' });
      }
    }

    const defaultManagerNotes = request_type === 'deduction'
      ? `طلب خصم / جزاء (${quantity} يوم) مرفوع من مدير المخزن للاعتماد`
      : 'مقدم ومعتمد مبدئياً من مدير المخزن';

    const stmt = db.prepare(`
      INSERT INTO employee_requests (
        employee_id, employee_code, employee_name,
        request_type, title, date_from, date_to, quantity, details,
        status, manager_status, manager_notes, submitted_by, on_behalf_of
      ) VALUES (
        @employee_id, @employee_code, @employee_name,
        @request_type, @title, @date_from, @date_to, @quantity, @details,
        'pending_admin', 'approved', @manager_notes, 'مدير المخزن (نيابة عن الموظف)', 1
      )
    `);

    const result = stmt.run({
      employee_id: emp.id,
      employee_code: emp.code,
      employee_name: emp.name,
      request_type,
      title,
      date_from: date_from || '',
      date_to: date_to || date_from || '',
      quantity: Number(quantity) || 1,
      details: details || '',
      manager_notes: defaultManagerNotes
    });

    const newReq = db.prepare('SELECT * FROM employee_requests WHERE id = ?').get(result.lastInsertRowid);
    if (newReq) {
      try { await pushToSupabase('employee_requests', newReq); } catch (e) {}
    }
    res.status(201).json(newReq);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Admin Final Approve or Reject a request
router.put('/:id', async (req, res) => {
  try {
    const { status, admin_response } = req.body;
    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'الحالة يجب أن تكون approved أو rejected' });
    }

    const request = db.prepare('SELECT * FROM employee_requests WHERE id = ?').get(req.params.id);
    if (!request) return res.status(404).json({ error: 'الطلب غير موجود' });

    const updateTx = db.transaction(() => {
      db.prepare(`
        UPDATE employee_requests SET
          status = ?,
          admin_response = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(status, admin_response || '', req.params.id);

      // If approved, trigger corresponding actions
      if (status === 'approved') {
        if (request.request_type === 'leave') {
          // Insert into leaves table
          db.prepare(`
            INSERT INTO leaves (
              employee_id, employee_code, employee_name,
              leave_type, start_date, end_date, days_count,
              reason, status
            ) VALUES (?, ?, ?, 'سنوية', ?, ?, ?, ?, 'approved')
          `).run(
            request.employee_id,
            request.employee_code,
            request.employee_name,
            request.date_from || new Date().toISOString().split('T')[0],
            request.date_to || request.date_from || new Date().toISOString().split('T')[0],
            request.quantity || 1,
            request.title + ': ' + (request.details || '')
          );
        } else if (request.request_type === 'overtime') {
          // If date_from is set, record in attendance (in days, minimum 0.5 day)
          if (request.date_from) {
            const otDays = Math.max(0.5, Number(request.quantity) || 0.5);
            db.prepare(`
              INSERT INTO attendance (
                employee_id, employee_code, employee_name, department, date,
                status, overtime_hours, overtime_days, notes
              ) VALUES (?, ?, ?, 'عام', ?, 'حاضر', ?, ?, ?)
              ON CONFLICT(employee_code, date) DO UPDATE SET
                overtime_days = overtime_days + excluded.overtime_days,
                overtime_hours = overtime_hours + excluded.overtime_hours
            `).run(
              request.employee_id,
              request.employee_code,
              request.employee_name,
              request.date_from,
              otDays * 8,
              otDays,
              'إضافي معتمد: ' + request.title
            );
          }
        } else if (request.request_type === 'deduction') {
          // Record deduction in attendance and link to absence
          const deductDays = Math.max(0.5, Number(request.quantity) || 0.5);
          const targetDate = request.date_from || new Date().toISOString().split('T')[0];
          const deductStatus = deductDays === 0.5 ? 'خصم نصف يوم' : `خصم غياب (${deductDays} يوم)`;
          const deductNote = `خصم معتمد (${deductDays} يوم) - السبب: ${request.details || request.title}`;

          const existingAtt = db.prepare('SELECT id, absence_days, notes, status FROM attendance WHERE employee_code = ? AND date = ?').get(request.employee_code, targetDate);

          if (existingAtt) {
            const updatedAbsDays = (Number(existingAtt.absence_days) || 0) + deductDays;
            const combinedNotes = existingAtt.notes ? `${existingAtt.notes} | ${deductNote}` : deductNote;
            db.prepare(`
              UPDATE attendance SET
                absence_days = ?,
                is_absent = 1,
                status = ?,
                notes = ?
              WHERE id = ?
            `).run(updatedAbsDays, deductStatus, combinedNotes, existingAtt.id);
          } else {
            db.prepare(`
              INSERT INTO attendance (
                employee_id, employee_code, employee_name, department, date,
                status, is_absent, absence_days, notes
              ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
            `).run(
              request.employee_id,
              request.employee_code,
              request.employee_name,
              'إدارة المخازن',
              targetDate,
              deductStatus,
              deductDays,
              deductNote
            );
          }

          // If active payroll run exists for that month, also update it
          const monthStr = targetDate.slice(0, 7);
          const run = db.prepare("SELECT id FROM payroll_runs WHERE strftime('%Y-%m', payroll_date) = ? OR (printf('%04d-%02d', year, month) = ?)").get(monthStr, monthStr);
          if (run) {
            const pItem = db.prepare('SELECT id, absence_days, absence_day_value, notes FROM payroll_items WHERE payroll_run_id = ? AND employee_id = ?').get(run.id, request.employee_id);
            if (pItem) {
              const newAbsDays = (Number(pItem.absence_days) || 0) + deductDays;
              const newTotalAbs = Math.round(newAbsDays * (Number(pItem.absence_day_value) || 0));
              const newNotes = pItem.notes ? `${pItem.notes} | ${deductNote}` : deductNote;
              db.prepare(`
                UPDATE payroll_items SET
                  absence_days = ?,
                  total_absence = ?,
                  notes = ?
                WHERE id = ?
              `).run(newAbsDays, newTotalAbs, newNotes, pItem.id);
            }
          }
        }
      }
    });

    updateTx();

    const updated = db.prepare('SELECT * FROM employee_requests WHERE id = ?').get(req.params.id);
    if (updated) {
      try { await pushToSupabase('employee_requests', updated); } catch (e) {}
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
