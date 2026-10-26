import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const originalDbPath = path.join(__dirname, '..', 'data', 'payroll.db');
let effectiveDbPath = originalDbPath;

if (process.env.VERCEL) {
  const tmpDir = os.tmpdir();
  const tmpDbPath = path.join(tmpDir, 'payroll.db');
  if (!fs.existsSync(tmpDbPath)) {
    const candidates = [
      originalDbPath,
      path.join(process.cwd(), 'data', 'payroll.db'),
      path.resolve('data', 'payroll.db'),
      path.join(__dirname, '..', 'data', 'payroll.db'),
      path.join(__dirname, '..', '..', 'data', 'payroll.db')
    ];
    const found = candidates.find(p => fs.existsSync(p));
    if (found) {
      try {
        fs.copyFileSync(found, tmpDbPath);
        console.log(`⚡ Initialized /tmp/payroll.db from bundled database at ${found}`);
      } catch (e) {
        console.error('Failed to copy seed db to /tmp:', e);
      }
    } else {
      console.warn('⚠️ No bundled database found at candidates:', candidates);
    }
  }
  effectiveDbPath = tmpDbPath;
} else {
  const dbDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

let db = null;
let isNative = false;

if (!process.env.VERCEL) {
  try {
    const { default: BetterSqlite3 } = await import('better-sqlite3');
    db = new BetterSqlite3(effectiveDbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    isNative = true;
  } catch (err) {
    console.warn('better-sqlite3 not available, falling back to node:sqlite:', err.message);
  }
}

if (!isNative) {
  const { DatabaseSync } = await import('node:sqlite');
  db = new DatabaseSync(effectiveDbPath);
  
  if (!db.pragma) {
    db.pragma = (sql) => {
      try { db.exec(`PRAGMA ${sql}`); } catch (e) {}
    };
  }
  if (!db.transaction) {
    db.transaction = (fn) => {
      return (...args) => {
        db.exec('BEGIN TRANSACTION');
        try {
          const res = fn(...args);
          db.exec('COMMIT');
          return res;
        } catch (err) {
          try { db.exec('ROLLBACK'); } catch (rbErr) {}
          throw err;
        }
      };
    };
  }

  // Intercept prepare to sanitize parameters for node:sqlite compatibility (prevents undefined / boolean crashes)
  const originalPrepare = db.prepare.bind(db);
  function sanitizeParam(val) {
    if (val === undefined || val === null) return null;
    if (typeof val === 'boolean') return val ? 1 : 0;
    if (val instanceof Date) return val.toISOString();
    return val;
  }
  function sanitizeObj(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj) || obj instanceof Date) {
      return sanitizeParam(obj);
    }
    const clean = {};
    for (const k of Object.keys(obj)) {
      clean[k] = sanitizeParam(obj[k]);
    }
    return clean;
  }

  db.prepare = (sql) => {
    const stmt = originalPrepare(sql);
    const origRun = stmt.run.bind(stmt);
    const origGet = stmt.get.bind(stmt);
    const origAll = stmt.all.bind(stmt);
    stmt.run = (...args) => {
      const cleanArgs = args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])
        ? [sanitizeObj(args[0])]
        : args.map(sanitizeParam);
      return origRun(...cleanArgs);
    };
    stmt.get = (...args) => {
      const cleanArgs = args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])
        ? [sanitizeObj(args[0])]
        : args.map(sanitizeParam);
      return origGet(...cleanArgs);
    };
    stmt.all = (...args) => {
      const cleanArgs = args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])
        ? [sanitizeObj(args[0])]
        : args.map(sanitizeParam);
      return origAll(...cleanArgs);
    };
    return stmt;
  };

  db.pragma('foreign_keys = ON');
}

