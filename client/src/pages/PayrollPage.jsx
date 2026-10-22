import React, { useState, useEffect } from 'react';
import { 
  Calculator, Download, Printer, Search, RefreshCw, 
  FileSpreadsheet, Edit3, X, CheckCircle2, ChevronRight, Eye,
  Gift, FileText, CheckSquare, Square, ShieldCheck
} from 'lucide-react';
import { fetchJson } from '../utils/api';
import PayslipModal from '../components/PayslipModal';
import OfficialSalaryStatementModal from '../components/OfficialSalaryStatementModal';
import BalancesReportModal from '../components/BalancesReportModal';

export default function PayrollPage() {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(9);
  const [runs, setRuns] = useState([]);
  const [currentRun, setCurrentRun] = useState(null);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Multi-select for bulk bonus
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [bonusForm, setBonusForm] = useState({
    preset: 'عدية عيد القيامة',
    customName: '',
    amount: 500
  });
  const [submittingBonus, setSubmittingBonus] = useState(false);

  // Balances report modal
  const [showBalancesReport, setShowBalancesReport] = useState(false);

  // Official salary statement modal
  const [officialStatement, setOfficialStatement] = useState(null);
  const [loadingStatement, setLoadingStatement] = useState(false);

  // Editing Row Modal
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({});

  // Payslip view modal
  const [selectedPayslip, setSelectedPayslip] = useState(null);

  const loadRuns = async () => {
    try {
      const allRuns = await fetchJson('/payroll/runs');
      setRuns(allRuns);

      // Check if current year/month exists
      const match = allRuns.find(r => r.year === year && r.month === month);
      if (match) {
        loadRunDetails(match.id);
      } else if (allRuns.length > 0) {
        setYear(allRuns[0].year);
        setMonth(allRuns[0].month);
        loadRunDetails(allRuns[0].id);
      } else {
        // Auto generate 2026-09 if empty
        handleGenerate(2026, 9);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadRunDetails = async (runId) => {
    try {
      setLoading(true);
      const data = await fetchJson(`/payroll/runs/${runId}`);
      setCurrentRun(data.run);
      setItems(data.items);
      setSummary(data.summary);
    } catch (err) {
      alert('خطأ في جلب تفاصيل الكشف: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, []);

  const handleGenerate = async (y = year, m = month) => {
    try {
      setGenerating(true);
      const res = await fetchJson('/payroll/generate', {
        method: 'POST',
        body: JSON.stringify({ year: y, month: m })
      });
      loadRunDetails(res.runId);
      const allRuns = await fetchJson('/payroll/runs');
      setRuns(allRuns);
    } catch (err) {
      alert('خطأ أثناء احتساب المرتبات: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleMonthChange = (e) => {
    const newMonth = Number(e.target.value);
    setMonth(newMonth);
    const match = runs.find(r => r.year === year && r.month === newMonth);
    if (match) {
      loadRunDetails(match.id);
    } else {
      setCurrentRun(null);
      setItems([]);
      setSummary(null);
    }
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setEditForm({
      overtime_days: item.overtime_days,
      bonus_days: item.bonus_days,
      total_bonuses: item.total_bonuses,
      absence_days: item.absence_days,
      penalty_days: item.penalty_days,
      expenses: item.expenses,
      medical_insurance: item.medical_insurance || 0,
      social_insurance: item.social_insurance,
      tax: item.tax,
      loan_installment: item.loan_installment,
      notes: item.notes || ''
    });
  };

  const handleSaveItemEdit = async (e) => {
    e.preventDefault();
    try {
      const updated = await fetchJson(`/payroll/items/${editingItem.id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm)
      });
      setItems(items.map(i => i.id === updated.id ? updated : i));
      setEditingItem(null);
      if (currentRun) loadRunDetails(currentRun.id);
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredItems = items.filter(i =>
    !searchTerm ||
    i.employee_name.includes(searchTerm) ||
    i.employee_code.includes(searchTerm) ||
    (i.department && i.department.includes(searchTerm))
  );

  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredItems.map(i => i.id));
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleApplyBulkBonus = async (e) => {
    e.preventDefault();
    if (!currentRun || selectedIds.length === 0) return;
    try {
      setSubmittingBonus(true);
      const bonusName = bonusForm.preset === 'أخرى (مخصصة)' 
        ? (bonusForm.customName || 'مكافأة معفاة') 
        : bonusForm.preset;

      const res = await fetchJson(`/payroll/runs/${currentRun.id}/bulk-bonus`, {
        method: 'POST',
        body: JSON.stringify({
          itemIds: selectedIds,
          bonusName,
          amount: Number(bonusForm.amount)
        })
      });

      alert(res.message);
      setShowBonusModal(false);
      setSelectedIds([]);
      loadRunDetails(currentRun.id);
    } catch (err) {
      alert('خطأ أثناء منح المكافأة: ' + err.message);
    } finally {
      setSubmittingBonus(false);
    }
  };

  const handleViewOfficialStatement = async (employeeId) => {
    try {
      setLoadingStatement(true);
      const data = await fetchJson(`/payroll/official-statement/${employeeId}`);
      setOfficialStatement(data);
    } catch (err) {
      alert('خطأ في استخراج مفردات المرتب: ' + err.message);
    } finally {
      setLoadingStatement(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800">
              الرواتب (مسير مرتبات عمال وسائقين عرابي)
            </h1>
            <p className="text-xs md:text-sm text-slate-500">
              حسابات الاستحقاقات والاستقطاعات والضرائب والتأمينات وربط الغياب والإضافي والمصروفات والسلف
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowBalancesReport(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs md:text-sm font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-xl transition-all border border-amber-200"
          >
            <FileText className="w-4 h-4 text-amber-600" />
            تقرير أرصدة السلف والإجازات
          </button>

          {currentRun && (
            <a
              href={`/api/payroll/runs/${currentRun.id}/export/excel`}
              className="flex items-center gap-2 px-3.5 py-2 text-xs md:text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-all border border-emerald-200"
              download
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              تصدير شيت المرتبات (Excel)
            </a>
          )}

          <button
            onClick={() => handleGenerate(year, month)}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all disabled:opacity-50"
          >
            {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
            <span>احتساب / تحديث الرواتب من الحضور</span>
          </button>
        </div>
      </div>

      {/* Floating Bulk Action Bar for Bonuses */}
      {selectedIds.length > 0 && (
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-3.5 rounded-2xl shadow-lg flex flex-wrap items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckSquare className="w-5 h-5 text-blue-200" />
            <span className="font-bold text-sm">تم تحديد {selectedIds.length} موظف</span>
            <span className="text-xs text-blue-200">| يمكنك منحهم مكافأة مالية جماعية معفاة من الضرائب</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBonusModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl shadow-sm transition-all"
            >
              <Gift className="w-4 h-4" />
              منح مكافأة مالية للمحددين (معفاة من الضريبة)
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-2 text-xs bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
            >
              إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">الشهر:</span>
            <select
              value={month}
              onChange={handleMonthChange}
              className="py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                <option key={m} value={m}>شهر {m}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">السنة:</span>
            <select
              value={year}
              onChange={(e) => {
                setYear(Number(e.target.value));
              }}
              className="py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {currentRun && (
            <span className="text-xs font-mono px-3 py-1 bg-slate-100 text-slate-600 rounded-lg hidden md:inline-block">
              تاريخ الكشف: {currentRun.payroll_date}
            </span>
          )}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالكود، الاسم أو القسم..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
          />
        </div>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
            <span className="text-[11px] text-slate-500 block">إجمالي الاستحقاقات</span>
            <p className="text-lg font-bold font-mono text-slate-800 mt-1">
              {summary.totalEntitlement.toLocaleString()} <span className="text-[10px] font-sans text-slate-400">ج.م</span>
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
            <span className="text-[11px] text-blue-600 block">إجمالي الإضافي</span>
            <p className="text-lg font-bold font-mono text-blue-700 mt-1">
              {summary.totalOvertime.toLocaleString()} <span className="text-[10px] font-sans text-blue-400">ج.م</span>
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
            <span className="text-[11px] text-amber-600 block">مصروفات (10 و 20)</span>
            <p className="text-lg font-bold font-mono text-amber-700 mt-1">
              {summary.totalExpenses.toLocaleString()} <span className="text-[10px] font-sans text-amber-400">ج.م</span>
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
            <span className="text-[11px] text-rose-600 block">إجمالي الاستقطاعات</span>
            <p className="text-lg font-bold font-mono text-rose-700 mt-1">
              {summary.totalDeductions.toLocaleString()} <span className="text-[10px] font-sans text-rose-400">ج.م</span>
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
            <span className="text-[11px] text-indigo-600 block">سلف مستحقة</span>
            <p className="text-lg font-bold font-mono text-indigo-700 mt-1">
              {summary.totalLoans.toLocaleString()} <span className="text-[10px] font-sans text-indigo-400">ج.م</span>
            </p>
          </div>

          <div className="bg-emerald-500/10 p-3.5 rounded-xl border border-emerald-300 shadow-xs">
            <span className="text-[11px] text-emerald-900 font-bold block">صافي المرتبات المنصرفة</span>
            <p className="text-xl font-black font-mono text-emerald-900 mt-1">
              {summary.totalNet.toLocaleString()} <span className="text-[10px] font-sans text-emerald-600 font-normal">ج.م</span>
            </p>
          </div>
        </div>
      )}

      {/* Main Payroll Sheet Table matching Image 1 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mb-3 text-blue-600" />
            <p className="text-sm">جاري احتساب وتحميل كشف المرتبات...</p>
          </div>
        ) : !currentRun || items.length === 0 ? (
          <div className="text-center p-12 text-slate-400">
            <Calculator className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-base font-medium text-slate-600">لم يتم احتساب كشف مرتبات لهذا الشهر بعد</p>
            <button
              onClick={() => handleGenerate(year, month)}
              className="mt-3 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
            >
              احتساب مرتبات شهر {month} الآن
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-[11px] text-slate-600 border-collapse">
              <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 select-none sticky top-0">
                <tr>
                  <th className="py-2.5 px-2 text-center w-8">
                    <input
                      type="checkbox"
                      checked={filteredItems.length > 0 && selectedIds.length === filteredItems.length}
                      onChange={handleToggleSelectAll}
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      title="تحديد الكل"
                    />
                  </th>
                  <th className="py-2.5 px-2 text-center w-8">م</th>
                  <th className="py-2.5 px-2.5">القسم</th>
                  <th className="py-2.5 px-3 font-bold text-slate-900 min-w-36">إسم الموظف</th>
                  <th className="py-2.5 px-2 text-center">كود</th>
                  <th className="py-2.5 px-2.5">رقم البطاقة</th>
                  <th className="py-2.5 px-2">الرقم التأميني</th>
                  <th className="py-2.5 px-2.5">الوظيفة</th>
                  <th className="py-2.5 px-2 text-center bg-rose-600 text-white font-bold">المرتب الأساسي</th>
                  <th className="py-2.5 px-2 text-center">مرتب فعلي</th>
                  <th className="py-2.5 px-2 text-center">أساسي تأمينات</th>
                  <th className="py-2.5 px-2 text-center">بدلات خاضعة</th>
                  <th className="py-2.5 px-2 text-center">بدلات غير خاضعة</th>
                  <th className="py-2.5 px-2 text-center">إجمالي بدلات</th>
                  <th className="py-2.5 px-2 text-center bg-blue-100 text-blue-900 font-bold">إجمالي استحقاق</th>
                  <th className="py-2.5 px-2 text-center font-bold text-indigo-700">قيمة اليوم الإضافي</th>
                  <th className="py-2.5 px-2 text-center">أيام إضافي</th>
                  <th className="py-2.5 px-2 text-center font-bold text-indigo-700">إجمالي إضافي</th>
                  <th className="py-2.5 px-2 text-center">مكافآت</th>
                  <th className="py-2.5 px-2 text-center bg-amber-50 text-amber-900 font-bold">مصروفات</th>
                  <th className="py-2.5 px-2 text-center bg-rose-100 text-rose-900 font-bold">أيام الغياب</th>
                  <th className="py-2.5 px-2 text-center bg-rose-600 text-white font-bold">إجمالي الغياب</th>
                  <th className="py-2.5 px-2 text-center">جزاءات</th>
                  <th className="py-2.5 px-2 text-center">تأمينات</th>
                  <th className="py-2.5 px-2 text-center text-teal-800 bg-teal-50 font-bold" title="اشتراك التأمين الطبي الخاص (خاضع للضريبة)">تأمين طبي</th>
                  <th className="py-2.5 px-2 text-center">ضرائب</th>
                  <th className="py-2.5 px-2 text-center bg-rose-100 text-rose-900 font-bold">إجمالي استقطاعات</th>
                  <th className="py-2.5 px-2 text-center font-bold">إجمالي المرتب</th>
                  <th className="py-2.5 px-2 text-center bg-indigo-50 text-indigo-900 font-bold">سلف مستحقة</th>
                  <th className="py-2.5 px-3 text-center bg-emerald-600 text-white font-black">صافي المرتب</th>
                  <th className="py-2.5 px-2 text-center w-24 no-print">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-center">
                {filteredItems.map((item) => (
                  <tr 
                    key={item.id} 
                    className={`transition-colors ${selectedIds.includes(item.id) ? 'bg-blue-50/60' : 'hover:bg-blue-50/20'}`}
                  >
                    <td className="py-2 px-1 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => handleToggleSelect(item.id)}
                        className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="py-2 px-1 text-slate-400">{item.seq}</td>
                    <td className="py-2 px-2 font-sans text-right text-slate-700 font-medium">{item.department}</td>
                    <td className="py-2 px-3 font-sans text-right font-bold text-slate-900 whitespace-nowrap">{item.employee_name}</td>
                    <td className="py-2 px-2 font-bold text-blue-700 bg-blue-50/20">{item.employee_code}</td>
                    <td className="py-2 px-2 text-[10px] text-slate-500">{item.national_id}</td>
                    <td className="py-2 px-2 text-[10px] text-slate-500">{item.insurance_no}</td>
                    <td className="py-2 px-2 font-sans text-right text-slate-700">{item.job_title}</td>
                    <td className="py-2 px-2 font-bold text-rose-700 bg-rose-50/30">{item.basic_salary.toLocaleString()}</td>
                    <td className="py-2 px-2 text-slate-700">{item.actual_salary.toLocaleString()}</td>
                    <td className="py-2 px-2 text-slate-600">{item.insurance_basic.toLocaleString()}</td>
                    <td className="py-2 px-2 text-slate-700">{item.taxable_allowances.toLocaleString()}</td>
                    <td className="py-2 px-2 text-slate-400">{item.non_taxable_allowances || 0}</td>
                    <td className="py-2 px-2 font-semibold text-slate-800">{item.total_allowances.toLocaleString()}</td>
                    <td className="py-2 px-2 font-bold text-blue-900 bg-blue-50/40">{item.total_entitlement.toLocaleString()}</td>
                    
                    {/* Overtime day value: actual_salary / 30 */}
                    <td className="py-2 px-2 font-bold text-indigo-700">{item.overtime_day_value}</td>
                    <td className="py-2 px-2">{item.overtime_days || 0}</td>
                    <td className="py-2 px-2 font-bold text-indigo-700">{item.total_overtime || 0}</td>
                    
                    <td className="py-2 px-2 font-bold text-amber-700">
                      {item.total_bonuses || 0}
                      {item.bonus_name && (
                        <span className="block text-[9px] font-sans text-amber-600 truncate max-w-20 mx-auto" title={item.bonus_name}>
                          {item.bonus_name}
                        </span>
                      )}
                    </td>
                    
                    {/* Mid-month Expenses */}
                    <td className="py-2 px-2 font-bold text-amber-800 bg-amber-50/30">
                      {item.expenses > 0 ? item.expenses.toLocaleString() : 0}
                    </td>

                    {/* Absence Days & Value */}
                    <td className="py-2 px-2 font-bold text-rose-700 bg-rose-50/20">
                      {item.absence_days > 0 ? `${item.absence_days} يوم` : '0'}
                    </td>
                    <td className="py-2 px-2 font-bold text-rose-700 bg-rose-50/30">
                      {item.total_absence > 0 ? item.total_absence.toLocaleString() : 0}
                    </td>

                    <td className="py-2 px-2">{item.total_penalties || 0}</td>
                    <td className="py-2 px-2 text-slate-700 font-semibold">{item.social_insurance}</td>
                    <td className="py-2 px-2 text-teal-800 font-bold bg-teal-50/20">{item.medical_insurance || 0}</td>
                    <td className="py-2 px-2 text-slate-700 font-semibold">{item.tax}</td>
                    
                    <td className="py-2 px-2 font-bold text-rose-800 bg-rose-50/40">{item.total_deductions.toLocaleString()}</td>
                    <td className="py-2 px-2 font-bold text-slate-800">{item.gross_after_deductions.toLocaleString()}</td>
                    
                    {/* Loan Installment */}
                    <td className="py-2 px-2 font-bold text-indigo-800 bg-indigo-50/30">
                      {item.loan_installment > 0 ? item.loan_installment.toLocaleString() : 0}
                    </td>

                    {/* Net Salary */}
                    <td className="py-2 px-3 font-black text-emerald-900 bg-emerald-50 text-xs">
                      {item.net_salary.toLocaleString()}
                    </td>

                    <td className="py-2 px-2 no-print font-sans">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="تعديل يدوي للبند"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setSelectedPayslip({ item, run: currentRun })}
                          className="p-1 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                          title="قسيمة الراتب"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleViewOfficialStatement(item.employee_id)}
                          className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                          title="مفردات مرتب رسمية معتمدة"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Item Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-800">تعديل تفاصيل راتب الموظف</h2>
                <p className="text-xs text-slate-500">{editingItem.employee_name} (كود: {editingItem.employee_code})</p>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItemEdit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">أيام الإضافي (أقل نصف يوم 0.5)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="0.5 أو 1 أو 1.5"
                    value={editForm.overtime_days}
                    onChange={(e) => setEditForm({ ...editForm, overtime_days: Number(e.target.value) })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">إجمالي المكافآت (ج.م)</label>
                  <input
                    type="number"
                    step="50"
                    min="0"
                    value={editForm.total_bonuses}
                    onChange={(e) => setEditForm({ ...editForm, total_bonuses: Number(e.target.value) })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">أيام الغياب (أقل نصف يوم 0.5)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="0.5 أو 1 أو 1.5"
                    value={editForm.absence_days}
                    onChange={(e) => setEditForm({ ...editForm, absence_days: Number(e.target.value) })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">أيام الجزاءات (أقل نصف يوم 0.5)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="0.5 أو 1 أو 1.5"
                    value={editForm.penalty_days}
                    onChange={(e) => setEditForm({ ...editForm, penalty_days: Number(e.target.value) })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">مصروفات 10 و 20 (خصم المرتب)</label>
                  <input
                    type="number"
                    step="50"
                    min="0"
                    value={editForm.expenses}
                    onChange={(e) => setEditForm({ ...editForm, expenses: Number(e.target.value) })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">سلف مستحقة (قسط شهري)</label>
                  <input
                    type="number"
                    step="50"
                    min="0"
                    value={editForm.loan_installment}
                    onChange={(e) => setEditForm({ ...editForm, loan_installment: Number(e.target.value) })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    التأمينات (11% من أساسي التأمينات)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.social_insurance}
                    onChange={(e) => setEditForm({ ...editForm, social_insurance: Number(e.target.value) })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    اشتراك التأمين الطبي الخاص (ج.م)
                    <span className="text-[10px] text-rose-500 mr-1 font-normal">(خاضع للضريبة)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.medical_insurance || 0}
                    onChange={(e) => setEditForm({ ...editForm, medical_insurance: Number(e.target.value) })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    الضرائب (ضريبة كسب العمل المصرية)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.tax}
                    onChange={(e) => setEditForm({ ...editForm, tax: Number(e.target.value) })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">ملاحظات</label>
                <input
                  type="text"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs"
                >
                  تحديث واحتساب الصافي
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payslip Modal */}
      {selectedPayslip && (
        <PayslipModal
          item={selectedPayslip.item}
          run={selectedPayslip.run}
          onClose={() => setSelectedPayslip(null)}
        />
      )}

      {/* Official Salary Statement Modal (مفردات مرتب رسمية) */}
      {officialStatement && (
        <OfficialSalaryStatementModal
          statement={officialStatement}
          onClose={() => setOfficialStatement(null)}
        />
      )}

      {/* Balances Report Modal (تقرير أرصدة السلف والإجازات) */}
      {showBalancesReport && (
        <BalancesReportModal
          onClose={() => setShowBalancesReport(false)}
        />
      )}

      {/* Bulk Grant Bonus Modal */}
      {showBonusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-amber-50/60">
              <div className="flex items-center gap-2 text-amber-900 font-bold">
                <Gift className="w-5 h-5 text-amber-600" />
                <h3 className="text-base">منح مكافأة مالية جماعية معفاة من الضريبة</h3>
              </div>
              <button
                onClick={() => setShowBonusModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyBulkBonus} className="p-5 space-y-4 text-xs">
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-blue-900 leading-relaxed">
                سيتم صرف هذه المكافأة لعدد <strong>{selectedIds.length}</strong> موظف محدد. 
                المكافأة معفاة ضريبياً بنسبة 100% وتضاف مباشرة إلى صافي المرتب دون رفع الشريحة الضريبية.
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">مسمى المكافأة / المناسبة</label>
                <select
                  value={bonusForm.preset}
                  onChange={(e) => setBonusForm({ ...bonusForm, preset: e.target.value })}
                  className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                >
                  <option value="عدية عيد الميلاد">عدية عيد الميلاد المجيد</option>
                  <option value="عدية عيد القيامة">عدية عيد القيامة المجيد</option>
                  <option value="منحة دخول المدارس">منحة دخول المدارس</option>
                  <option value="مكافأة ربع سنوية">مكافأة ربع سنوية</option>
                  <option value="مكافأة تشجيعية للأداء المتميز">مكافأة تشجيعية للأداء المتميز</option>
                  <option value="منحة عيدي الفطر والأضحى">منحة الأعياد</option>
                  <option value="أخرى (مخصصة)">أخرى (مخصصة)...</option>
                </select>
              </div>

              {bonusForm.preset === 'أخرى (مخصصة)' && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">اكتب مسمى المكافأة</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: منحة استثنائية للمخازن"
                    value={bonusForm.customName}
                    onChange={(e) => setBonusForm({ ...bonusForm, customName: e.target.value })}
                    className="w-full py-2 px-3 border border-slate-200 rounded-xl"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">مبلغ المكافأة لكل موظف (ج.م)</label>
                <input
                  type="number"
                  min="50"
                  step="50"
                  required
                  placeholder="500 أو 1000..."
                  value={bonusForm.amount}
                  onChange={(e) => setBonusForm({ ...bonusForm, amount: e.target.value })}
                  className="w-full py-2 px-3 font-mono font-bold text-base border border-slate-200 rounded-xl text-emerald-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBonusModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingBonus}
                  className="flex items-center gap-1.5 px-5 py-2 font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-xl shadow-xs transition-colors"
                >
                  {submittingBonus ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                  <span>تأكيد صرف المكافأة للمحددين</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
