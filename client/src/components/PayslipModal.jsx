import React, { useState, useEffect } from 'react';
import { Printer, X, Building2, User, Calendar, CreditCard, ShieldCheck, RefreshCw } from 'lucide-react';
import { fetchJson } from '../utils/api';

export default function PayslipModal({ item, run, onClose, allowPrint = true }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (item && run) {
      setLoading(true);
      fetchJson(`/payroll/payslip/${item.employee_id}/${run.id}`)
        .then(data => setDetails(data))
        .catch(err => {
          console.error(err);
        })
        .finally(() => setLoading(false));
    }
  }, [item, run]);

  if (!item) return null;

  const handlePrint = () => {
    window.print();
  };

  const currentItem = details?.item || item;
  const employee = details?.employee || {};
  const attendanceLogs = details?.attendanceLogs || [];
  const leaveHistory = details?.leaveHistory || [];
  const remainingLoan = details?.remainingLoanAmount !== undefined ? details.remainingLoanAmount : 0;
  const initialLeaveBalance = details?.annualLeaveBalanceStart || employee.annual_leave_balance || 21;

  // Build 1..31 days table for this month
  const y = run?.year || new Date().getFullYear();
  const m = run?.month || (new Date().getMonth() + 1);
  const daysInMonth = new Date(y, m, 0).getDate();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[96vh] flex flex-col">
        {/* Action Header (Hidden when printing) */}
        <div className="flex items-center justify-between p-4 bg-slate-100 border-b border-slate-200 no-print shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">
              قسيمة راتب الموظف التفصيلية (نموذج كشف الحساب والرواتب الرسمي)
            </span>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[11px] font-mono font-bold rounded">
              كود: {currentItem.employee_code}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {allowPrint ? (
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all"
              >
                <Printer className="w-4 h-4" />
                طباعة القسيمة (Print)
              </button>
            ) : (
              <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold">
                للاطلاع فقط (الطباعة غير مسموحة من البوابة)
              </span>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Body */}
        <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-4 text-slate-900 bg-white" id="printable-payslip">
          {/* Company & Employee Master Header (as in Excel Sheet) */}
          <div className="border border-slate-900 rounded-xl overflow-hidden text-xs">
            <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-x-reverse divide-slate-800 bg-slate-100 font-bold text-center border-b border-slate-800 py-1.5">
              <div>اسم الموظف</div>
              <div className="text-blue-900 font-black">{currentItem.employee_name}</div>
              <div>الكود</div>
              <div className="font-mono text-blue-900 font-black">{currentItem.employee_code}</div>
              <div className="font-sans font-bold">{currentItem.job_title || 'سائق / عامل'}</div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-x-reverse divide-slate-300 text-center py-1 text-[11px] bg-slate-50 font-mono">
              <div>القسم: <span className="font-sans font-bold text-slate-800">{currentItem.department}</span></div>
              <div>تاريخ الكشف: <span className="font-bold text-slate-800">{run?.payroll_date || `${y}/${m}/${daysInMonth}`}</span></div>
              <div>الرقم التأميني: <span className="font-bold">{currentItem.insurance_no || '-'}</span></div>
              <div>الرقم القومي: <span className="font-bold">{currentItem.national_id || '-'}</span></div>
            </div>
          </div>

          {/* Main Financial Statement */}
          <div className="space-y-4">
            {/* Earnings vs Deductions Table (Exact matching of Excel columns) */}
            <div className="border-2 border-slate-900 rounded-xl overflow-hidden text-xs font-mono">
              <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-slate-200 font-bold border-b border-slate-800 text-slate-900 font-sans">
                      <th className="py-2 px-2 border-l border-slate-800 w-1/4">الاستحقاقات</th>
                      <th className="py-2 px-2 border-l border-slate-800 w-1/4">المبلغ</th>
                      <th className="py-2 px-2 border-l border-slate-800 w-1/4">الاستقطاعات</th>
                      <th className="py-2 px-2 w-1/4">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 text-[11px]">
                    <tr>
                      <td className="py-1 px-2 font-sans text-right bg-slate-50 border-l border-slate-400">قيمة اليوم</td>
                      <td className="py-1 px-2 border-l border-slate-400 font-bold">{currentItem.overtime_day_value || 0}</td>
                      <td className="py-1 px-2 font-sans text-right bg-slate-50 border-l border-slate-400">أيام الغياب</td>
                      <td className="py-1 px-2 font-bold text-rose-700">{currentItem.total_absence || 0}</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 font-sans text-right bg-slate-50 border-l border-slate-400">راتب أساسي</td>
                      <td className="py-1 px-2 border-l border-slate-400 font-bold">{currentItem.basic_salary?.toFixed(2)}</td>
                      <td className="py-1 px-2 font-sans text-right bg-slate-50 border-l border-slate-400">أيام جزاءات</td>
                      <td className="py-1 px-2 font-bold text-rose-700">{(currentItem.total_penalties || 0).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 font-sans text-right bg-slate-50 border-l border-slate-400">بدل معفي</td>
                      <td className="py-1 px-2 border-l border-slate-400">{(currentItem.non_taxable_allowances || 0).toFixed(2)}</td>
                      <td className="py-1 px-2 font-sans text-right bg-slate-50 border-l border-slate-400">تأخير</td>
                      <td className="py-1 px-2">0.00</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 font-sans text-right bg-slate-50 border-l border-slate-400">بدل غير معفي</td>
                      <td className="py-1 px-2 border-l border-slate-400">{(currentItem.taxable_allowances || 0).toFixed(2)}</td>
                      <td className="py-1 px-2 font-sans text-right bg-slate-50 border-l border-slate-400">انصراف مبكر</td>
                      <td className="py-1 px-2">0.00</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 font-sans text-right bg-slate-50 border-l border-slate-400">إجمالي البدلات</td>
                      <td className="py-1 px-2 border-l border-slate-400 font-bold">{(currentItem.total_allowances || 0).toFixed(2)}</td>
                      <td className="py-1 px-2 font-sans text-right bg-slate-50 border-l border-slate-400">إجمالي الجزاءات</td>
                      <td className="py-1 px-2 font-bold text-rose-700">{(currentItem.total_penalties || 0).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 font-sans text-right bg-slate-50 border-l border-slate-400">له</td>
                      <td className="py-1 px-2 border-l border-slate-400">0.00</td>
                      <td className="py-1 px-2 font-sans text-right bg-slate-50 border-l border-slate-400">نصيب العامل تأمينات (11%)</td>
                      <td className="py-1 px-2 font-bold">{(currentItem.social_insurance || 0).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 font-sans text-right bg-slate-50 border-l border-slate-400">أيام إضافي</td>
                      <td className="py-1 px-2 border-l border-slate-400 text-blue-700 font-bold">{currentItem.overtime_days || 0}</td>
                      <td className="py-1 px-2 font-sans text-right bg-slate-50 border-l border-slate-400">سلفة</td>
                      <td className="py-1 px-2 font-bold text-indigo-700">{(currentItem.loan_installment || 0).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 font-sans text-right bg-slate-50 border-l border-slate-400">قيمة الإضافي</td>
                      <td className="py-1 px-2 border-l border-slate-400 text-blue-700 font-bold">{(currentItem.total_overtime || 0).toFixed(2)}</td>
                      <td className="py-1 px-2 font-sans text-right bg-slate-50 border-l border-slate-400">مصروف</td>
                      <td className="py-1 px-2 font-bold text-amber-800">{(currentItem.expenses || 0).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 font-sans text-right bg-slate-50 border-l border-slate-400">إجمالي المكافآت</td>
                      <td className="py-1 px-2 border-l border-slate-400">{(currentItem.total_bonuses || 0).toFixed(2)}</td>
                      <td className="py-1 px-2 font-sans text-right bg-slate-50 border-l border-slate-400 text-teal-900 font-semibold">تأمين طبي خاص</td>
                      <td className="py-1 px-2 font-bold text-teal-800">{(currentItem.medical_insurance || 0).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 bg-slate-50 border-l border-slate-400">-</td>
                      <td className="py-1 px-2 border-l border-slate-400">-</td>
                      <td className="py-1 px-2 font-sans text-right bg-slate-50 border-l border-slate-400">ضرائب</td>
                      <td className="py-1 px-2 font-bold">{(currentItem.tax || 0).toFixed(2)}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-200 font-bold border-t-2 border-slate-900 text-slate-900 text-xs">
                      <td className="py-2 px-2 border-l border-slate-800 font-sans">إجمالي الاستحقاقات</td>
                      <td className="py-2 px-2 border-l border-slate-800 font-bold text-emerald-900">
                        {((currentItem.total_entitlement || 0) + (currentItem.total_overtime || 0) + (currentItem.total_bonuses || 0)).toFixed(2)}
                      </td>
                      <td className="py-2 px-2 border-l border-slate-800 font-sans">إجمالي الاستقطاعات</td>
                      <td className="py-2 px-2 font-bold text-rose-900">
                        {((currentItem.total_deductions || 0) + (currentItem.loan_installment || 0)).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Net Salary & Remaining Loan Highlights (as prominent Red Box in Excel) */}
              <div className="grid grid-cols-2 gap-3">
                {/* Net Salary Red Highlight Cell */}
                <div className="p-3 bg-rose-600 text-white rounded-xl text-center border-2 border-rose-800 shadow-sm flex flex-col justify-center">
                  <span className="text-[11px] font-sans font-bold text-rose-100 block">صافي الراتب المستحق</span>
                  <span className="text-2xl font-black font-mono tracking-tight">
                    {currentItem.net_salary?.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-rose-200 font-sans">جنيه مصري</span>
                </div>

                {/* Remaining Loan Box */}
                <div className="p-3 bg-purple-50 text-purple-900 rounded-xl text-center border-2 border-purple-300 flex flex-col justify-center">
                  <span className="text-[11px] font-sans font-bold text-purple-700 block">باقي السلفة</span>
                  <span className="text-xl font-black font-mono">
                    {remainingLoan?.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-purple-600 font-sans">جنيه مصري</span>
                </div>
              </div>

              {/* Annual Leave Register (Exact matching of bottom left Excel section) */}
              <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
                <div className="bg-slate-200 px-3 py-1.5 font-bold text-slate-900 flex justify-between items-center border-b border-slate-800 font-sans">
                  <span>سجل الإجازات لعام {y}</span>
                  <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-400 text-emerald-800">
                    رصيد البداية: {initialLeaveBalance} يوم
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-center border-collapse text-[11px] font-mono">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-sans font-semibold">
                        <th className="py-1 px-1 border-l border-slate-300">الشهر</th>
                        <th className="py-1 px-1 border-l border-slate-300">تاريخ</th>
                        <th className="py-1 px-2 border-l border-slate-300">بيان</th>
                        <th className="py-1 px-1 border-l border-slate-300 text-rose-700">منصرف</th>
                        <th className="py-1 px-1 text-emerald-800">رصيد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {leaveHistory.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="py-3 text-center text-slate-400 font-sans">
                            لا توجد إجازات مستهلكة لهذا الموظف خلال العام
                          </td>
                        </tr>
                      ) : (
                        leaveHistory.map((lh, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-1 px-1 border-l border-slate-200 font-sans">{lh.start_date.split('-')[1]}</td>
                            <td className="py-1 px-1 border-l border-slate-200">{lh.start_date}</td>
                            <td className="py-1 px-2 border-l border-slate-200 font-sans text-right">{lh.leave_type} - {lh.reason || 'إجازة رسمية'}</td>
                            <td className="py-1 px-1 border-l border-slate-200 font-bold text-rose-700">{lh.days_count || 1}</td>
                            <td className="py-1 px-1 font-bold text-emerald-800">{lh.remaining_after}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          {/* Official Signatures Row */}
          <div className="grid grid-cols-3 gap-6 pt-4 border-t border-slate-300 text-center text-xs text-slate-600 font-sans">
            <div>
              <p className="font-bold mb-4">المحاسب المسؤول</p>
              <div className="border-b border-dashed border-slate-400 w-32 mx-auto"></div>
            </div>
            <div>
              <p className="font-bold mb-4">مدير الموارد البشرية</p>
              <div className="border-b border-dashed border-slate-400 w-32 mx-auto"></div>
            </div>
            <div>
              <p className="font-bold mb-4">توقيع الموظف بالاستلام</p>
              <div className="border-b border-dashed border-slate-400 w-32 mx-auto"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
