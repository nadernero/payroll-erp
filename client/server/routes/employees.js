import express from 'express';
import db from '../db.js';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { pushToSupabase, deleteFromSupabase, ensureFreshData } from '../supabaseSync.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// 1. Get all employees
router.get('/', async (req, res) => {
  try {
    if (process.env.VERCEL) {
      try {
        const { ensureEmployeesFresh } = await import('../app.js');
        if (ensureEmployeesFresh) await ensureEmployeesFresh();
      } catch (e) {}
    }
    const { department, search } = req.query;
    let query = 'SELECT * FROM employees WHERE 1=1';
    const params = [];

    if (department && department !== 'all') {
      query += ' AND department = ?';
      params.push(department);
    }
    if (search) {
      query += ' AND (name LIKE ? OR code LIKE ? OR national_id LIKE ? OR job_title LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY seq ASC, CAST(code AS INTEGER) ASC';
    const employees = db.prepare(query).all(...params);
    res.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Get single employee
router.get('/:id', (req, res) => {
  try {
    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
    if (!employee) return res.status(404).json({ error: 'الموظف غير موجود' });
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Create employee
router.post('/', async (req, res) => {
  try {
    const {
      seq, department, name, code, national_id, insurance_no, job_title,
      basic_salary, actual_salary, insurance_basic,
      taxable_allowances, non_taxable_allowances, medical_insurance, annual_leave_balance,
      phone, pin_code, exclude_from_payroll
    } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'اسم الموظف والكود مطلوبان' });
    }

    const existing = db.prepare('SELECT id FROM employees WHERE code = ?').get(code);
    if (existing) {
      return res.status(400).json({ error: `كود الموظف ${code} مسجل بالفعل لموظف آخر` });
    }

    const maxSeq = db.prepare('SELECT MAX(seq) as max_s FROM employees').get().max_s || 0;
    const finalSeq = seq || (maxSeq + 1);

    const stmt = db.prepare(`
      INSERT INTO employees (
        seq, department, name, code, national_id, insurance_no, job_title,
        basic_salary, actual_salary, insurance_basic,
        taxable_allowances, non_taxable_allowances, medical_insurance, annual_leave_balance, password,
        phone, pin_code, exclude_from_payroll
      ) VALUES (
        @seq, @department, @name, @code, @national_id, @insurance_no, @job_title,
        @basic_salary, @actual_salary, @insurance_basic,
        @taxable_allowances, @non_taxable_allowances, @medical_insurance, @annual_leave_balance, @password,
        @phone, @pin_code, @exclude_from_payroll
      )
    `);

    const result = stmt.run({
      seq: finalSeq,
      department: department || 'عام',
      name,
      code,
      national_id: national_id || '',
      insurance_no: insurance_no || '',
      job_title: job_title || 'موظف',
      basic_salary: Number(basic_salary) || 0,
      actual_salary: Number(actual_salary) || Number(basic_salary) || 0,
      insurance_basic: Number(insurance_basic) || Number(basic_salary) || 0,
      taxable_allowances: Number(taxable_allowances) || 0,
      non_taxable_allowances: Number(non_taxable_allowances) || 0,
      medical_insurance: Number(medical_insurance) || 0,
      annual_leave_balance: Number(annual_leave_balance) || 21,
      password: code,
      phone: phone ? String(phone).trim() : null,
      pin_code: pin_code ? String(pin_code).trim() : null,
      exclude_from_payroll: exclude_from_payroll ? 1 : 0
    });

    const newEmp = db.prepare('SELECT * FROM employees WHERE id = ?').get(result.lastInsertRowid);
    try {
      await pushToSupabase('employees', newEmp);
    } catch (pushErr) {
      console.error('Supabase push error (create employee):', pushErr.message);
    }
    res.status(201).json(newEmp);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Update employee
router.put('/:id', async (req, res) => {
  try {
    const {
      seq, department, name, code, national_id, insurance_no, job_title,
      basic_salary, actual_salary, insurance_basic,
      taxable_allowances, non_taxable_allowances, medical_insurance, annual_leave_balance, status, password,
      phone, pin_code, exclude_from_payroll
    } = req.body;

    const existingCode = db.prepare('SELECT id FROM employees WHERE code = ? AND id != ?').get(code, req.params.id);
    if (existingCode) {
      return res.status(400).json({ error: `كود الموظف ${code} مستخدم لموظف آخر` });
    }

    const stmt = db.prepare(`
      UPDATE employees SET
        seq = @seq,
        department = @department,
        name = @name,
        code = @code,
        national_id = @national_id,
        insurance_no = @insurance_no,
        job_title = @job_title,
        basic_salary = @basic_salary,
        actual_salary = @actual_salary,
        insurance_basic = @insurance_basic,
        taxable_allowances = @taxable_allowances,
        non_taxable_allowances = @non_taxable_allowances,
        medical_insurance = @medical_insurance,
        annual_leave_balance = @annual_leave_balance,
        status = @status,
        password = COALESCE(@password, password),
        phone = @phone,
        pin_code = CASE WHEN @pin_code_passed = 1 THEN @pin_code ELSE pin_code END,
        exclude_from_payroll = @exclude_from_payroll
      WHERE id = @id
    `);

    stmt.run({
      id: req.params.id,
      seq: Number(seq) || 1,
      department,
      name,
      code,
      national_id: national_id || '',
      insurance_no: insurance_no || '',
      job_title,
      basic_salary: Number(basic_salary) || 0,
      actual_salary: Number(actual_salary) || Number(basic_salary) || 0,
      insurance_basic: Number(insurance_basic) || Number(basic_salary) || 0,
      taxable_allowances: Number(taxable_allowances) || 0,
      non_taxable_allowances: Number(non_taxable_allowances) || 0,
      medical_insurance: Number(medical_insurance) || 0,
      annual_leave_balance: Number(annual_leave_balance) || 21,
      status: status || 'active',
      password: password || null,
      phone: phone !== undefined ? (phone ? String(phone).trim() : '') : '',
      pin_code_passed: pin_code !== undefined ? 1 : 0,
      pin_code: pin_code && String(pin_code).trim() !== '' ? String(pin_code).trim() : null,
      exclude_from_payroll: exclude_from_payroll ? 1 : 0
    });

    const updated = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
    try {
      await pushToSupabase('employees', updated);
    } catch (pushErr) {
      console.error('Supabase push error (update employee):', pushErr.message);
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4.1 Reset PIN for employee
router.post('/:id/reset-pin', async (req, res) => {
  try {
    const emp = db.prepare('SELECT id, name, code FROM employees WHERE id = ?').get(req.params.id);
    if (!emp) return res.status(404).json({ error: 'الموظف غير موجود' });

    db.prepare('UPDATE employees SET pin_code = NULL WHERE id = ?').run(req.params.id);
    const updated = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
    if (updated) await pushToSupabase('employees', updated);
    res.json({
      success: true,
      message: `تم تصفير رمز المرور PIN للموظف ${emp.name} (${emp.code}) بنجاح. سيطلب منه النظام إنشاء رمز سري جديد عند تسجيل الدخول القادم.`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4.2 Set PIN directly by admin
router.post('/:id/set-pin', async (req, res) => {
  try {
    const { pin_code } = req.body;
    if (!pin_code || String(pin_code).trim().length < 4) {
      return res.status(400).json({ error: 'رمز الـ PIN يجب أن يكون من 4 أرقام على الأقل' });
    }
    db.prepare('UPDATE employees SET pin_code = ? WHERE id = ?').run(String(pin_code).trim(), req.params.id);
    const updated = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
    if (updated) await pushToSupabase('employees', updated);
    res.json({ success: true, message: 'تم تعيين رمز الـ PIN بنجاح' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Delete employee
router.delete('/:id', async (req, res) => {
  try {
    db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
    try {
      await deleteFromSupabase('employees', req.params.id);
    } catch (e) {}
    res.json({ success: true, message: 'تم حذف الموظف بنجاح' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5.1 Bulk Delete employees
router.post('/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'لم يتم تحديد أي موظفين للحذف' });
    }

    const delStmt = db.prepare('DELETE FROM employees WHERE id = ?');
    const runBulk = db.transaction(() => {
      for (const id of ids) {
        delStmt.run(id);
      }
    });

    runBulk();
    for (const id of ids) {
      try { await deleteFromSupabase('employees', id); } catch (e) {}
    }
    res.json({ success: true, message: `تم حذف ${ids.length} موظف بنجاح` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Download Excel Template for Employees
router.get('/template/download', (req, res) => {
  try {
    const templateData = [
      {
        'م': 1,
        'القسم': 'الفلتر',
        'اسم الموظف': 'سليمان فوزي سليمان رزق',
        'كود': '1001',
        'رقم البطاقة': '28212011403455',
        'الرقم التأميني': '50962045',
        'الوظيفة': 'سائق',
        'المرتب الأساسي': 5660,
        'مرتب فعلي': 5660,
        'أساسي تأمينات': 5660,
        'البدلات الخاضعة للضريبة': 1615,
        'البدلات الغير خاضعة للضريبة': 0,
        'رصيد الإجازات السنوية': 21
      },
      {
        'م': 2,
        'القسم': 'الإدارة',
        'اسم الموظف': 'مدحت ماهر حشمت طانيوس',
        'كود': '1003',
        'رقم البطاقة': '27408012105178',
        'الرقم التأميني': '22783353',
        'الوظيفة': 'محاسب',
        'المرتب الأساسي': 5660,
        'مرتب فعلي': 5660,
        'أساسي تأمينات': 5660,
        'البدلات الخاضعة للضريبة': 1615,
        'البدلات الغير خاضعة للضريبة': 0,
        'رصيد الإجازات السنوية': 21
      },
      {
        'م': 3,
        'القسم': 'الإدارة',
        'اسم الموظف': 'نبيل مساك جرس سرجان',
        'كود': '326',
        'رقم البطاقة': '28309042501191',
        'الرقم التأميني': '64319442',
        'الوظيفة': 'أمن',
        'المرتب الأساسي': 8220,
        'مرتب فعلي': 8220,
        'أساسي تأمينات': 8220,
        'البدلات الخاضعة للضريبة': 2451,
        'البدلات الغير خاضعة للضريبة': 0,
        'رصيد الإجازات السنوية': 25
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'قالب_الموظفين');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="employees_template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Preview Excel before Import
router.post('/import/preview', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'برجاء رفع ملف إكسيل' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

    if (rawRows.length < 2) {
      return res.status(400).json({ error: 'الملف فارغ أو لا يحتوي على صفوف بيانات' });
    }

    // Locate header row (search for 'اسم الموظف' or 'كود' or 'المرتب')
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
      const row = rawRows[i].map(c => String(c || '').trim());
      if (row.some(c => c.includes('اسم') || c.includes('كود') || c.includes('المرتب'))) {
        headerRowIdx = i;
        break;
      }
    }

    const headers = rawRows[headerRowIdx].map(c => String(c || '').trim());
    const dataRows = rawRows.slice(headerRowIdx + 1);

    // Map column names flexibly
    const findCol = (terms) => headers.findIndex(h => terms.some(t => h.toLowerCase().includes(t.toLowerCase())));

    const seqIdx = findCol(['م', 'مسلسل', 'seq']);
    const deptIdx = findCol(['قسم', 'القسم', 'الإدارة', 'الضريبة والقسم']);
    const nameIdx = findCol(['اسم الموظف', 'الاسم', 'إسم الموظف', 'اسم']);
    const codeIdx = findCol(['كود', 'الكود', 'كود الموظف']);
    const nationalIdIdx = findCol(['رقم البطاقة', 'الرقم القومي', 'بطاقة', 'الرقم القومى']);
    const insNoIdx = findCol(['الرقم التأميني', 'تأميني', 'رقم التأمينات']);
    const jobIdx = findCol(['الوظيفة', 'المهنة', 'وظيفة']);
    const basicIdx = findCol(['المرتب الأساسي', 'اساسي', 'الأساسي']);
    const actualIdx = findCol(['مرتب فعلي', 'مستحق', 'الفعلي', 'مرتب مستحق']);
    const insBasicIdx = findCol(['اساسي تأمينات', 'أساسي تأمينات', 'تأمينات']);
    const taxableAllowIdx = findCol(['البدلات الخاضعة للضريبة', 'خاضعة', 'بدلات خاضعة']);
    const nonTaxableAllowIdx = findCol(['البدلات الغير خاضعة للضريبة', 'غير خاضعة']);
    const leaveBalIdx = findCol(['رصيد الإجازات', 'إجازات', 'سنوي']);

    const existingCodes = new Set(db.prepare('SELECT code FROM employees').all().map(e => e.code));

    const parsedList = [];
    dataRows.forEach((row, idx) => {
      if (!row || row.length === 0 || row.every(cell => !cell)) return;

      const name = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
      const code = codeIdx !== -1 ? String(row[codeIdx] || '').trim() : '';
      if (!name && !code) return;

      const basic = Number(row[basicIdx]) || 0;
      const actual = actualIdx !== -1 ? (Number(row[actualIdx]) || basic) : basic;
      const insBasic = insBasicIdx !== -1 ? (Number(row[insBasicIdx]) || basic) : basic;
      const taxAllow = taxableAllowIdx !== -1 ? (Number(row[taxableAllowIdx]) || 0) : 0;
      const nonTaxAllow = nonTaxableAllowIdx !== -1 ? (Number(row[nonTaxableAllowIdx]) || 0) : 0;
      const leaveBal = leaveBalIdx !== -1 ? (Number(row[leaveBalIdx]) || 21) : 21;

      // Validation warnings
      const warnings = [];
      if (!code) warnings.push('كود الموظف مفقود');
      if (!name) warnings.push('اسم الموظف مفقود');
      const isExisting = existingCodes.has(code);

      parsedList.push({
        seq: seqIdx !== -1 ? Number(row[seqIdx]) || (idx + 1) : (idx + 1),
        department: deptIdx !== -1 ? String(row[deptIdx] || 'عام').trim() : 'عام',
        name,
        code,
        national_id: nationalIdIdx !== -1 ? String(row[nationalIdIdx] || '').trim() : '',
        insurance_no: insNoIdx !== -1 ? String(row[insNoIdx] || '').trim() : '',
        job_title: jobIdx !== -1 ? String(row[jobIdx] || 'موظف').trim() : 'موظف',
        basic_salary: basic,
        actual_salary: actual,
        insurance_basic: insBasic,
        taxable_allowances: taxAllow,
        non_taxable_allowances: nonTaxAllow,
        annual_leave_balance: leaveBal,
        isExisting,
        status: isExisting ? 'سيتم التحديث' : 'موظف جديد',
        warnings
      });
    });

    res.json({
      total: parsedList.length,
      newCount: parsedList.filter(p => !p.isExisting).length,
      updateCount: parsedList.filter(p => p.isExisting).length,
      items: parsedList
    });
  } catch (error) {
    console.error('Import preview error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 8. Confirm Excel Import
router.post('/import/confirm', async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'لا توجد بيانات لتأكيد الاستيراد' });
    }

    const checkStmt = db.prepare('SELECT id FROM employees WHERE code = ?');
    const insertStmt = db.prepare(`
      INSERT INTO employees (
        seq, department, name, code, national_id, insurance_no, job_title,
        basic_salary, actual_salary, insurance_basic,
        taxable_allowances, non_taxable_allowances, annual_leave_balance, password
      ) VALUES (
        @seq, @department, @name, @code, @national_id, @insurance_no, @job_title,
        @basic_salary, @actual_salary, @insurance_basic,
        @taxable_allowances, @non_taxable_allowances, @annual_leave_balance, @password
      )
    `);

    const updateStmt = db.prepare(`
      UPDATE employees SET
        seq = @seq,
        department = @department,
        name = @name,
        national_id = @national_id,
        insurance_no = @insurance_no,
        job_title = @job_title,
        basic_salary = @basic_salary,
        actual_salary = @actual_salary,
        insurance_basic = @insurance_basic,
        taxable_allowances = @taxable_allowances,
        non_taxable_allowances = @non_taxable_allowances,
        annual_leave_balance = @annual_leave_balance
      WHERE code = @code
    `);

    let inserted = 0;
    let updated = 0;

    const runImport = db.transaction(() => {
      items.forEach(emp => {
        if (!emp.code || !emp.name) return;
        const existing = checkStmt.get(emp.code);

        const payload = {
          seq: Number(emp.seq) || 1,
          department: emp.department || 'عام',
          name: emp.name,
          code: emp.code,
          national_id: emp.national_id || '',
          insurance_no: emp.insurance_no || '',
          job_title: emp.job_title || 'موظف',
          basic_salary: Number(emp.basic_salary) || 0,
          actual_salary: Number(emp.actual_salary) || Number(emp.basic_salary) || 0,
          insurance_basic: Number(emp.insurance_basic) || Number(emp.basic_salary) || 0,
          taxable_allowances: Number(emp.taxable_allowances) || 0,
          non_taxable_allowances: Number(emp.non_taxable_allowances) || 0,
          annual_leave_balance: Number(emp.annual_leave_balance) || 21,
          password: emp.code
        };

        if (existing) {
          updateStmt.run(payload);
          updated++;
        } else {
          insertStmt.run(payload);
          inserted++;
        }
      });
    });

    runImport();

    // Push imported employees to Supabase
    try {
      const allCurrent = db.prepare('SELECT * FROM employees').all();
      for (const item of items) {
        if (!item.code) continue;
        const matched = allCurrent.find(e => String(e.code).trim() === String(item.code).trim());
        if (matched) await pushToSupabase('employees', matched);
      }
    } catch (pushErr) {}

    res.json({
      success: true,
      message: `تم الاستيراد بنجاح! تم إضافة ${inserted} موظف جديد وتحديث ${updated} موظف حالي.`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Export All Employees to Excel
router.get('/export/excel', (req, res) => {
  try {
    const employees = db.prepare('SELECT * FROM employees ORDER BY seq ASC, CAST(code AS INTEGER) ASC').all();
    const exportData = employees.map(e => ({
      'م': e.seq,
      'القسم': e.department,
      'اسم الموظف': e.name,
      'كود': e.code,
      'رقم البطاقة': e.national_id,
      'الرقم التأميني': e.insurance_no,
      'الوظيفة': e.job_title,
      'المرتب الأساسي': e.basic_salary,
      'مرتب فعلي': e.actual_salary,
      'أساسي تأمينات': e.insurance_basic,
      'البدلات الخاضعة للضريبة': e.taxable_allowances,
      'البدلات الغير خاضعة للضريبة': e.non_taxable_allowances,
      'إجمالي البدلات': (e.taxable_allowances + e.non_taxable_allowances),
      'إجمالي الاستحقاق': (e.basic_salary + e.taxable_allowances + e.non_taxable_allowances),
      'رصيد الإجازات السنوية': e.annual_leave_balance
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'بيانات_الموظفين');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="all_employees.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 10. Get Salary Progression History for all or specific employee
router.get('/salary-history/all', (req, res) => {
  try {
    const history = db.prepare(`
      SELECT * FROM salary_history 
      ORDER BY year DESC, created_at DESC
    `).all();
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/salary-history', (req, res) => {
  try {
    const history = db.prepare(`
      SELECT * FROM salary_history 
      WHERE employee_id = ? 
      ORDER BY year DESC, created_at DESC
    `).all(req.params.id);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 11. Apply Annual Increment to Selected or All Employees
router.post('/apply-annual-increment', (req, res) => {
  try {
    const {
      year,
      effective_date,
      increase_percent,
      employeeIds,
      adjust_basic,
      adjust_insurance,
      notes
    } = req.body;

    const incPct = Number(increase_percent);
    if (isNaN(incPct) || incPct <= 0) {
      return res.status(400).json({ error: 'يرجى إدخال نسبة زيادة سنوية صحيحة أكبر من الصفر' });
    }
    const targetYear = Number(year) || (new Date().getFullYear() + 1);
    const effDate = effective_date || `${targetYear}-01-01`;

    let query = 'SELECT * FROM employees WHERE status = "active"';
    const params = [];
    if (Array.isArray(employeeIds) && employeeIds.length > 0) {
      query += ` AND id IN (${employeeIds.map(() => '?').join(',')})`;
      params.push(...employeeIds);
    }
    query += ' ORDER BY CAST(code AS INTEGER) ASC';

    const targetEmployees = db.prepare(query).all(...params);
    if (targetEmployees.length === 0) {
      return res.status(400).json({ error: 'لم يتم العثور على موظفين لتطبيق الزيادة عليهم' });
    }

    const mult = 1 + (incPct / 100);

    const updateEmpStmt = db.prepare(`
      UPDATE employees SET
        actual_salary = @new_actual,
        basic_salary = @new_basic,
        insurance_basic = @new_ins,
        taxable_allowances = @new_tax_allow
      WHERE id = @id
    `);

    const insertHistoryStmt = db.prepare(`
      INSERT INTO salary_history (
        employee_id, employee_code, employee_name, year, effective_date,
        increase_percent, old_actual_salary, new_actual_salary,
        old_basic_salary, new_basic_salary,
        old_insurance_basic, new_insurance_basic,
        old_taxable_allowances, new_taxable_allowances,
        old_non_taxable_allowances, new_non_taxable_allowances,
        old_medical_insurance, new_medical_insurance,
        notes
      ) VALUES (
        @employee_id, @employee_code, @employee_name, @year, @effective_date,
        @increase_percent, @old_actual_salary, @new_actual_salary,
        @old_basic_salary, @new_basic_salary,
        @old_insurance_basic, @new_insurance_basic,
        @old_taxable_allowances, @new_taxable_allowances,
        @old_non_taxable_allowances, @new_non_taxable_allowances,
        @old_medical_insurance, @new_medical_insurance,
        @notes
      )
    `);

    const applyTx = db.transaction(() => {
      for (const emp of targetEmployees) {
        const oldActual = Number(emp.actual_salary) || Number(emp.basic_salary) || 0;
        const newActual = Math.round(oldActual * mult);

        const oldBasic = Number(emp.basic_salary) || 0;
        const newBasic = adjust_basic ? Math.round(oldBasic * mult) : oldBasic;

        const oldIns = Number(emp.insurance_basic) || oldBasic;
        const newIns = adjust_insurance ? Math.round(oldIns * mult) : oldIns;

        const oldTaxAllow = Number(emp.taxable_allowances) || 0;
        const newTaxAllow = Math.round(oldTaxAllow * mult);

        const oldNonTax = Number(emp.non_taxable_allowances) || 0;
        const newNonTax = oldNonTax;

        updateEmpStmt.run({
          id: emp.id,
          new_actual: newActual,
          new_basic: newBasic,
          new_ins: newIns,
          new_tax_allow: newTaxAllow
        });

        insertHistoryStmt.run({
          employee_id: emp.id,
          employee_code: emp.code,
          employee_name: emp.name,
          year: targetYear,
          effective_date: effDate,
          increase_percent: incPct,
          old_actual_salary: oldActual,
          new_actual_salary: newActual,
          old_basic_salary: oldBasic,
          new_basic_salary: newBasic,
          old_insurance_basic: oldIns,
          new_insurance_basic: newIns,
          old_taxable_allowances: oldTaxAllow,
          new_taxable_allowances: newTaxAllow,
          old_non_taxable_allowances: oldNonTax,
          new_non_taxable_allowances: newNonTax,
          old_medical_insurance: Number(emp.medical_insurance) || 0,
          new_medical_insurance: Number(emp.medical_insurance) || 0,
          notes: notes || `زيادة سنوية بنسبة ${incPct}% لعام ${targetYear}`
        });
      }
    });

    applyTx();

    res.json({
      success: true,
      message: `تم بنجاح تطبيق زيادة سنوية بنسبة ${incPct}% لعدد ${targetEmployees.length} موظف وتسجيلها في سجل تدرج الرواتب!`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
