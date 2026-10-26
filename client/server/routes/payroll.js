import express from 'express';
import db from '../db.js';
import * as XLSX from 'xlsx';
import { calculatePayrollItem, calculateEgyptianTaxAnnual } from '../payrollService.js';
import { pushToSupabase, deleteFromSupabase, ensureFreshData } from '../supabaseSync.js';

const router = express.Router();

// 1. Get all payroll runs
router.get('/runs', async (req, res) => {
  try {
    if (process.env.VERCEL) {
      try { await ensureFreshData(db); } catch (e) {}
    }
    const runs = db.prepare('SELECT * FROM payroll_runs ORDER BY year DESC, month DESC').all();
    res.json(runs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get single payroll run with all itemized employee rows
router.get('/runs/:id', (req, res) => {
  try {
    const run = db.prepare('SELECT * FROM payroll_runs WHERE id = ?').get(req.params.id);
    if (!run) return res.status(404).json({ error: 'كشف المرتبات غير موجود' });

    const items = db.prepare(`
      SELECT * FROM payroll_items 
      WHERE payroll_run_id = ? 
      ORDER BY seq ASC, CAST(employee_code AS INTEGER) ASC
    `).all(run.id);

    // Summary totals
    const totalEntitlement = items.reduce((s, i) => s + i.total_entitlement, 0);
    const totalOvertime = items.reduce((s, i) => s + i.total_overtime, 0);
    const totalBonuses = items.reduce((s, i) => s + i.total_bonuses, 0);
    const totalExpenses = items.reduce((s, i) => s + i.expenses, 0);
    const totalAbsence = items.reduce((s, i) => s + i.total_absence, 0);
    const totalPenalties = items.reduce((s, i) => s + i.total_penalties, 0);
    const totalInsurance = items.reduce((s, i) => s + i.social_insurance, 0);
    const totalTax = items.reduce((s, i) => s + i.tax, 0);
    const totalDeductions = items.reduce((s, i) => s + i.total_deductions, 0);
    const totalLoans = items.reduce((s, i) => s + i.loan_installment, 0);
    const totalNet = items.reduce((s, i) => s + i.net_salary, 0);

    res.json({
      run,
      summary: {
        employeesCount: items.length,
        totalEntitlement,
        totalOvertime,
        totalBonuses,
        totalExpenses,
        totalAbsence,
        totalPenalties,
        totalInsurance,
        totalTax,
        totalDeductions,
        totalLoans,
        totalNet
      },
      items
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Generate or recalculate payroll run for a specific month
router.post('/generate', (req, res) => {
  try {
    const { year, month } = req.body;
    if (!year || !month) {
      return res.status(400).json({ error: 'السنة والشهر مطلوبان' });
    }

    const y = Number(year);
    const m = Number(month);
    const monthStr = String(m).padStart(2, '0');
    const yyyyMm = `${y}-${monthStr}`;

    // Month names in Arabic
    const monthNames = [
      '', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    const monthTitle = `مرتبات شهر ${monthNames[m]} ${y}`;
    const payrollDate = `${y}-${monthStr}-${new Date(y, m, 0).getDate()}`;

    // Find or create payroll run
    let run = db.prepare('SELECT * FROM payroll_runs WHERE year = ? AND month = ?').get(y, m);
    if (!run) {
      const runStmt = db.prepare(`
        INSERT INTO payroll_runs (year, month, title, payroll_date, status)
        VALUES (?, ?, ?, ?, 'draft')
      `);
      const r = runStmt.run(y, m, monthTitle, payrollDate);
      run = db.prepare('SELECT * FROM payroll_runs WHERE id = ?').get(r.lastInsertRowid);
    }

    // Fetch active employees (excluding those marked as not eligible for payroll, e.g. Warehouse Manager or Board)
    const employees = db.prepare("SELECT * FROM employees WHERE status = 'active' AND (exclude_from_payroll = 0 OR exclude_from_payroll IS NULL) ORDER BY seq ASC, CAST(code AS INTEGER) ASC").all();

    // Fetch monthly attendance stats (in days, minimum 0.5 day)
    const attMap = new Map();
    const attRows = db.prepare(`
      SELECT 
        employee_code,
        SUM(CASE 
          WHEN absence_days IS NOT NULL THEN absence_days 
          WHEN is_absent = 1 OR status LIKE '%غياب%' THEN 1.0 
          ELSE 0.0 
        END) as absent_days,
        SUM(COALESCE(overtime_days, CASE WHEN overtime_hours > 0 THEN ROUND(overtime_hours / 8.0, 1) ELSE 0 END)) as total_overtime_days
      FROM attendance
      WHERE strftime('%Y-%m', date) = ?
      GROUP BY employee_code
    `).all(yyyyMm);
    attRows.forEach(a => attMap.set(String(a.employee_code).trim(), a));

    // Fetch mid-month expenses
    const expMap = new Map();
    const expRows = db.prepare(`
      SELECT employee_id, total_amount 
      FROM mid_month_expenses 
      WHERE year = ? AND month = ?
    `).all(y, m);
    expRows.forEach(e => expMap.set(e.employee_id, e.total_amount));

    // Fetch active loans installment for this month
    const loanMap = new Map();
    const loanRows = db.prepare(`
      SELECT employee_id, monthly_installment
      FROM loans
      WHERE status = 'active'
        AND start_date <= ?
        AND end_date >= ?
    `).all(yyyyMm, yyyyMm);
    loanRows.forEach(l => {
      const cur = loanMap.get(l.employee_id) || 0;
      loanMap.set(l.employee_id, cur + l.monthly_installment);
    });

    // Check existing item adjustments to preserve manual overrides if any
    const existingItemsMap = new Map();
    const existingItems = db.prepare('SELECT * FROM payroll_items WHERE payroll_run_id = ?').all(run.id);
    existingItems.forEach(i => existingItemsMap.set(i.employee_id, i));

    // Delete previous items for this run and insert fresh calculated items
    db.prepare('DELETE FROM payroll_items WHERE payroll_run_id = ?').run(run.id);

    const insertItem = db.prepare(`
      INSERT INTO payroll_items (
        payroll_run_id, employee_id, seq, department, employee_name, employee_code,
        national_id, insurance_no, job_title,
        basic_salary, actual_salary, insurance_basic,
        taxable_allowances, non_taxable_allowances, total_allowances,
        total_entitlement,
        overtime_day_value, overtime_days, total_overtime,
        bonus_days, total_bonuses, non_taxable_deductions,
        expenses,
        absence_day_value, absence_days, total_absence,
        penalty_days, total_penalties,
        social_insurance, medical_insurance, tax, total_deductions,
        loan_installment, gross_after_deductions, net_salary, notes,
        bonus_name, exempt_bonuses
      ) VALUES (
        @payroll_run_id, @employee_id, @seq, @department, @employee_name, @employee_code,
        @national_id, @insurance_no, @job_title,
        @basic_salary, @actual_salary, @insurance_basic,
        @taxable_allowances, @non_taxable_allowances, @total_allowances,
        @total_entitlement,
        @overtime_day_value, @overtime_days, @total_overtime,
        @bonus_days, @total_bonuses, @non_taxable_deductions,
        @expenses,
        @absence_day_value, @absence_days, @total_absence,
        @penalty_days, @total_penalties,
        @social_insurance, @medical_insurance, @tax, @total_deductions,
        @loan_installment, @gross_after_deductions, @net_salary, @notes,
        @bonus_name, @exempt_bonuses
      )
    `);

    const insertTransaction = db.transaction(() => {
      employees.forEach(emp => {
        const att = attMap.get(String(emp.code).trim()) || { absent_days: 0, total_overtime_days: 0 };
        const existing = existingItemsMap.get(emp.id);

        // Attendance sync: always reflect actual recorded attendance for this month
        let otDays = (att && att.total_overtime_days !== undefined)
          ? att.total_overtime_days
          : (existing ? existing.overtime_days : 0);
        if (otDays > 0 && otDays < 0.5) otDays = 0.5;

        let absDays = (att && att.absent_days !== undefined)
          ? att.absent_days
          : (existing ? existing.absence_days : 0);

        let penDays = existing ? existing.penalty_days : 0;
        let bonDays = existing ? existing.bonus_days : 0;
        let bonTotal = existing ? existing.total_bonuses : 0;
        let bonName = existing ? (existing.bonus_name || '') : '';
        let exemptBon = existing ? (existing.exempt_bonuses || 0) : 0;

        const expenses = expMap.get(emp.id) !== undefined ? expMap.get(emp.id) : (existing ? existing.expenses : 0);
        const loanInst = loanMap.get(emp.id) !== undefined ? loanMap.get(emp.id) : (existing ? existing.loan_installment : 0);

        // Calculate insurance (11% of insurance basic) and tax dynamically so that absence properly reduces taxable income
        const calc = calculatePayrollItem({
          basic_salary: emp.basic_salary,
          actual_salary: emp.actual_salary,
          insurance_basic: emp.insurance_basic,
          taxable_allowances: emp.taxable_allowances,
          non_taxable_allowances: emp.non_taxable_allowances,
          overtime_days: otDays,
          bonus_days: bonDays,
          total_bonuses: bonTotal,
          bonus_is_taxable: false, // المعاملة الضريبية: المكافآت معفاة
          absence_days: absDays,
          penalty_days: penDays,
          mid_month_expenses: expenses,
          loan_installment: loanInst,
          medical_insurance: (existing && existing.medical_insurance !== undefined) ? existing.medical_insurance : (emp.medical_insurance || 0),
          custom_insurance: null, // Always 11%
          custom_tax: null,       // Dynamically recalculate tax according to Egyptian law so absence reduces tax
          non_taxable_deductions: existing ? existing.non_taxable_deductions : 0
        });

        insertItem.run({
          payroll_run_id: run.id,
          employee_id: emp.id,
          seq: emp.seq,
          department: emp.department,
          employee_name: emp.name,
          employee_code: emp.code,
          national_id: emp.national_id,
          insurance_no: emp.insurance_no,
          job_title: emp.job_title,
          ...calc,
          bonus_name: bonName,
          exempt_bonuses: exemptBon,
          notes: existing ? existing.notes : ''
        });
      });
    });

    insertTransaction();

    try {
      const savedRun = db.prepare('SELECT * FROM payroll_runs WHERE id = ?').get(run.id);
      if (savedRun) await pushToSupabase('payroll_runs', savedRun);
      const items = db.prepare('SELECT * FROM payroll_items WHERE payroll_run_id = ?').all(run.id);
      for (const it of items) {
        await pushToSupabase('payroll_items', it);
      }
    } catch (e) {}

    res.json({ success: true, message: `تم احتساب كشف مرتبات ${monthTitle} بنجاح!`, runId: run.id });
  } catch (error) {
    console.error('Payroll generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Update individual payroll item (manual override by HR/Accountant)
router.put('/items/:id', async (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM payroll_items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'بند المرتب غير موجود' });

    const {
      overtime_days, bonus_days, total_bonuses, bonus_name,
      absence_days, penalty_days, expenses, medical_insurance,
      social_insurance, tax, loan_installment, non_taxable_deductions, notes
    } = req.body;

    const calc = calculatePayrollItem({
      basic_salary: item.basic_salary,
      actual_salary: item.actual_salary,
      insurance_basic: item.insurance_basic,
      taxable_allowances: item.taxable_allowances,
      non_taxable_allowances: item.non_taxable_allowances,
      overtime_days: overtime_days !== undefined ? overtime_days : item.overtime_days,
      bonus_days: bonus_days !== undefined ? bonus_days : item.bonus_days,
      total_bonuses: total_bonuses !== undefined ? total_bonuses : item.total_bonuses,
      bonus_is_taxable: false, // المعاملة الضريبية: المكافآت معفاة من الضريبة
      absence_days: absence_days !== undefined ? absence_days : item.absence_days,
      penalty_days: penalty_days !== undefined ? penalty_days : item.penalty_days,
      mid_month_expenses: expenses !== undefined ? expenses : item.expenses,
      medical_insurance: medical_insurance !== undefined ? medical_insurance : item.medical_insurance,
      loan_installment: loan_installment !== undefined ? loan_installment : item.loan_installment,
      custom_insurance: social_insurance !== undefined ? social_insurance : item.social_insurance,
      custom_tax: tax !== undefined ? tax : item.tax,
      non_taxable_deductions: non_taxable_deductions !== undefined ? non_taxable_deductions : item.non_taxable_deductions
    });

    db.prepare(`
      UPDATE payroll_items SET
        overtime_days = @overtime_days,
        total_overtime = @total_overtime,
        bonus_days = @bonus_days,
        total_bonuses = @total_bonuses,
        bonus_name = @bonus_name,
        absence_days = @absence_days,
        total_absence = @total_absence,
        penalty_days = @penalty_days,
        total_penalties = @total_penalties,
        expenses = @expenses,
        medical_insurance = @medical_insurance,
        social_insurance = @social_insurance,
        tax = @tax,
        total_deductions = @total_deductions,
        gross_after_deductions = @gross_after_deductions,
        loan_installment = @loan_installment,
        net_salary = @net_salary,
        notes = @notes
      WHERE id = @id
    `).run({
      id: req.params.id,
      ...calc,
      bonus_name: bonus_name !== undefined ? bonus_name : (item.bonus_name || ''),
      notes: notes !== undefined ? notes : item.notes
    });

    const updated = db.prepare('SELECT * FROM payroll_items WHERE id = ?').get(req.params.id);
    if (updated) {
      try { await pushToSupabase('payroll_items', updated); } catch (e) {}
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4.1. Bulk Grant Named Tax-Exempt Bonus to Selected Employees
router.post('/runs/:id/bulk-bonus', async (req, res) => {
  try {
    const { itemIds, bonusName, amount } = req.body;
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ error: 'يرجى تحديد موظف واحد على الأقل' });
    }
    const bonusVal = Number(amount);
    if (isNaN(bonusVal) || bonusVal <= 0) {
      return res.status(400).json({ error: 'يرجى إدخال مبلغ مكافأة صحيح' });
    }

    const run = db.prepare('SELECT * FROM payroll_runs WHERE id = ?').get(req.params.id);
    if (!run) return res.status(404).json({ error: 'كشف المرتبات غير موجود' });

    const updateItem = db.prepare(`
      UPDATE payroll_items SET
        total_bonuses = total_bonuses + @amount,
        bonus_name = CASE WHEN bonus_name IS NULL OR bonus_name = '' THEN @bonusName ELSE bonus_name || ' + ' || @bonusName END,
        gross_after_deductions = gross_after_deductions + @amount,
        net_salary = net_salary + @amount,
        notes = CASE WHEN notes IS NULL OR notes = '' THEN @bonusNote ELSE notes || ' | ' || @bonusNote END
      WHERE id = @id AND payroll_run_id = @runId
    `);

    const updateTx = db.transaction(() => {
      for (const id of itemIds) {
        updateItem.run({
          id,
          runId: run.id,
          amount: bonusVal,
          bonusName: bonusName || 'مكافأة معفاة',
          bonusNote: `مكافأة (${bonusName || 'معفاة'}): ${bonusVal} ج`
        });
      }
    });

    updateTx();

    for (const id of itemIds) {
      try {
        const it = db.prepare('SELECT * FROM payroll_items WHERE id = ?').get(id);
        if (it) await pushToSupabase('payroll_items', it);
      } catch (e) {}
    }

    res.json({
      success: true,
      message: `تم بنجاح منح مكافأة "${bonusName}" بقيمة ${bonusVal} ج لعدد ${itemIds.length} موظف بدون التأثير على وعاء الضريبة.`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4.2. Official Salary Statement (مفردات مرتب رسمية معتمدة)
router.get('/official-statement/:employeeId', (req, res) => {
  try {
    const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.employeeId);
    if (!emp) return res.status(404).json({ error: 'الموظف غير موجود' });

    // Official statement figures based ONLY on fixed contractual items:
    const basic = Number(emp.basic_salary) || 0;
    const taxableAllow = Number(emp.taxable_allowances) || 0;
    const nonTaxableAllow = Number(emp.non_taxable_allowances) || 0;
    const totalAllowances = taxableAllow + nonTaxableAllow;
    const totalGross = basic + totalAllowances;

    // Fixed social insurance (11% of insurance basic)
    const insBasic = Number(emp.insurance_basic) || basic;
    const socialInsurance = Math.round(insBasic * 0.11);

    // Fixed monthly tax calculation on contract base (no overtime, no variable bonuses)
    const personalExemptionMonthly = 20000 / 12;
    const taxableIncomeMonthly = Math.max(0, (basic + taxableAllow) - socialInsurance - personalExemptionMonthly);
    const annualizedTaxable = taxableIncomeMonthly * 12;
    const annualTax = calculateEgyptianTaxAnnual(annualizedTaxable);
    const monthlyTax = Math.round(annualTax / 12);

    const totalFixedDeductions = socialInsurance + monthlyTax;
    const netFixedSalary = totalGross - totalFixedDeductions;

    res.json({
      employee: {
        id: emp.id,
        code: emp.code,
        name: emp.name,
        department: emp.department,
        job_title: emp.job_title,
        national_id: emp.national_id,
        insurance_no: emp.insurance_no
      },
      earnings: {
        basic_salary: basic,
        taxable_allowances: taxableAllow,
        non_taxable_allowances: nonTaxableAllow,
        total_allowances: totalAllowances,
        total_gross: totalGross
      },
      deductions: {
        social_insurance: socialInsurance,
        income_tax: monthlyTax,
        total_deductions: totalFixedDeductions
      },
      net_salary: netFixedSalary,
      statement_date: new Date().toISOString().split('T')[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4.3. Combined Balances Report: Remaining Loans and Remaining Annual Leaves
router.get('/balances-report', (req, res) => {
  try {
    const employees = db.prepare('SELECT id, code, name, department, job_title, annual_leave_balance FROM employees ORDER BY CAST(code AS INTEGER) ASC').all();
    
    // Get taken annual leaves for each employee
    const leavesRows = db.prepare(`
      SELECT employee_id, SUM(days_count) as used_leaves
      FROM leaves 
      WHERE status = 'approved' AND leave_type = 'سنوية'
      GROUP BY employee_id
    `).all();
    const leavesMap = new Map();
    leavesRows.forEach(r => leavesMap.set(r.employee_id, r.used_leaves));

    // Get active loan balances for each employee
    const loanRows = db.prepare(`
      SELECT employee_id, 
             SUM(total_amount) as total_loan_amount,
             SUM(remaining_amount) as remaining_loan_amount,
             SUM(total_amount - remaining_amount) as paid_loan_amount
      FROM loans
      WHERE status = 'active'
      GROUP BY employee_id
    `).all();
    const loanMap = new Map();
    loanRows.forEach(r => loanMap.set(r.employee_id, r));

    const report = employees.map(emp => {
      const initialBal = Number(emp.annual_leave_balance) || 21;
      const usedLeaves = Number(leavesMap.get(emp.id)) || 0;
      const remainingLeaves = Math.max(0, initialBal - usedLeaves);

      const loanInfo = loanMap.get(emp.id) || { total_loan_amount: 0, remaining_loan_amount: 0, paid_loan_amount: 0 };

      return {
        id: emp.id,
        code: emp.code,
        name: emp.name,
        department: emp.department,
        job_title: emp.job_title,
        annual_leaves: {
          total_entitlement: initialBal,
          used_days: usedLeaves,
          remaining_days: remainingLeaves
        },
        loans: {
          total_amount: loanInfo.total_loan_amount,
          paid_amount: loanInfo.paid_loan_amount,
          remaining_amount: loanInfo.remaining_loan_amount
        }
      };
    });

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Export Payroll Run to Excel matching Image 1
router.get('/runs/:id/export/excel', (req, res) => {
  try {
    const run = db.prepare('SELECT * FROM payroll_runs WHERE id = ?').get(req.params.id);
    if (!run) return res.status(404).json({ error: 'الكشف غير موجود' });

    const items = db.prepare(`
      SELECT * FROM payroll_items 
      WHERE payroll_run_id = ? 
      ORDER BY seq ASC, CAST(employee_code AS INTEGER) ASC
    `).all(run.id);

    // Map columns matching Image 1 exactly:
    const exportData = items.map(i => ({
      'م': i.seq,
      'الضريبة والقسم': i.department,
      'إسم الموظف': i.employee_name,
      'كود': i.employee_code,
      'رقم البطاقة': i.national_id,
      'الرقم التأميني': i.insurance_no,
      'الوظيفة': i.job_title,
      'المرتب الأساسي': i.basic_salary,
      'مرتب مستحق': i.actual_salary,
      'اساسي تأمينات': i.insurance_basic,
      'البدلات الخاضعة للضريبة': i.taxable_allowances,
      'البدلات الغير خاضعة للضريبة': i.non_taxable_allowances,
      'إجمالي بدلات': i.total_allowances,
      'إجمالي استحقاق': i.total_entitlement,
      'قيمة اليوم الإضافي': i.overtime_day_value,
      'إجمالي المكافآت': i.total_bonuses,
      'المكافآت بالأيام': i.bonus_days,
      'اشتراكات غير خاضعة للضريبة': i.non_taxable_deductions,
      'مصروفات': i.expenses,
      'الغياب بالأيام': i.absence_days,
      'إجمالي الغياب': i.total_absence,
      'الجزاءات بالأيام': i.penalty_days,
      'إجمالي جزاءات': i.total_penalties,
      'تأمينات': i.social_insurance,
      'ضرائب': i.tax,
      'إجمالي إستقطاعات': i.total_deductions,
      'إجمالي المرتب': i.gross_after_deductions,
      'سلف مستحقة': i.loan_installment,
      'صافي المرتب': i.net_salary
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `مرتبات_${run.year}_${run.month}`);

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename="payroll_${run.year}_${run.month}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Get Comprehensive Payslip for an Employee (Full Breakdown matching Excel sheet)
router.get('/payslip/:employeeId/:runId', (req, res) => {
  try {
    const { employeeId, runId } = req.params;
    const run = db.prepare('SELECT * FROM payroll_runs WHERE id = ?').get(runId);
    if (!run) return res.status(404).json({ error: 'كشف المرتبات غير موجود' });

    const item = db.prepare('SELECT * FROM payroll_items WHERE employee_id = ? AND payroll_run_id = ?').get(employeeId, runId);
    if (!item) return res.status(404).json({ error: 'بيانات الراتب غير متوفرة لهذا الشهر' });

    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId);

    // Fetch month's daily attendance records
    const yyyyMm = `${run.year}-${String(run.month).padStart(2, '0')}`;
    const attendanceLogs = db.prepare(`
      SELECT * FROM attendance
      WHERE employee_id = ? AND strftime('%Y-%m', date) = ?
      ORDER BY date ASC
    `).all(employeeId, yyyyMm);

    // Fetch employee leaves for the whole year
    const startOfYear = `${run.year}-01-01`;
    const endOfYear = `${run.year}-12-31`;
    const employeeLeaves = db.prepare(`
      SELECT * FROM leaves
      WHERE employee_id = ? AND start_date >= ? AND start_date <= ? AND status = 'approved'
      ORDER BY start_date ASC
    `).all(employeeId, startOfYear, endOfYear);

    // Compute running balance for leaves
    let currentBalance = employee ? employee.annual_leave_balance : 21;
    const leaveHistory = employeeLeaves.map(l => {
      if (l.leave_type === 'سنوية') {
        currentBalance = Math.max(0, currentBalance - (l.days_count || 1));
      }
      return {
        ...l,
        remaining_after: currentBalance
      };
    });

    // Fetch active loan remaining
    const loan = db.prepare(`
      SELECT * FROM loans
      WHERE employee_id = ? AND status = 'active'
      ORDER BY id DESC LIMIT 1
    `).get(employeeId);

    res.json({
      run,
      item,
      employee,
      attendanceLogs,
      leaveHistory,
      annualLeaveBalanceStart: employee ? employee.annual_leave_balance : 21,
      annualLeaveBalanceRemaining: currentBalance,
      loan: loan || null,
      remainingLoanAmount: loan ? loan.remaining_amount : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
