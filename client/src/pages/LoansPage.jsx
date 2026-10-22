import React, { useState, useEffect } from 'react';
import { 
  CreditCard, PlusCircle, Search, RefreshCw, CheckCircle2, 
  Calendar, AlertCircle, X, ChevronRight, Check, Edit2, Trash2 
} from 'lucide-react';
import { fetchJson } from '../utils/api';

export default function LoansPage() {
  const [loans, setLoans] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLoan, setEditingLoan] = useState(null);

  const initialFormData = {
    employee_id: '',
    total_amount: 12000,
    months_count: 12,
    start_date: '2026-01',
    paid_installments: 0,
    status: 'active',
    notes: ''
  };

  const [formData, setFormData] = useState(initialFormData);

  const loadData = async () => {
    try {
      setLoading(true);
      const [loansData, empsData] = await Promise.all([
        fetchJson(`/loans?status=${statusFilter}&search=${encodeURIComponent(searchTerm)}`),
        fetchJson('/employees')
      ]);
      setLoans(loansData);
      setEmployees(empsData);
    } catch (err) {
      alert('خطأ في جلب بيانات السلف: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, searchTerm]);

  // Live calculation of installment and end date
  const calculatedInstallment = formData.total_amount && formData.months_count
    ? Math.round((Number(formData.total_amount) / Number(formData.months_count)) * 100) / 100
    : 0;

  const calculateEndDate = (startDate, months) => {
    if (!startDate || !months) return '';
    const [y, m] = startDate.split('-').map(Number);
    const d = new Date(y, (m - 1) + (Number(months) - 1), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const calculatedEndDate = calculateEndDate(formData.start_date, formData.months_count);

  const handleSaveLoan = async (e) => {
    e.preventDefault();
    try {
      if (editingLoan) {
        await fetchJson(`/loans/${editingLoan.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });
      } else {
        await fetchJson('/loans', {
          method: 'POST',
          body: JSON.stringify(formData)
        });
      }
      setShowAddModal(false);
      setEditingLoan(null);
      setFormData(initialFormData);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenEditLoan = (loan) => {
    setEditingLoan(loan);
    setFormData({
      employee_id: loan.employee_id,
      total_amount: loan.total_amount,
      months_count: loan.months_count,
      start_date: loan.start_date,
      paid_installments: loan.paid_installments,
      status: loan.status,
      notes: loan.notes || ''
    });
    setShowAddModal(true);
  };

  const handleDeleteLoan = async (id, empName, amount) => {
    if (window.confirm(`هل أنت متأكد من حذف سلفة الموظف: ${empName} بمبلغ ${amount} ج.م؟`)) {
      try {
        await fetchJson(`/loans/${id}`, { method: 'DELETE' });
        loadData();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const handleRecordInstallment = async (loan) => {
    const nextPaid = loan.paid_installments + 1;
    if (nextPaid > loan.months_count) return;
    if (window.confirm(`هل تريد تسجيل سداد قسط بقيمة ${loan.monthly_installment} ج.م للموظف ${loan.employee_name}؟`)) {
      try {
        await fetchJson(`/loans/${loan.id}`, {
          method: 'PUT',
          body: JSON.stringify({ paid_installments: nextPaid })
        });
        loadData();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  // Stats
  const activeLoans = loans.filter(l => l.status === 'active');
  const totalLoanAmounts = activeLoans.reduce((s, l) => s + l.total_amount, 0);
  const totalRemainingAmounts = activeLoans.reduce((s, l) => s + l.remaining_amount, 0);
  const totalMonthlyInstallments = activeLoans.reduce((s, l) => s + l.monthly_installment, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800">سجل السلف طويلة الأجل</h1>
            <p className="text-xs md:text-sm text-slate-500">
              تقسيط المبالغ على عدد شهور محدد (10 أو 12) وخصم القسط تلقائياً مع إمكانية التعديل والحذف
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setEditingLoan(null);
            setFormData(initialFormData);
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 text-xs md:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          إضافة سلفة جديدة لموظف
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-100 shadow-sm min-w-0">
          <span className="text-xs font-medium text-slate-500 block truncate">إجمالي مبالغ السلف النشطة</span>
          <p className="text-xl sm:text-2xl font-bold font-mono text-slate-900 mt-1 sm:mt-2 truncate" title={`${totalLoanAmounts.toLocaleString()} ج.م`}>
            {totalLoanAmounts.toLocaleString()} <span className="text-xs font-sans text-slate-400">ج.م</span>
          </p>
        </div>

        <div className="bg-rose-50/60 p-3.5 sm:p-4 rounded-2xl border border-rose-200 shadow-sm min-w-0">
          <span className="text-xs font-bold text-rose-800 block truncate">إجمالي المتبقي غير المسدد</span>
          <p className="text-xl sm:text-2xl font-bold font-mono text-rose-700 mt-1 sm:mt-2 truncate" title={`${totalRemainingAmounts.toLocaleString()} ج.م`}>
            {totalRemainingAmounts.toLocaleString()} <span className="text-xs font-sans text-rose-500 font-normal">ج.م</span>
          </p>
        </div>

        <div className="bg-indigo-50/60 p-3.5 sm:p-4 rounded-2xl border border-indigo-200 shadow-sm min-w-0">
          <span className="text-xs font-bold text-indigo-800 block truncate">إجمالي الأقساط الشهرية المستحقة</span>
          <p className="text-xl sm:text-2xl font-bold font-mono text-indigo-700 mt-1 sm:mt-2 truncate" title={`${totalMonthlyInstallments.toLocaleString()} ج.م/شهر`}>
            {totalMonthlyInstallments.toLocaleString()} <span className="text-xs font-sans text-indigo-500 font-normal">ج.م/شهر</span>
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث باسم الموظف أو الكود..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl"
          >
            <option value="all">جميع الحالات</option>
            <option value="active">السلف النشطة فقط</option>
            <option value="completed">السلف المسددة بالكامل</option>
          </select>
        </div>
      </div>

      {/* Loans Table with Edit and Delete */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-600" />
            <p className="text-sm">جاري تحميل سجل السلف...</p>
          </div>
        ) : loans.length === 0 ? (
          <div className="text-center p-12 text-slate-400">
            <CreditCard className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-base font-medium text-slate-600">لا توجد سجلات سلف مطابقة</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 select-none">
                <tr>
                  <th className="py-3 px-3 text-center">الكود</th>
                  <th className="py-3 px-4 font-bold text-slate-900">اسم الموظف</th>
                  <th className="py-3 px-3">القسم</th>
                  <th className="py-3 px-3 text-center">إجمالي السلفة</th>
                  <th className="py-3 px-3 text-center">عدد الشهور</th>
                  <th className="py-3 px-3 text-center font-bold text-indigo-700 bg-indigo-50/50">قسط السلفة الشهري</th>
                  <th className="py-3 px-3 text-center">بداية الخصم</th>
                  <th className="py-3 px-3 text-center">نهاية الخصم</th>
                  <th className="py-3 px-4 text-center">التقدم والمسدد</th>
                  <th className="py-3 px-3 text-center font-bold text-rose-700 bg-rose-50/50">المتبقي</th>
                  <th className="py-3 px-3 text-center">الحالة</th>
                  <th className="py-3 px-3 text-center w-28">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {loans.map((loan) => {
                  const percent = Math.min(100, Math.round((loan.paid_installments / loan.months_count) * 100));
                  return (
                    <tr key={loan.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 text-center font-bold text-blue-700 bg-blue-50/30">
                        {loan.employee_code}
                      </td>
                      <td className="py-3 px-4 font-sans font-bold text-slate-900">{loan.employee_name}</td>
                      <td className="py-3 px-3 font-sans text-slate-600">{loan.department}</td>
                      <td className="py-3 px-3 text-center font-bold text-slate-800">
                        {loan.total_amount.toLocaleString()} ج.م
                      </td>
                      <td className="py-3 px-3 text-center">{loan.months_count} شهر</td>
                      <td className="py-3 px-3 text-center font-black text-indigo-700 bg-indigo-50/30">
                        {loan.monthly_installment.toLocaleString()} ج.م
                      </td>
                      <td className="py-3 px-3 text-center text-slate-600">{loan.start_date}</td>
                      <td className="py-3 px-3 text-center text-slate-600">{loan.end_date}</td>
                      <td className="py-3 px-4">
                        <div className="w-32 mx-auto">
                          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                            <span>{loan.paid_installments} من {loan.months_count} قسط</span>
                            <span>{percent}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-indigo-600 h-1.5 rounded-full transition-all"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-rose-700 bg-rose-50/30">
                        {loan.remaining_amount.toLocaleString()} ج.م
                      </td>
                      <td className="py-3 px-3 text-center font-sans">
                        {loan.status === 'active' ? (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded">
                            نشطة
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded">
                            مسددة
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-sans">
                        <div className="flex items-center justify-center gap-1.5">
                          {loan.status === 'active' && (
                            <button
                              onClick={() => handleRecordInstallment(loan)}
                              className="px-2 py-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md"
                              title="سداد قسط"
                            >
                              قسط
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEditLoan(loan)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="تعديل السلفة"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteLoan(loan.id, loan.employee_name, loan.total_amount)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="حذف السلفة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Loan Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">
                {editingLoan ? 'تعديل بيانات السلفة' : 'إضافة سلفة طويلة الأجل جديدة'}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLoan} className="p-5 space-y-4 text-sm">
              {!editingLoan ? (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">اختر الموظف *</label>
                  <select
                    required
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  >
                    <option value="">-- اضغط لاختيار الموظف --</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.name} (كود: {e.code}) - {e.job_title}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-3 bg-indigo-50 rounded-xl text-xs text-indigo-900 font-semibold">
                  الموظف: {editingLoan.employee_name} (كود: {editingLoan.employee_code})
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">مبلغ السلفة الإجمالي (ج.م) *</label>
                  <input
                    type="number"
                    step="500"
                    required
                    value={formData.total_amount}
                    onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">عدد الشهور (التقسيط) *</label>
                  <select
                    value={formData.months_count}
                    onChange={(e) => setFormData({ ...formData, months_count: Number(e.target.value) })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl font-bold"
                  >
                    {[3, 6, 10, 12, 18, 24].map(m => (
                      <option key={m} value={m}>{m} شهر</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">شهر البداية (YYYY-MM) *</label>
                  <input
                    type="month"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">شهر النهاية المحسوب</label>
                  <input
                    type="text"
                    disabled
                    value={calculatedEndDate}
                    className="w-full px-3 py-2 font-mono bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-bold"
                  />
                </div>

                {editingLoan && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">الأقساط المسددة</label>
                      <input
                        type="number"
                        min="0"
                        max={formData.months_count}
                        value={formData.paid_installments}
                        onChange={(e) => setFormData({ ...formData, paid_installments: Number(e.target.value) })}
                        className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">الحالة</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold"
                      >
                        <option value="active">نشطة</option>
                        <option value="completed">مسددة بالكامل</option>
                        <option value="paused">معلقة مؤقتاً</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Calculated Installment Highlight */}
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-indigo-700 block font-medium">قيمة القسط الشهري الناتج:</span>
                  <p className="text-[11px] text-slate-500">يخصم شهرياً من راتب الموظف</p>
                </div>
                <span className="text-xl font-black font-mono text-indigo-800">
                  {calculatedInstallment.toLocaleString()} ج.م
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ملاحظات / سبب السلفة</label>
                <textarea
                  rows="2"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
                >
                  {editingLoan ? 'حفظ تعديلات السلفة' : 'اعتماد السلفة وتقسيطها'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
