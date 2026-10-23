import express from 'express';
import db from '../db.js';

const router = express.Router();

// 1. Employee Login (by Code + PIN or first-time PIN Setup)
router.post('/login', (req, res) => {
  try {
    const { code, pin, password } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'برجاء إدخال كود الموظف' });
    }

    const emp = db.prepare("SELECT * FROM employees WHERE (code = ? OR phone = ?) AND status = 'active'").get(String(code).trim(), String(code).trim());
    if (!emp) {
      return res.status(404).json({ error: 'كود الموظف غير مسجل أو غير مفعل في النظام' });
    }

    // 1. If employee does not have a PIN code yet -> Prompt setup
    if (!emp.pin_code) {
      const { password: _, pin_code: __, ...safeEmp } = emp;
      return res.json({
        success: false,
        needPinSetup: true,
        message: 'أهلاً بك! يرجى إنشاء رمز سري (PIN) من 4 أرقام لحسابك لأول مرة',
        employee: safeEmp
      });
    }

    // 2. If PIN was provided -> Validate PIN
    if (pin !== undefined && pin !== null && String(pin).trim() !== '') {
      const enteredPin = String(pin).trim();
      if (emp.pin_code !== enteredPin) {
        return res.status(401).json({ error: 'رمز المرور السري (PIN) غير صحيح' });
      }

      const { password: _, pin_code: __, ...employeeData } = emp;
      return res.json({
        success: true,
        message: 'تم تسجيل الدخول بنجاح',
        employee: employeeData
      });
    }

    // 3. If password was provided (legacy / admin override)
    if (password) {
      const matchPassword = emp.password === password.trim();
      const matchNationalId = emp.national_id && emp.national_id.trim() === password.trim();
      const matchCode = emp.code === password.trim();
      if (matchPassword || matchNationalId || matchCode) {
        const { password: _, pin_code: __, ...employeeData } = emp;
        return res.json({
          success: true,
          message: 'تم تسجيل الدخول بنجاح',
          employee: employeeData
        });
      }
    }

    // 4. Employee has PIN but didn't provide it yet
    const { password: _, pin_code: __, ...safeEmp } = emp;
    return res.json({
      success: false,
      needPin: true,
      message: 'يرجى إدخال رمز الـ PIN المكون من 4 أرقام',
      employee: safeEmp
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 1.1 Set / Create Employee PIN (First time setup or self reset)
router.post('/setup-pin', (req, res) => {
  try {
    const { employee_id, pin_code, phone } = req.body;
    if (!employee_id) return res.status(400).json({ error: 'معرف الموظف مطلوب' });

    const pinStr = String(pin_code || '').trim();
    if (!/^\d{4}$/.test(pinStr)) {
      return res.status(400).json({ error: 'رمز الـ PIN يجب أن يتكون من 4 أرقام بالضبط (مثلاً: 1234)' });
    }

    const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(employee_id);
    if (!emp) return res.status(404).json({ error: 'الموظف غير موجود' });

    const phoneStr = phone ? String(phone).trim() : emp.phone;

    db.prepare('UPDATE employees SET pin_code = ?, phone = ? WHERE id = ?').run(
      pinStr,
      phoneStr || null,
      emp.id
    );

    const updated = db.prepare('SELECT * FROM employees WHERE id = ?').get(emp.id);
    const { password: _, pin_code: __, ...employeeData } = updated;

    res.json({
      success: true,
      message: 'تم تعيين رمز الـ PIN بنجاح، مرحباً بك في بوابتك!',
      employee: employeeData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Employee Portal Dashboard Summary
router.get('/summary/:employeeId', (req, res) => {
  try {
    const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.employeeId);
    if (!emp) return res.status(404).json({ error: 'الموظف غير موجود' });

    // Annual leave balance & taken days
    const currentYear = new Date().getFullYear();
    const takenLeaves = db.prepare(`
      SELECT COALESCE(SUM(days_count), 0) as total_taken
      FROM leaves 
      WHERE employee_id = ? AND leave_type = 'سنوية' AND status = 'approved' AND strftime('%Y', start_date) = ?
    `).get(emp.id, String(currentYear)).total_taken;

    const remainingLeaves = Math.max(0, emp.annual_leave_balance - takenLeaves);

    // Loans balance & installments
    const loans = db.prepare(`
      SELECT * FROM loans WHERE employee_id = ? AND status = 'active' ORDER BY id DESC
    `).all(emp.id);

    const totalLoansRemaining = loans.reduce((s, l) => s + l.remaining_amount, 0);
    const activeMonthlyInstallment = loans.reduce((s, l) => s + l.monthly_installment, 0);

    // Recent Mid-Month Expenses (Day 10 & 20 received from Treasury)
    const midMonthExpenses = db.prepare(`
      SELECT * FROM mid_month_expenses 
      WHERE employee_id = ? 
      ORDER BY year DESC, month DESC 
      LIMIT 12
    `).all(emp.id);

    // Latest payslips
    const payslips = db.prepare(`
      SELECT 
        p.*,
        r.year,
        r.month,
        r.title as run_title,
        r.payroll_date
      FROM payroll_items p
      JOIN payroll_runs r ON p.payroll_run_id = r.id
      WHERE p.employee_id = ?
      ORDER BY r.year DESC, r.month DESC
      LIMIT 12
    `).all(emp.id);

    // My submitted requests
    const requests = db.prepare(`
      SELECT * FROM employee_requests 
      WHERE employee_id = ? 
      ORDER BY id DESC LIMIT 20
    `).all(emp.id);

    res.json({
      employee: {
        id: emp.id,
        seq: emp.seq,
        name: emp.name,
        code: emp.code,
        national_id: emp.national_id,
        insurance_no: emp.insurance_no,
        job_title: emp.job_title,
        department: emp.department,
        basic_salary: emp.basic_salary,
        actual_salary: emp.actual_salary,
        annual_leave_balance: emp.annual_leave_balance,
        phone: emp.phone
      },
      leaves: {
        total_balance: emp.annual_leave_balance,
        taken_days: takenLeaves,
        remaining_balance: remainingLeaves
      },
      loans: {
        active_loans: loans,
        total_remaining: totalLoansRemaining,
        monthly_installment: activeMonthlyInstallment
      },
      mid_month_expenses: midMonthExpenses,
      latest_payslip: payslips[0] || null,
      payslips_history: payslips,
      requests
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Submit request (Leave or Overtime)
router.post('/requests', (req, res) => {
  try {
    const { employee_id, request_type, title, date_from, date_to, quantity, details } = req.body;

    const emp = db.prepare('SELECT id, code, name, annual_leave_balance FROM employees WHERE id = ?').get(employee_id);
    if (!emp) return res.status(404).json({ error: 'الموظف غير موجود' });

    if (!request_type || !title) {
      return res.status(400).json({ error: 'نوع الطلب وعنوانه مطلوبان' });
    }

    // Validation for annual leave remaining balance
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
          error: `لا يمكن تقديم طلب إجازة (${requestedDays} يوم) يتجاوز رصيد إجازاتك السنوية المتبقي (${remaining} يوم).` 
        });
      }
    }

    const stmt = db.prepare(`
      INSERT INTO employee_requests (
        employee_id, employee_code, employee_name,
        request_type, title, date_from, date_to, quantity, details, status,
        manager_status, submitted_by
      ) VALUES (
        @employee_id, @employee_code, @employee_name,
        @request_type, @title, @date_from, @date_to, @quantity, @details, 'pending_manager',
        'pending', 'employee'
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
      details: details || ''
    });

    const newReq = db.prepare('SELECT * FROM employee_requests WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newReq);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