export function initDatabase() {
  db.exec(`
    -- جدول الموظفين
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seq INTEGER,
      department TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      national_id TEXT NOT NULL,
      insurance_no TEXT,
      job_title TEXT NOT NULL,
      basic_salary REAL NOT NULL DEFAULT 0,
      actual_salary REAL NOT NULL DEFAULT 0,
      insurance_basic REAL NOT NULL DEFAULT 0,
      taxable_allowances REAL NOT NULL DEFAULT 0,
      non_taxable_allowances REAL NOT NULL DEFAULT 0,
      medical_insurance REAL NOT NULL DEFAULT 0,
      annual_leave_balance REAL NOT NULL DEFAULT 21,
      status TEXT NOT NULL DEFAULT 'active',
      password TEXT,
      phone TEXT,
      pin_code TEXT,
      exclude_from_payroll INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- جدول الحضور والانصراف
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      employee_code TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      department TEXT,
      date TEXT NOT NULL,
      day_name TEXT,
      status TEXT DEFAULT 'حاضر',
      check_in TEXT,
      check_out TEXT,
      late_minutes INTEGER DEFAULT 0,
      early_leave_minutes INTEGER DEFAULT 0,
      overtime_hours REAL DEFAULT 0,
      is_absent INTEGER DEFAULT 0,
      is_annual_leave INTEGER DEFAULT 0,
      is_overnight INTEGER DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      UNIQUE(employee_code, date)
    );

    -- جدول المصروفات الخاصة بالشهور (يوم 10 و 20)
    CREATE TABLE IF NOT EXISTS mid_month_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      employee_code TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      amount_day_10 REAL DEFAULT 0,
      recipient_day_10 TEXT,
      amount_day_20 REAL DEFAULT 0,
      recipient_day_20 TEXT,
      total_amount REAL DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      UNIQUE(year, month, employee_id)
    );

    -- جدول السلف طويلة الأجل
    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      employee_code TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      total_amount REAL NOT NULL,
      months_count INTEGER NOT NULL,
      monthly_installment REAL NOT NULL,
      start_date TEXT NOT NULL, -- YYYY-MM
      end_date TEXT NOT NULL,   -- YYYY-MM
      paid_installments INTEGER DEFAULT 0,
      remaining_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', -- active, completed, paused
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    -- جدول الإجازات
    CREATE TABLE IF NOT EXISTS leaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      employee_code TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      leave_type TEXT NOT NULL DEFAULT 'سنوية', -- سنوية, عارضة, مرضية
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days_count REAL NOT NULL DEFAULT 1,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'approved', -- pending, approved, rejected
      approved_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    -- جدول طلبات الموظفين (بوابة الموظف)
    CREATE TABLE IF NOT EXISTS employee_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      employee_code TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      request_type TEXT NOT NULL, -- 'leave', 'overtime', 'loan', 'inquiry'
      title TEXT NOT NULL,
      date_from TEXT,
      date_to TEXT,
      quantity REAL DEFAULT 1, -- e.g. hours of overtime or days of leave
      details TEXT,
      status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
      admin_response TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    -- جدول كشوفات المرتبات الشهرية
    CREATE TABLE IF NOT EXISTS payroll_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      title TEXT NOT NULL,
      payroll_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft', -- draft, approved, closed
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(year, month)
    );

    -- جدول بنود مرتبات الموظفين في الشهر
    CREATE TABLE IF NOT EXISTS payroll_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payroll_run_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      seq INTEGER,
      department TEXT,
      employee_name TEXT NOT NULL,
      employee_code TEXT NOT NULL,
      national_id TEXT,
      insurance_no TEXT,
      job_title TEXT,
      
      -- الاستحقاقات
      basic_salary REAL DEFAULT 0,
      actual_salary REAL DEFAULT 0,
      insurance_basic REAL DEFAULT 0,
      taxable_allowances REAL DEFAULT 0,
      non_taxable_allowances REAL DEFAULT 0,
      total_allowances REAL DEFAULT 0,
      total_entitlement REAL DEFAULT 0,
      
      -- الإضافي
      overtime_day_value REAL DEFAULT 0,
      overtime_days REAL DEFAULT 0,
      total_overtime REAL DEFAULT 0,
      
      -- مكافآت واشتراكات
      bonus_days REAL DEFAULT 0,
      total_bonuses REAL DEFAULT 0,
      non_taxable_deductions REAL DEFAULT 0,
      
      -- الاستقطاعات
      expenses REAL DEFAULT 0, -- مصروفات 10 و 20
      absence_day_value REAL DEFAULT 0,
      absence_days REAL DEFAULT 0,
      total_absence REAL DEFAULT 0,
      penalty_days REAL DEFAULT 0,
      total_penalties REAL DEFAULT 0,
      social_insurance REAL DEFAULT 0,
      medical_insurance REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total_deductions REAL DEFAULT 0,
      
      -- السلف والصافي
      loan_installment REAL DEFAULT 0,
      gross_after_deductions REAL DEFAULT 0,
      net_salary REAL DEFAULT 0,
      
      notes TEXT,
      FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    -- جدول ماكينات البصمة ZKTeco
    CREATE TABLE IF NOT EXISTS biometric_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      ip TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 4370,
      protocol TEXT NOT NULL DEFAULT 'udp', -- udp or tcp
      timeout INTEGER NOT NULL DEFAULT 5000,
      location TEXT,
      status TEXT NOT NULL DEFAULT 'active', -- active, inactive
      last_sync_at DATETIME,
      last_sync_status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- جدول سجل تدرج الرواتب والزيادات السنوية
    CREATE TABLE IF NOT EXISTS salary_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      employee_code TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      year INTEGER NOT NULL,
      effective_date TEXT NOT NULL,
      increase_percent REAL DEFAULT 0,
      old_actual_salary REAL NOT NULL,
      new_actual_salary REAL NOT NULL,
      old_basic_salary REAL NOT NULL,
      new_basic_salary REAL NOT NULL,
      old_insurance_basic REAL NOT NULL,
      new_insurance_basic REAL NOT NULL,
      old_taxable_allowances REAL NOT NULL,
      new_taxable_allowances REAL NOT NULL,
      old_non_taxable_allowances REAL NOT NULL,
      new_non_taxable_allowances REAL NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    -- ============================
    -- مديول الخزينة - Cash Management
    -- ============================

    -- جدول الخزائن (رئيسية وفرعية)
    CREATE TABLE IF NOT EXISTS cash_safes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'main' CHECK(type IN ('main', 'sub')),
      parent_safe_id INTEGER REFERENCES cash_safes(id),
      custodian_name TEXT,
      custodian_phone TEXT,
      custodian_employee_id INTEGER REFERENCES employees(id),
      current_balance REAL NOT NULL DEFAULT 0,
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- جدول حركات الخزينة (كل إيداع/صرف/تحويل)
    CREATE TABLE IF NOT EXISTS cash_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      safe_id INTEGER NOT NULL REFERENCES cash_safes(id),
      type TEXT NOT NULL CHECK(type IN (
        'custody_receive',
        'custody_return',
        'expense',
        'income',
        'transfer_out',
        'transfer_in',
        'salary_payment',
        'sub_replenish',
        'denomination_adjustment'
      )),
      amount REAL NOT NULL,
      balance_before REAL NOT NULL DEFAULT 0,
      balance_after REAL NOT NULL,
      description TEXT NOT NULL,
      reference_no TEXT,
      related_employee_id INTEGER REFERENCES employees(id),
      related_employee_name TEXT,
      related_safe_id INTEGER REFERENCES cash_safes(id),
      sender_phone TEXT,
      transaction_date TEXT NOT NULL,
      notes TEXT,
      created_by TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- جدول الدرج (فئات الأوراق النقدية الموجودة فعلياً بالخزينة)
    CREATE TABLE IF NOT EXISTS cash_denominations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      safe_id INTEGER NOT NULL REFERENCES cash_safes(id),
      transaction_id INTEGER REFERENCES cash_transactions(id),
      snapshot_date TEXT NOT NULL,
      count_200 INTEGER DEFAULT 0,
      count_100 INTEGER DEFAULT 0,
      count_50  INTEGER DEFAULT 0,
      count_20  INTEGER DEFAULT 0,
      count_10  INTEGER DEFAULT 0,
      count_5   INTEGER DEFAULT 0,
      count_1   INTEGER DEFAULT 0,
      count_50pt INTEGER DEFAULT 0,
      count_25pt INTEGER DEFAULT 0,
      count_10pt INTEGER DEFAULT 0,
      count_5pt  INTEGER DEFAULT 0,
      total_physical REAL NOT NULL DEFAULT 0,
      book_balance   REAL NOT NULL DEFAULT 0,
      difference     REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- جدول الإجازات والعطلات الرسمية
    CREATE TABLE IF NOT EXISTS official_holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      holiday_date TEXT NOT NULL UNIQUE,
      year INTEGER NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- جدول جهات وشركات التعامل الخارجي (موردين / فنيين / شركات صيانة وتوريدات)
    CREATE TABLE IF NOT EXISTS treasury_parties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      party_type TEXT NOT NULL DEFAULT 'company', -- 'company', 'supplier', 'technician', 'individual'
      category TEXT, -- 'أحبار وطابعات', 'كاميرات ومراقبة', 'صيانة سيارات وكاوتش', 'مهمات تشغيل ونظافة', 'أجهزة ومعدات', 'نثريات وخدمات'
      contact_person TEXT,
      phone TEXT,
      tax_no TEXT,
      address TEXT,
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrations for treasury parties and transactions
  try { db.exec(`ALTER TABLE cash_transactions ADD COLUMN recipient_type TEXT DEFAULT 'employee';`); } catch (e) {}
  try { db.exec(`ALTER TABLE cash_transactions ADD COLUMN party_id INTEGER;`); } catch (e) {}
  try { db.exec(`ALTER TABLE cash_transactions ADD COLUMN party_name TEXT;`); } catch (e) {}
  try { db.exec(`ALTER TABLE cash_transactions ADD COLUMN category TEXT;`); } catch (e) {}
  try { db.exec(`ALTER TABLE cash_transactions ADD COLUMN invoice_no TEXT;`); } catch (e) {}
  try { db.exec(`ALTER TABLE cash_transactions ADD COLUMN packs_detail TEXT;`); } catch (e) {}
  try { db.exec(`ALTER TABLE cash_transactions ADD COLUMN receipt_image TEXT;`); } catch (e) {}
  try { db.exec(`ALTER TABLE cash_transactions ADD COLUMN cost_center TEXT;`); } catch (e) {}
  try { db.exec(`ALTER TABLE cash_transactions ADD COLUMN crop_type TEXT;`); } catch (e) {}

  // Migrations for cash_denominations bundles (بواكي) and change (فكة) + tafqeet
  try { db.exec(`ALTER TABLE cash_denominations ADD COLUMN packs_200 INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.exec(`ALTER TABLE cash_denominations ADD COLUMN loose_200 INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.exec(`ALTER TABLE cash_denominations ADD COLUMN packs_100 INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.exec(`ALTER TABLE cash_denominations ADD COLUMN loose_100 INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.exec(`ALTER TABLE cash_denominations ADD COLUMN packs_50 INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.exec(`ALTER TABLE cash_denominations ADD COLUMN loose_50 INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.exec(`ALTER TABLE cash_denominations ADD COLUMN packs_20 INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.exec(`ALTER TABLE cash_denominations ADD COLUMN loose_20 INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.exec(`ALTER TABLE cash_denominations ADD COLUMN packs_10 INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.exec(`ALTER TABLE cash_denominations ADD COLUMN loose_10 INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.exec(`ALTER TABLE cash_denominations ADD COLUMN packs_5 INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.exec(`ALTER TABLE cash_denominations ADD COLUMN loose_5 INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.exec(`ALTER TABLE cash_denominations ADD COLUMN tafqeet_text TEXT;`); } catch (e) {}

  // Migrations for overtime_days and absence_days in days format
  try {
    db.exec(`ALTER TABLE attendance ADD COLUMN overtime_days REAL DEFAULT 0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE attendance ADD COLUMN absence_days REAL DEFAULT 1;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE attendance ADD COLUMN is_holiday INTEGER DEFAULT 0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE payroll_items ADD COLUMN bonus_name TEXT;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE payroll_items ADD COLUMN exempt_bonuses REAL DEFAULT 0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE employee_requests ADD COLUMN manager_status TEXT DEFAULT 'pending';`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE employee_requests ADD COLUMN manager_notes TEXT;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE employee_requests ADD COLUMN submitted_by TEXT DEFAULT 'employee';`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE employee_requests ADD COLUMN on_behalf_of INTEGER DEFAULT 0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE employees ADD COLUMN medical_insurance REAL DEFAULT 0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE payroll_items ADD COLUMN medical_insurance REAL DEFAULT 0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE salary_history ADD COLUMN old_medical_insurance REAL DEFAULT 0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE salary_history ADD COLUMN new_medical_insurance REAL DEFAULT 0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE employees ADD COLUMN phone TEXT;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE employees ADD COLUMN pin_code TEXT;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE employees ADD COLUMN exclude_from_payroll INTEGER DEFAULT 0;`);
  } catch (e) {}

  // Migrations for cash_safes trust flag and category
  try { db.exec(`ALTER TABLE cash_safes ADD COLUMN is_trust INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.exec(`ALTER TABLE cash_safes ADD COLUMN safe_category TEXT DEFAULT 'standard';`); } catch (e) {}
  try { db.exec(`ALTER TABLE cash_transactions ADD COLUMN trust_id INTEGER;`); } catch (e) {}

  // Tables for cash_trusts (الأمانات والعهد المؤقتة للأشخاص والموظفين مع تحديد موعد الرد)
  db.exec(`
    CREATE TABLE IF NOT EXISTS cash_trusts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      safe_id INTEGER NOT NULL REFERENCES cash_safes(id),
      person_type TEXT NOT NULL DEFAULT 'employee',
      employee_id INTEGER REFERENCES employees(id),
      person_name TEXT NOT NULL,
      person_phone TEXT,
      person_national_id TEXT,
      amount REAL NOT NULL,
      returned_amount REAL NOT NULL DEFAULT 0,
      remaining_amount REAL NOT NULL,
      given_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      return_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      purpose TEXT,
      notes TEXT,
      disburse_tx_id INTEGER REFERENCES cash_transactions(id),
      return_tx_id INTEGER REFERENCES cash_transactions(id),
      created_by TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cash_trust_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trust_id INTEGER NOT NULL REFERENCES cash_trusts(id) ON DELETE CASCADE,
      safe_id INTEGER NOT NULL REFERENCES cash_safes(id),
      amount REAL NOT NULL,
      return_date TEXT NOT NULL,
      notes TEXT,
      tx_id INTEGER REFERENCES cash_transactions(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Treasury module seed - create default main safe if not exists
  try {
    const safeCount = db.prepare('SELECT COUNT(*) as c FROM cash_safes').get().c;
    if (safeCount === 0) {
      db.prepare(`
        INSERT INTO cash_safes (name, type, custodian_name, current_balance, notes)
        VALUES ('الخزينة الرئيسية', 'main', 'أمين الخزينة الرئيسي', 0, 'الخزينة الرئيسية للشركة')
      `).run();
    }

    // Seed sample external parties if empty
    const partyCount = db.prepare('SELECT COUNT(*) as c FROM treasury_parties').get().c;
    if (partyCount === 0) {
      const sampleParties = [
        { name: 'شركة النيل لتوريد أحبار وماكينات الطباعة', party_type: 'company', category: 'أحبار وطابعات', contact_person: 'م. أحمد شكري', phone: '01012345678', notes: 'توريد أحبار أصلية وصيانة طابعات الـ HP والإبسون' },
        { name: 'مؤسسة التقنية الذكية للأنظمة وكاميرات المراقبة', party_type: 'company', category: 'كاميرات ومراقبة', contact_person: 'م. محمد عبد المنعم', phone: '01198765432', notes: 'توريد وتركيب كاميرات المراقبة وأجهزة الإنذار والشبكات' },
        { name: 'مركز الأهرام لخدمات وصيانة الإطارات والكاوتش', party_type: 'supplier', category: 'صيانة سيارات وكاوتش', contact_person: 'الأسطى رجب', phone: '01234567890', notes: 'صيانة كاوتش، ترصيص، وبنشر سيارات الشركة' },
        { name: 'شركة الهلال للمهمات وأدوات النظافة والبوفيه', party_type: 'supplier', category: 'مهمات تشغيل ونظافة', contact_person: 'أ. طارق عبد العظيم', phone: '01087654321', notes: 'مستلزمات نظافة دورية ومواد التطهير ومشتريات البوفيه' },
        { name: 'المهندس كريم حسان (فني شبكات وصيانة عامة)', party_type: 'technician', category: 'أجهزة ومعدات', contact_person: 'كريم حسان', phone: '01555544433', notes: 'صيانة شبكات وكهرباء ومقاولات صيانة سريعة' },
      ];
      const insertParty = db.prepare(`
        INSERT INTO treasury_parties (name, party_type, category, contact_person, phone, notes)
        VALUES (@name, @party_type, @category, @contact_person, @phone, @notes)
      `);
      sampleParties.forEach(p => insertParty.run(p));
    }
  } catch(e) { console.log('Treasury seed skipped:', e.message); }

  // Seed sample official holidays if table is empty
  const holidaysCount = db.prepare('SELECT COUNT(*) as count FROM official_holidays').get();
  if (holidaysCount.count === 0) {
    const seedHolidays = [
      { name: 'عيد الميلاد المجيد', holiday_date: '2026-01-07', year: 2026 },
      { name: 'ثورة 25 يناير وعيد الشرطة', holiday_date: '2026-01-25', year: 2026 },
      { name: 'عيد الفطر المبارك', holiday_date: '2026-03-20', year: 2026 },
      { name: 'عيد الفطر المبارك (اليوم الثاني)', holiday_date: '2026-03-21', year: 2026 },
      { name: 'عيد تحرير سيناء', holiday_date: '2026-04-25', year: 2026 },
      { name: 'عيد العمال', holiday_date: '2026-05-01', year: 2026 },
      { name: 'شم النسيم', holiday_date: '2026-05-04', year: 2026 },
      { name: 'عيد الأضحى المبارك', holiday_date: '2026-05-27', year: 2026 },
      { name: 'عيد الأضحى المبارك (اليوم الثاني)', holiday_date: '2026-05-28', year: 2026 },
      { name: 'ثورة 30 يونيو', holiday_date: '2026-06-30', year: 2026 },
      { name: 'ثورة 23 يوليو', holiday_date: '2026-07-23', year: 2026 },
      { name: 'المولد النبوي الشريف', holiday_date: '2026-08-25', year: 2026 },
      { name: 'عيد القوات المسلحة (6 أكتوبر)', holiday_date: '2026-10-06', year: 2026 }
    ];
    const insertH = db.prepare('INSERT OR IGNORE INTO official_holidays (name, holiday_date, year, notes) VALUES (?, ?, ?, ?)');
    for (const h of seedHolidays) {
      insertH.run(h.name, h.holiday_date, h.year, 'إجازة رسمية مدفوعة الأجر');
    }
  }

  // Seed default biometric machine if table empty
  try {
    const devCount = db.prepare('SELECT COUNT(*) as count FROM biometric_devices').get().count;
    if (devCount === 0) {
      db.prepare(`
        INSERT INTO biometric_devices (name, ip, port, protocol, timeout, location)
        VALUES ('ماكينة البصمة الرئيسية (الإدارة)', '192.168.1.201', 4370, 'udp', 5000, 'المدخل الرئيسي'),
               ('ماكينة بصمة المصنع / الورشة', '192.168.1.202', 4370, 'udp', 5000, 'بوابة المصنع')
      `).run();
    }
  } catch (e) {}

  // Seed sample data if empty
  const count = db.prepare('SELECT COUNT(*) as count FROM employees').get().count;
  if (count === 0) {
    seedInitialData();
  }
}

function seedInitialData() {
  console.log('Seeding initial company data for ~60 employees based on real sample sheets...');

  const initialEmployees = [
    { seq: 1, department: 'الفلتر', name: 'سليمان فوزي سليمان رزق', code: '1001', national_id: '28212011403455', insurance_no: '50962045', job_title: 'سائق', basic_salary: 5660, actual_salary: 5660, insurance_basic: 5660, taxable_allowances: 1615, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 2, department: 'الفلتر', name: 'ماجد ماهر حشمت طانيوس', code: '1002', national_id: '26912132400854', insurance_no: '51805127', job_title: 'بدون عمل 5%', basic_salary: 5660, actual_salary: 5660, insurance_basic: 5660, taxable_allowances: 1615, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 3, department: 'الإدارة', name: 'مدحت ماهر حشمت طانيوس', code: '1003', national_id: '27408012105178', insurance_no: '22783353', job_title: 'محاسب', basic_salary: 5660, actual_salary: 5660, insurance_basic: 5660, taxable_allowances: 1615, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 4, department: 'الإدارة', name: 'مسعد إيليا مسعد حنين', code: '1004', national_id: '28002192400617', insurance_no: '57921000', job_title: 'شئون إدارية', basic_salary: 5660, actual_salary: 5660, insurance_basic: 5660, taxable_allowances: 1615, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 5, department: 'الفلتر', name: 'مكارم نبيه جاب الله رزق الله', code: '1005', national_id: '28003092402856', insurance_no: '13973628', job_title: 'تباع', basic_salary: 5660, actual_salary: 5660, insurance_basic: 5660, taxable_allowances: 1615, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 6, department: 'الفلتر', name: 'مينا فارس بخيت بشوت', code: '1006', national_id: '20190510101857', insurance_no: '75878800', job_title: 'بدون عمل 5%', basic_salary: 5660, actual_salary: 5660, insurance_basic: 5660, taxable_allowances: 1615, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 7, department: 'الإدارة', name: 'نبيل مساك جرس سرجان', code: '326', national_id: '28309042501191', insurance_no: '64319442', job_title: 'أمن', basic_salary: 8220, actual_salary: 8220, insurance_basic: 8220, taxable_allowances: 2451, non_taxable_allowances: 0, leave_bal: 25 },
    { seq: 8, department: 'الفلتر', name: 'عاصم عبد الرؤوف خله بخيت', code: '352', national_id: '27001012502271', insurance_no: '21783353', job_title: 'سائق', basic_salary: 8950, actual_salary: 8950, insurance_basic: 8950, taxable_allowances: 2676, non_taxable_allowances: 0, leave_bal: 25 },
    { seq: 9, department: 'الورشة', name: 'ادوار صالح يودان جرجس', code: '369', national_id: '27705122100412', insurance_no: '33819201', job_title: 'عامل صيانة', basic_salary: 6200, actual_salary: 6200, insurance_basic: 6200, taxable_allowances: 1800, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 10, department: 'الإنتاج', name: 'اسحق محروس زكي', code: '429', national_id: '28503112401928', insurance_no: '44910283', job_title: 'عامل تشغيل', basic_salary: 6500, actual_salary: 6500, insurance_basic: 6500, taxable_allowances: 1750, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 11, department: 'الحركة', name: 'أشرف روحي جويد', code: '359', national_id: '28204152104829', insurance_no: '55829103', job_title: 'سائق نقل', basic_salary: 7100, actual_salary: 7100, insurance_basic: 7100, taxable_allowances: 2100, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 12, department: 'الإنتاج', name: 'أمير رمزي فرحان', code: '422', national_id: '28810202501934', insurance_no: '66719204', job_title: 'فني ماكينة', basic_salary: 6800, actual_salary: 6800, insurance_basic: 6800, taxable_allowances: 1900, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 13, department: 'الأمن', name: 'عاطف ضحي رزق جرجس', code: '372', national_id: '27901052403912', insurance_no: '77819205', job_title: 'حارس أمن', basic_salary: 5800, actual_salary: 5800, insurance_basic: 5800, taxable_allowances: 1500, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 14, department: 'المخازن', name: 'باسم شلبي إبراهيم', code: '427', national_id: '28607142104829', insurance_no: '88910294', job_title: 'أمين مخزن', basic_salary: 7400, actual_salary: 7400, insurance_basic: 7400, taxable_allowances: 2200, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 15, department: 'الحركة', name: 'كمال طلعت برسوم', code: '374', national_id: '28109252503918', insurance_no: '99019283', job_title: 'سائق', basic_salary: 6900, actual_salary: 6900, insurance_basic: 6900, taxable_allowances: 2000, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 16, department: 'الإنتاج', name: 'مرقص بشري أناس', code: '375', national_id: '28403182402910', insurance_no: '11223344', job_title: 'عامل إنتاج', basic_salary: 6000, actual_salary: 6000, insurance_basic: 6000, taxable_allowances: 1600, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 17, department: 'الورشة', name: 'بنيوي رضا عبد الشهيد', code: '428', national_id: '28911022104928', insurance_no: '22334455', job_title: 'كهربائي', basic_salary: 7200, actual_salary: 7200, insurance_basic: 7200, taxable_allowances: 2150, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 18, department: 'الإنتاج', name: 'جرجس راضي خليل', code: '423', national_id: '28308192501928', insurance_no: '33445566', job_title: 'عامل تشغيل', basic_salary: 6100, actual_salary: 6100, insurance_basic: 6100, taxable_allowances: 1650, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 19, department: 'الإنتاج', name: 'جرجس سعيد يسى', code: '435', national_id: '28704222403918', insurance_no: '44556677', job_title: 'عامل تعبئة', basic_salary: 5900, actual_salary: 5900, insurance_basic: 5900, taxable_allowances: 1550, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 20, department: 'الحركة', name: 'متى سليمان هدهد سليمان', code: '355', national_id: '27806142104928', insurance_no: '55667788', job_title: 'سائق كلارك', basic_salary: 7000, actual_salary: 7000, insurance_basic: 7000, taxable_allowances: 2050, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 21, department: 'الإنتاج', name: 'رضا سعيد حنين', code: '358', national_id: '28005162503918', insurance_no: '66778899', job_title: 'فني إنتاج', basic_salary: 7300, actual_salary: 7300, insurance_basic: 7300, taxable_allowances: 2180, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 22, department: 'المخازن', name: 'روماني عبد الملاك بشاي', code: '360', national_id: '28612012401928', insurance_no: '77889900', job_title: 'مساعد مخازن', basic_salary: 6300, actual_salary: 6300, insurance_basic: 6300, taxable_allowances: 1700, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 23, department: 'الإنتاج', name: 'روماني عزيز برثلي', code: '353', national_id: '28203082103918', insurance_no: '88990011', job_title: 'عامل إنتاج', basic_salary: 5950, actual_salary: 5950, insurance_basic: 5950, taxable_allowances: 1580, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 24, department: 'الخدمات', name: 'روماني يعقوب بشري', code: '354', national_id: '28409152504918', insurance_no: '99001122', job_title: 'عامل خدمات', basic_salary: 5660, actual_salary: 5660, insurance_basic: 5660, taxable_allowances: 1615, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 25, department: 'الحركة', name: 'زكي حلمي غطاس', code: '361', national_id: '27508202403918', insurance_no: '10111213', job_title: 'سائق', basic_salary: 7800, actual_salary: 7800, insurance_basic: 7800, taxable_allowances: 2350, non_taxable_allowances: 0, leave_bal: 30 },
    { seq: 26, department: 'المبيعات', name: 'سامي دانيال حبيب استفانوس', code: '373', national_id: '28504112104918', insurance_no: '12131415', job_title: 'مندوب تسليم', basic_salary: 7500, actual_salary: 7500, insurance_basic: 7500, taxable_allowances: 2250, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 27, department: 'الإنتاج', name: 'سمعان سعيد حنين', code: '434', national_id: '28806192503918', insurance_no: '13141516', job_title: 'عامل إنتاج', basic_salary: 6150, actual_salary: 6150, insurance_basic: 6150, taxable_allowances: 1680, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 28, department: 'الورشة', name: 'سمير الديب عبد الشهيد', code: '430', national_id: '28111242403918', insurance_no: '14151617', job_title: 'ميكانيكي', basic_salary: 7600, actual_salary: 7600, insurance_basic: 7600, taxable_allowances: 2300, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 29, department: 'الفلتر', name: 'عاصم عبد المخلص', code: '432', national_id: '28701092104918', insurance_no: '15161718', job_title: 'عامل فلترة', basic_salary: 6250, actual_salary: 6250, insurance_basic: 6250, taxable_allowances: 1720, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 30, department: 'الحركة', name: 'عبد الملك عبد الملك', code: '425', national_id: '28307182503918', insurance_no: '16171819', job_title: 'سائق', basic_salary: 7150, actual_salary: 7150, insurance_basic: 7150, taxable_allowances: 2120, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 31, department: 'الإنتاج', name: 'عدم أيوب شحاتة', code: '357', national_id: '28003122403918', insurance_no: '17181920', job_title: 'عامل إنتاج', basic_salary: 6400, actual_salary: 6400, insurance_basic: 6400, taxable_allowances: 1780, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 32, department: 'الحركة', name: 'عماد مهاود عبد التواب', code: '426', national_id: '28509052104918', insurance_no: '18192021', job_title: 'سائق نقل', basic_salary: 7700, actual_salary: 7700, insurance_basic: 7700, taxable_allowances: 2320, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 33, department: 'الورشة', name: 'كامل شابر يني', code: '354-B', national_id: '28205212503918', insurance_no: '19202122', job_title: 'لحام', basic_salary: 6950, actual_salary: 6950, insurance_basic: 6950, taxable_allowances: 2020, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 34, department: 'الإنتاج', name: 'كيرلس ماهر فليبس', code: '433', national_id: '28908142403918', insurance_no: '20212223', job_title: 'فني جودة', basic_salary: 7350, actual_salary: 7350, insurance_basic: 7350, taxable_allowances: 2200, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 35, department: 'الإنتاج', name: 'ماجد اسحق وهبه ميخائيل', code: '362', national_id: '28402092104918', insurance_no: '21222324', job_title: 'مشرف وردية', basic_salary: 8500, actual_salary: 8500, insurance_basic: 8500, taxable_allowances: 2550, non_taxable_allowances: 0, leave_bal: 30 },
    { seq: 36, department: 'الخدمات', name: 'هاني بشاي رزق', code: '363', national_id: '28606182503918', insurance_no: '22232425', job_title: 'عامل خدمات', basic_salary: 5700, actual_salary: 5700, insurance_basic: 5700, taxable_allowances: 1620, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 37, department: 'الإنتاج', name: 'هاني بشري يودان', code: '421', national_id: '28812112403918', insurance_no: '23242526', job_title: 'عامل إنتاج', basic_salary: 6200, actual_salary: 6200, insurance_basic: 6200, taxable_allowances: 1700, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 38, department: 'الحركة', name: 'وجيه عدلي شفيق', code: '356', national_id: '27710252104918', insurance_no: '24252627', job_title: 'سائق', basic_salary: 7600, actual_salary: 7600, insurance_basic: 7600, taxable_allowances: 2280, non_taxable_allowances: 0, leave_bal: 25 },
    { seq: 39, department: 'المخازن', name: 'وليم رمزي عبد الملاك', code: '351', national_id: '28304162503918', insurance_no: '25262728', job_title: 'عامل مخازن', basic_salary: 5900, actual_salary: 5900, insurance_basic: 5900, taxable_allowances: 1600, non_taxable_allowances: 0, leave_bal: 21 },
    { seq: 40, department: 'الإنتاج', name: 'وليم يونان جندي', code: '364', national_id: '28108202403918', insurance_no: '26272829', job_title: 'عامل إنتاج', basic_salary: 6100, actual_salary: 6100, insurance_basic: 6100, taxable_allowances: 1650, non_taxable_allowances: 0, leave_bal: 21 }
  ];

  // Generate up to 60 employees
  const departments = ['الفلتر', 'الإنتاج', 'الحركة', 'الإدارة', 'المخازن', 'الورشة', 'الأمن'];
  const titles = ['سائق', 'عامل إنتاج', 'فني صيانة', 'محاسب', 'شئون عاملين', 'أمين مخزن', 'حارس أمن'];
  
  for (let i = 41; i <= 60; i++) {
    const code = (1000 + i).toString();
    const dept = departments[i % departments.length];
    const title = titles[i % titles.length];
    const basic = 5600 + (i * 50);
    const allow = Math.round(basic * 0.28);
    initialEmployees.push({
      seq: i,
      department: dept,
      name: `موظف نموذج تجريبي ${i} عادل`,
      code: code,
      national_id: `28${(70 + (i % 25)).toString().padStart(2, '0')}${(i % 12 + 1).toString().padStart(2, '0')}15210${(1000 + i)}`,
      insurance_no: (30000000 + i * 11111).toString(),
      job_title: title,
      basic_salary: basic,
      actual_salary: basic,
      insurance_basic: basic,
      taxable_allowances: allow,
      non_taxable_allowances: 0,
      leave_bal: 21
    });
  }

  const insertEmp = db.prepare(`
    INSERT INTO employees (seq, department, name, code, national_id, insurance_no, job_title, basic_salary, actual_salary, insurance_basic, taxable_allowances, non_taxable_allowances, annual_leave_balance, password)
    VALUES (@seq, @department, @name, @code, @national_id, @insurance_no, @job_title, @basic_salary, @actual_salary, @insurance_basic, @taxable_allowances, @non_taxable_allowances, @leave_bal, @password)
  `);

  const insertLoan = db.prepare(`
    INSERT INTO loans (employee_id, employee_code, employee_name, total_amount, months_count, monthly_installment, start_date, end_date, paid_installments, remaining_amount, status, notes)
    VALUES (@employee_id, @employee_code, @employee_name, @total_amount, @months_count, @monthly_installment, @start_date, @end_date, @paid_installments, @remaining_amount, @status, @notes)
  `);

  const insertExpense = db.prepare(`
    INSERT INTO mid_month_expenses (year, month, employee_id, employee_code, employee_name, amount_day_10, recipient_day_10, amount_day_20, recipient_day_20, total_amount, notes)
    VALUES (@year, @month, @employee_id, @employee_code, @employee_name, @amount_day_10, @recipient_day_10, @amount_day_20, @recipient_day_20, @total_amount, @notes)
  `);

  const insertLeave = db.prepare(`
    INSERT INTO leaves (employee_id, employee_code, employee_name, leave_type, start_date, end_date, days_count, reason, status)
    VALUES (@employee_id, @employee_code, @employee_name, @leave_type, @start_date, @end_date, @days_count, @reason, @status)
  `);

  const insertReq = db.prepare(`
    INSERT INTO employee_requests (employee_id, employee_code, employee_name, request_type, title, date_from, date_to, quantity, details, status)
    VALUES (@employee_id, @employee_code, @employee_name, @request_type, @title, @date_from, @date_to, @quantity, @details, @status)
  `);

  const runSeed = db.transaction(() => {
    initialEmployees.forEach(emp => {
      // Default password: last 6 digits of national_id or employee code
      const pwd = emp.code;
      const res = insertEmp.run({
        ...emp,
        password: pwd
      });
      const empId = res.lastInsertRowid;

      // Add sample loan for a few employees
      if (emp.code === '1001' || emp.code === '326' || emp.code === '359') {
        const total = emp.code === '1001' ? 12000 : 24000;
        const months = 12;
        const inst = total / months;
        insertLoan.run({
          employee_id: empId,
          employee_code: emp.code,
          employee_name: emp.name,
          total_amount: total,
          months_count: months,
          monthly_installment: inst,
          start_date: '2026-01',
          end_date: '2026-12',
          paid_installments: 8,
          remaining_amount: total - (inst * 8),
          status: 'active',
          notes: 'سلفة سنوية معتمدة بخصم شهري'
        });
      }

      // Add mid-month expenses for month 10 (matching Image 3)
      let d10 = 0;
      let d20 = 0;
      if (emp.code === '359') { d10 = 2000; }
      else if (emp.code === '422') { d10 = 1500; }
      else if (emp.code === '369') { d10 = 1000; }
      else if (emp.code === '427') { d10 = 2000; }
      else if (emp.code === '374') { d10 = 1000; }
      else if (emp.code === '428') { d10 = 1200; }
      else if (emp.code === '358') { d10 = 2000; d20 = 1000; }
      else if (emp.code === '360') { d10 = 2000; }
      else if (emp.code === '361') { d10 = 2000; }
      else if (emp.code === '357') { d10 = 2000; }
      else if (emp.code === '426') { d10 = 2000; }
      else if (emp.code === '363') { d10 = 2000; }
      else if (emp.code === '356') { d10 = 2000; d20 = 1000; }

      if (d10 > 0 || d20 > 0) {
        insertExpense.run({
          year: 2026,
          month: 10,
          employee_id: empId,
          employee_code: emp.code,
          employee_name: emp.name,
          amount_day_10: d10,
          recipient_day_10: d10 > 0 ? emp.name : '',
          amount_day_20: d20,
          recipient_day_20: d20 > 0 ? emp.name : '',
          total_amount: d10 + d20,
          notes: 'مصروفات منتصف الشهر'
        });
      }

      // Add an approved leave for sample
      if (emp.code === '1001') {
        insertLeave.run({
          employee_id: empId,
          employee_code: emp.code,
          employee_name: emp.name,
          leave_type: 'سنوية',
          start_date: '2026-09-10',
          end_date: '2026-09-12',
          days_count: 3,
          reason: 'ظروف عائلية خاصة',
          status: 'approved'
        });

        // Sample pending request in portal
        insertReq.run({
          employee_id: empId,
          employee_code: emp.code,
          employee_name: emp.name,
          request_type: 'overtime',
          title: 'طلب احتساب ساعات إضافية لوردية مسائية',
          date_from: '2026-10-18',
          date_to: '2026-10-18',
          quantity: 4,
          details: 'العمل على خط الفلتر المسائي لتغطية زيادة الإنتاج',
          status: 'pending'
        });
      }
    });
  });

  runSeed();
  console.log('Seed completed successfully!');
}

export default db;
