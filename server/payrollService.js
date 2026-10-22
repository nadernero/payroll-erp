/**
 * Payroll Calculation Engine
 * 
 * Rules requested by user:
 * 1. قيمة اليوم الإضافي = مرتب فعلي / 30 يوم (ولا يتم احتساب ضرائب عليه)
 * 2. قيمة يوم الخصم أو الغياب = (إجمالي المرتب الأساسي + إجمالي البدلات) / 30 يوم (ويتم احتساب الضرائب عليه)
 * 3. إجمالي الاستحقاق = المرتب الأساسي + إجمالي البدلات
 * 4. المصروفات: مجموع مصروفات يوم 10 و 20 من نفس الشهر
 * 5. السلف: قسط السلفة للشهر الحالي
 * 6. التأمينات الاجتماعية: 11% من أساسي التأمينات (أو حسب الشيت)
 * 7. صافي المرتب = إجمالي الاستحقاقات + الإضافي + المكافآت - إجمالي الاستقطاعات - قسط السلفة
 */

export function calculatePayrollItem({
  basic_salary = 0,
  actual_salary = 0,
  insurance_basic = 0,
  taxable_allowances = 0,
  non_taxable_allowances = 0,
  overtime_days = 0,
  bonus_days = 0,
  total_bonuses = 0,
  bonus_is_taxable = false, // المكافآت المالية الممنوحة (عدية/أعياد/مدارس) معفاة من الضرائب طبقا لطلب المستخدم
  absence_days = 0,
  penalty_days = 0,
  mid_month_expenses = 0,
  loan_installment = 0,
  custom_insurance = null,
  custom_tax = null,
  non_taxable_deductions = 0,
  medical_insurance = 0
}) {
  const basic = Number(basic_salary) || 0;
  const actual = Number(actual_salary) || (basic);
  const insBasic = Number(insurance_basic) || basic;
  const taxAllow = Number(taxable_allowances) || 0;
  const nonTaxAllow = Number(non_taxable_allowances) || 0;
  const otDays = Number(overtime_days) || 0;
  const absDays = Number(absence_days) || 0;
  const penDays = Number(penalty_days) || 0;
  const expenses = Number(mid_month_expenses) || 0;
  const loanInst = Number(loan_installment) || 0;
  const nonTaxDed = Number(non_taxable_deductions) || 0;
  const medIns = Number(medical_insurance) || 0;

  // 1. إجمالي البدلات
  const total_allowances = round(taxAllow + nonTaxAllow);

  // 2. إجمالي الاستحقاق = المرتب الأساسي + إجمالي البدلات
  const total_entitlement = round(basic + total_allowances);

  // 3. قيمة اليوم الإضافي = مرتب فعلي / 30 يوم (بدون ضرائب)
  const overtime_day_value = round(actual / 30);
  const total_overtime = round(otDays * overtime_day_value);

  // 4. قيمة يوم الخصم أو الغياب = (إجمالي المرتب الأساسي + إجمالي البدلات) / 30 يوم
  const absence_day_value = round((basic + total_allowances) / 30);
  const total_absence = round(absDays * absence_day_value);
  const total_penalties = round(penDays * absence_day_value);

  // 5. المكافآت
  let bonuses = Number(total_bonuses) || 0;
  if (!bonuses && bonus_days > 0) {
    bonuses = round(bonus_days * (basic / 30));
  }

  // 6. التأمينات الاجتماعية: 11% من أساسي التأمينات (حصّة العامل)
  let social_insurance = 0;
  if (custom_insurance !== null && custom_insurance !== undefined) {
    social_insurance = Number(custom_insurance);
  } else {
    social_insurance = round(insBasic * 0.11);
  }

  // 7. الضرائب (ضريبة كسب العمل المصرية)
  let tax = 0;
  if (custom_tax !== null && custom_tax !== undefined) {
    tax = Number(custom_tax);
  } else {
    // حساب الوعاء الضريبي الشهري:
    // (المرتب الأساسي + البدلات الخاضعة + المكافآت الخاضعة) - (الغياب الخاضع للضريبة + الجزاءات) - التأمينات الاجتماعية - الإعفاء الشخصي الشهري (20,000 / 12 = 1666.67)
    const taxableBonuses = bonus_is_taxable ? bonuses : 0;
    const personalExemptionMonthly = 20000 / 12;
    const taxableIncomeMonthly = Math.max(0, 
      (basic + taxAllow + taxableBonuses) - (total_absence + total_penalties) - social_insurance - personalExemptionMonthly
    );
    const annualizedTaxable = taxableIncomeMonthly * 12;
    const annualTax = calculateEgyptianTaxAnnual(annualizedTaxable);
    tax = round(annualTax / 12);
  }

  // 8. إجمالي الاستقطاعات
  // يشمل: التأمينات + الضرائب + الغياب + الجزاءات + المصروفات + اشتراك التأمين الطبي الخاص (خاضع للضريبة) + اشتراكات غير خاضعة
  const total_deductions = round(
    total_absence + total_penalties + social_insurance + tax + expenses + medIns + nonTaxDed
  );

  // 9. إجمالي المرتب بعد الاستقطاعات
  const gross_after_deductions = round(
    (total_entitlement + total_overtime + bonuses) - total_deductions
  );

  // 10. صافي المرتب بعد خصم قسط السلفة
  const net_salary = round(gross_after_deductions - loanInst);

  return {
    basic_salary: basic,
    actual_salary: actual,
    insurance_basic: insBasic,
    taxable_allowances: taxAllow,
    non_taxable_allowances: nonTaxAllow,
    total_allowances,
    total_entitlement,
    overtime_day_value,
    overtime_days: otDays,
    total_overtime,
    bonus_days: Number(bonus_days) || 0,
    total_bonuses: bonuses,
    non_taxable_deductions: nonTaxDed,
    medical_insurance: medIns,
    expenses,
    absence_day_value,
    absence_days: absDays,
    total_absence,
    penalty_days: penDays,
    total_penalties,
    social_insurance,
    tax,
    total_deductions,
    gross_after_deductions,
    loan_installment: loanInst,
    net_salary
  };
}

// ضريبة الدخل السنوية طبقا لقانون الضرائب المصري الحالي (شرائح كسب العمل)
export function calculateEgyptianTaxAnnual(taxableAnnual) {
  if (taxableAnnual <= 40000) return 0;
  let tax = 0;
  let remaining = taxableAnnual;

  // شريحة 1: حتى 40,000 (0%)
  remaining -= 40000;

  // شريحة 2: 40,000 إلى 55,000 (10%)
  if (remaining > 0) {
    const chunk = Math.min(remaining, 15000);
    tax += chunk * 0.10;
    remaining -= chunk;
  }

  // شريحة 3: 55,000 إلى 70,000 (15%)
  if (remaining > 0) {
    const chunk = Math.min(remaining, 15000);
    tax += chunk * 0.15;
    remaining -= chunk;
  }

  // شريحة 4: 70,000 إلى 200,000 (20%)
  if (remaining > 0) {
    const chunk = Math.min(remaining, 130000);
    tax += chunk * 0.20;
    remaining -= chunk;
  }

  // شريحة 5: 200,000 إلى 400,000 (22.5%)
  if (remaining > 0) {
    const chunk = Math.min(remaining, 200000);
    tax += chunk * 0.225;
    remaining -= chunk;
  }

  // شريحة 6: ما زاد عن 400,000 (25%)
  if (remaining > 0) {
    tax += remaining * 0.25;
  }

  return tax;
}

function round(val) {
  return Math.round((Number(val) + Number.EPSILON) * 100) / 100;
}
