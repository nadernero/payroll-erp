-- ==============================================================================
-- Payroll ERP System - Supabase PostgreSQL Schema
-- Database: PostgreSQL 15+ (Supabase)
-- ==============================================================================

-- 1. Enable UUID and Crypto extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Employees Table (جدول الموظفين)
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    seq INTEGER,
    department TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    national_id TEXT NOT NULL,
    insurance_no TEXT,
    job_title TEXT NOT NULL,
    basic_salary NUMERIC(14, 2) NOT NULL DEFAULT 0,
    actual_salary NUMERIC(14, 2) NOT NULL DEFAULT 0,
    insurance_basic NUMERIC(14, 2) NOT NULL DEFAULT 0,
    taxable_allowances NUMERIC(14, 2) NOT NULL DEFAULT 0,
    non_taxable_allowances NUMERIC(14, 2) NOT NULL DEFAULT 0,
    medical_insurance NUMERIC(14, 2) NOT NULL DEFAULT 0,
    annual_leave_balance NUMERIC(6, 1) NOT NULL DEFAULT 21,
    status TEXT NOT NULL DEFAULT 'active',
    password TEXT,
    phone TEXT,
    pin_code TEXT,
    exclude_from_payroll INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Attendance Table (جدول الحضور والانصراف والغياب والخصومات)
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
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
    overtime_hours NUMERIC(6, 2) DEFAULT 0,
    overtime_days NUMERIC(6, 2) DEFAULT 0,
    absence_days NUMERIC(6, 2) DEFAULT 1,
    is_absent INTEGER DEFAULT 0,
    is_annual_leave INTEGER DEFAULT 0,
    is_overnight INTEGER DEFAULT 0,
    is_holiday INTEGER DEFAULT 0,
    notes TEXT,
    UNIQUE(employee_code, date)
);

-- 4. Mid-Month Cash Expenses (جدول مصروفات الشهور يوم 10 و 20 المنصرفة من الخزينة)
CREATE TABLE IF NOT EXISTS mid_month_expenses (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    employee_code TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    amount_day_10 NUMERIC(14, 2) DEFAULT 0,
    recipient_day_10 TEXT,
    amount_day_20 NUMERIC(14, 2) DEFAULT 0,
    recipient_day_20 TEXT,
    total_amount NUMERIC(14, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(year, month, employee_id)
);

-- 5. Long-term Loans Table (جدول السلف طويلة الأجل)
CREATE TABLE IF NOT EXISTS loans (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    employee_code TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    total_amount NUMERIC(14, 2) NOT NULL,
    months_count INTEGER NOT NULL,
    monthly_installment NUMERIC(14, 2) NOT NULL,
    start_date TEXT NOT NULL, -- YYYY-MM
    end_date TEXT NOT NULL,   -- YYYY-MM
    paid_installments INTEGER DEFAULT 0,
    remaining_amount NUMERIC(14, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- active, completed, paused
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. Leaves Table (جدول الإجازات الرسمية والعارضة والسنوية)
CREATE TABLE IF NOT EXISTS leaves (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    employee_code TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    leave_type TEXT NOT NULL DEFAULT 'سنوية',
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    days_count NUMERIC(6, 2) NOT NULL DEFAULT 1,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'approved',
    approved_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. Employee Requests Table (جدول طلبات بوابة الموظف وبوابة المخازن)
CREATE TABLE IF NOT EXISTS employee_requests (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    employee_code TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    request_type TEXT NOT NULL, -- leave, overtime, loan, deduction, payslip_request
    title TEXT NOT NULL,
    date_from TEXT,
    date_to TEXT,
    quantity NUMERIC(14, 2) DEFAULT 1,
    details TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, pending_manager, approved, rejected
    manager_status TEXT DEFAULT 'pending',
    manager_notes TEXT,
    submitted_by TEXT DEFAULT 'employee',
    on_behalf_of INTEGER DEFAULT 0,
    admin_response TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. Payroll Runs Table (جدول دورات ومسيرات المرتبات الشهرية)
CREATE TABLE IF NOT EXISTS payroll_runs (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    title TEXT NOT NULL,
    payroll_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft', -- draft, approved, closed
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(year, month)
);

-- 9. Payroll Items Table (جدول بنود مرتبات الموظفين المفصلة)
CREATE TABLE IF NOT EXISTS payroll_items (
    id SERIAL PRIMARY KEY,
    payroll_run_id INTEGER NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    seq INTEGER,
    department TEXT,
    employee_name TEXT NOT NULL,
    employee_code TEXT NOT NULL,
    national_id TEXT,
    insurance_no TEXT,
    job_title TEXT,
    
    -- الاستحقاقات
    basic_salary NUMERIC(14, 2) DEFAULT 0,
    actual_salary NUMERIC(14, 2) DEFAULT 0,
    insurance_basic NUMERIC(14, 2) DEFAULT 0,
    taxable_allowances NUMERIC(14, 2) DEFAULT 0,
    non_taxable_allowances NUMERIC(14, 2) DEFAULT 0,
    total_allowances NUMERIC(14, 2) DEFAULT 0,
    total_entitlement NUMERIC(14, 2) DEFAULT 0,
    
    -- الإضافي
    overtime_day_value NUMERIC(14, 2) DEFAULT 0,
    overtime_days NUMERIC(6, 2) DEFAULT 0,
    total_overtime NUMERIC(14, 2) DEFAULT 0,
    
    -- مكافآت واشتراكات
    bonus_days NUMERIC(6, 2) DEFAULT 0,
    total_bonuses NUMERIC(14, 2) DEFAULT 0,
    bonus_name TEXT,
    exempt_bonuses NUMERIC(14, 2) DEFAULT 0,
    non_taxable_deductions NUMERIC(14, 2) DEFAULT 0,
    
    -- الاستقطاعات
    expenses NUMERIC(14, 2) DEFAULT 0, -- مصروفات 10 و 20
    absence_day_value NUMERIC(14, 2) DEFAULT 0,
    absence_days NUMERIC(6, 2) DEFAULT 0,
    total_absence NUMERIC(14, 2) DEFAULT 0,
    penalty_days NUMERIC(6, 2) DEFAULT 0,
    total_penalties NUMERIC(14, 2) DEFAULT 0,
    social_insurance NUMERIC(14, 2) DEFAULT 0,
    medical_insurance NUMERIC(14, 2) DEFAULT 0,
    tax NUMERIC(14, 2) DEFAULT 0,
    total_deductions NUMERIC(14, 2) DEFAULT 0,
    
    -- السلف والصافي
    loan_installment NUMERIC(14, 2) DEFAULT 0,
    gross_after_deductions NUMERIC(14, 2) DEFAULT 0,
    net_salary NUMERIC(14, 2) DEFAULT 0,
    
    notes TEXT
);

-- 10. Biometric Devices (ماكينات البصمة ZKTeco)
CREATE TABLE IF NOT EXISTS biometric_devices (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    ip TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 4370,
    protocol TEXT NOT NULL DEFAULT 'udp',
    timeout INTEGER NOT NULL DEFAULT 5000,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    last_sync_at TIMESTAMPTZ,
    last_sync_status TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. Salary Progression History (سجل تدرج الرواتب والزيادات السنوية)
CREATE TABLE IF NOT EXISTS salary_history (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    employee_code TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    year INTEGER NOT NULL,
    effective_date TEXT NOT NULL,
    increase_percent NUMERIC(6, 2) DEFAULT 0,
    old_actual_salary NUMERIC(14, 2) NOT NULL,
    new_actual_salary NUMERIC(14, 2) NOT NULL,
    old_basic_salary NUMERIC(14, 2) NOT NULL,
    new_basic_salary NUMERIC(14, 2) NOT NULL,
    old_insurance_basic NUMERIC(14, 2) NOT NULL,
    new_insurance_basic NUMERIC(14, 2) NOT NULL,
    old_taxable_allowances NUMERIC(14, 2) NOT NULL,
    new_taxable_allowances NUMERIC(14, 2) NOT NULL,
    old_non_taxable_allowances NUMERIC(14, 2) NOT NULL,
    new_non_taxable_allowances NUMERIC(14, 2) NOT NULL,
    old_medical_insurance NUMERIC(14, 2) DEFAULT 0,
    new_medical_insurance NUMERIC(14, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 12. Cash Safes (جدول الخزائن الرئيسية والفرعية)
CREATE TABLE IF NOT EXISTS cash_safes (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'main' CHECK(type IN ('main', 'sub')),
    parent_safe_id INTEGER REFERENCES cash_safes(id),
    custodian_name TEXT,
    custodian_phone TEXT,
    custodian_employee_id INTEGER REFERENCES employees(id),
    current_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 13. External Parties (جهات التعامل الخارجي - الموردين والشركات)
CREATE TABLE IF NOT EXISTS treasury_parties (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    party_type TEXT NOT NULL DEFAULT 'company',
    category TEXT,
    contact_person TEXT,
    phone TEXT,
    tax_no TEXT,
    address TEXT,
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 14. Cash Transactions (سجل حركة الخزائن - الوارد والمصروف والتحويلات)
CREATE TABLE IF NOT EXISTS cash_transactions (
    id SERIAL PRIMARY KEY,
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
    amount NUMERIC(14, 2) NOT NULL,
    balance_before NUMERIC(14, 2) NOT NULL DEFAULT 0,
    balance_after NUMERIC(14, 2) NOT NULL,
    description TEXT NOT NULL,
    reference_no TEXT,
    related_employee_id INTEGER REFERENCES employees(id),
    related_employee_name TEXT,
    related_safe_id INTEGER REFERENCES cash_safes(id),
    sender_phone TEXT,
    transaction_date TEXT NOT NULL,
    notes TEXT,
    created_by TEXT DEFAULT 'admin',
    recipient_type TEXT DEFAULT 'employee',
    party_id INTEGER REFERENCES treasury_parties(id),
    party_name TEXT,
    category TEXT,
    invoice_no TEXT,
    packs_detail TEXT,
    receipt_image TEXT,
    cost_center TEXT,
    crop_type TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 15. Cash Denominations (فئات الأوراق النقدية والبواكي والفكة في الدرج)
CREATE TABLE IF NOT EXISTS cash_denominations (
    id SERIAL PRIMARY KEY,
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
    packs_200 INTEGER DEFAULT 0,
    loose_200 INTEGER DEFAULT 0,
    packs_100 INTEGER DEFAULT 0,
    loose_100 INTEGER DEFAULT 0,
    packs_50 INTEGER DEFAULT 0,
    loose_50 INTEGER DEFAULT 0,
    packs_20 INTEGER DEFAULT 0,
    loose_20 INTEGER DEFAULT 0,
    packs_10 INTEGER DEFAULT 0,
    loose_10 INTEGER DEFAULT 0,
    packs_5 INTEGER DEFAULT 0,
    loose_5 INTEGER DEFAULT 0,
    total_physical NUMERIC(14, 2) NOT NULL DEFAULT 0,
    book_balance   NUMERIC(14, 2) NOT NULL DEFAULT 0,
    difference     NUMERIC(14, 2) NOT NULL DEFAULT 0,
    tafqeet_text TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 16. Official Holidays (جدول الإجازات الرسمية للدولة)
CREATE TABLE IF NOT EXISTS official_holidays (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    holiday_date TEXT NOT NULL UNIQUE,
    year INTEGER NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 17. Cash Trusts (الأمانات والعهد المؤقتة للموظفين والأشخاص ومواعيد الرد)
CREATE TABLE IF NOT EXISTS cash_trusts (
    id SERIAL PRIMARY KEY,
    safe_id INTEGER NOT NULL REFERENCES cash_safes(id),
    person_type TEXT NOT NULL DEFAULT 'employee',
    employee_id INTEGER REFERENCES employees(id),
    person_name TEXT NOT NULL,
    person_phone TEXT,
    person_national_id TEXT,
    amount NUMERIC(14, 2) NOT NULL,
    returned_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    remaining_amount NUMERIC(14, 2) NOT NULL,
    given_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    return_date TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    purpose TEXT,
    notes TEXT,
    disburse_tx_id INTEGER REFERENCES cash_transactions(id),
    return_tx_id INTEGER REFERENCES cash_transactions(id),
    created_by TEXT DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 18. Cash Trust Returns (سجلات رد واسترداد الأمانات)
CREATE TABLE IF NOT EXISTS cash_trust_returns (
    id SERIAL PRIMARY KEY,
    trust_id INTEGER NOT NULL REFERENCES cash_trusts(id) ON DELETE CASCADE,
    safe_id INTEGER NOT NULL REFERENCES cash_safes(id),
    amount NUMERIC(14, 2) NOT NULL,
    return_date TEXT NOT NULL,
    notes TEXT,
    tx_id INTEGER REFERENCES cash_transactions(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- Indexes for High Performance
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_employees_code ON employees(code);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_emp_code ON attendance(employee_code);
CREATE INDEX IF NOT EXISTS idx_payroll_items_run ON payroll_items(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_emp ON payroll_items(employee_id);
CREATE INDEX IF NOT EXISTS idx_loans_emp ON loans(employee_id);
CREATE INDEX IF NOT EXISTS idx_cash_tx_safe ON cash_transactions(safe_id);
CREATE INDEX IF NOT EXISTS idx_cash_tx_date ON cash_transactions(transaction_date);

-- ==============================================================================
-- Initial Seed (Default Main Safe & Sample Parties)
-- ==============================================================================
INSERT INTO cash_safes (name, type, custodian_name, current_balance, notes)
SELECT 'الخزينة الرئيسية', 'main', 'أمين الخزينة الرئيسي', 0, 'الخزينة الرئيسية للشركة'
WHERE NOT EXISTS (SELECT 1 FROM cash_safes WHERE type = 'main');

INSERT INTO treasury_parties (name, party_type, category, contact_person, phone, notes)
VALUES
  ('شركة النيل لتوريد أحبار وماكينات الطباعة', 'company', 'أحبار وطابعات', 'م. أحمد شكري', '01012345678', 'توريد أحبار أصلية وصيانة طابعات الـ HP والإبسون'),
  ('مؤسسة التقنية الذكية للأنظمة وكاميرات المراقبة', 'company', 'كاميرات ومراقبة', 'م. محمد عبد المنعم', '01198765432', 'توريد وتركيب كاميرات المراقبة وأجهزة الإنذار والشبكات'),
  ('مركز الأهرام لخدمات وصيانة الإطارات والكاوتش', 'supplier', 'صيانة سيارات وكاوتش', 'الأسطى رجب', '01234567890', 'صيانة كاوتش، ترصيص، وبنشر سيارات الشركة'),
  ('شركة الهلال للمهمات وأدوات النظافة والبوفيه', 'supplier', 'مهمات تشغيل ونظافة', 'أ. طارق عبد العظيم', '01087654321', 'مستلزمات نظافة دورية ومواد التطهير ومشتريات البوفيه')
ON CONFLICT (name) DO NOTHING;

-- ==============================================================================
-- Supabase Storage Bucket for Invoices & Receipts
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;
