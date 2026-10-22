import React, { useState, useEffect } from 'react';
import { 
  Palmtree, PlusCircle, Search, RefreshCw, Calendar, 
  Trash2, Edit2, X, AlertCircle, CheckCircle2, Sliders 
} from 'lucide-react';
import { fetchJson } from '../utils/api';

export default function LeavesPage() {
  const [balances, setBalances] = useState([]);
  const [leavesHistory, setLeavesHistory] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('balances'); // 'balances' or 'history'

  // Add / Edit Leave Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLeave, setEditingLeave] = useState(null);
  const [formData, setFormData] = useState({
    employee_id: '',
    leave_type: 'سنوية',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    days_count: 1,
    reason: ''
  });

  // Edit Balance Modal
  const [editingBalanceEmp, setEditingBalanceEmp] = useState(null);
  const [newBalanceValue, setNewBalanceValue] = useState(21);

  const loadData = async () => {
    try {
      setLoading(true);
      const [bal, hist, emps] = await Promise.all([
        fetchJson('/leaves/balances'),
        fetchJson('/leaves'),
        fetchJson('/employees')
      ]);
      setBalances(bal);
      setLeavesHistory(hist);
      setEmployees(emps);
    } catch (err) {
      alert('خطأ في جلب بيانات الإجازات: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveLeave = async (e) => {
    e.preventDefault();
    try {
      if (editingLeave) {
        await fetchJson(`/leaves/${editingLeave.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });
      } else {
        await fetchJson('/leaves', {
          method: 'POST',
          body: JSON.stringify(formData)
        });
      }
      setShowAddModal(false);
      setEditingLeave(null);
      setFormData({
        employee_id: '',
        leave_type: 'سنوية',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        days_count: 1,
        reason: ''
      });
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenEditLeave = (leave) => {
    setEditingLeave(leave);
    setFormData({
      employee_id: leave.employee_id,
      leave_type: leave.leave_type,
      start_date: leave.start_date,
      end_date: leave.end_date,
      days_count: leave.days_count,
      reason: leave.reason || ''
    });
    setShowAddModal(true);
  };

  const handleDeleteLeave = async (id, empName, days) => {
    if (window.confirm(`هل تريد بالتأكيد حذف هذه الإجازة (${days} يوم) للموظف ${empName} وإعادة رصيد الأيام له؟`)) {
      try {
        await fetchJson(`/leaves/${id}`, { method: 'DELETE' });
        loadData();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const handleOpenEditBalance = (emp) => {
    setEditingBalanceEmp(emp);
    setNewBalanceValue(emp.total_balance);
  };

  const handleSaveBalance = async (e) => {
    e.preventDefault();
    try {
      await fetchJson(`/leaves/balances/${editingBalanceEmp.id}`, {
        method: 'PUT',
        body: JSON.stringify({ annual_leave_balance: newBalanceValue })
      });
      setEditingBalanceEmp(null);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredBalances = balances.filter(b =>
    !searchTerm ||
    b.name.includes(searchTerm) ||
    b.code.includes(searchTerm) ||
    b.department.includes(searchTerm)
  );

  const filteredHistory = leavesHistory.filter(h =>
    !searchTerm ||
    h.employee_name.includes(searchTerm) ||
    h.employee_code.includes(searchTerm) ||
    (h.reason && h.reason.includes(searchTerm))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <Palmtree className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800">سجل وأرصدة الإجازات السنوية</h1>
            <p className="text-xs md:text-sm text-slate-500">
              متابعة رصيد كل موظف السنوي، الأيام المستنفذة والمتبقي، مع إمكانية التعديل والحذف
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setEditingLeave(null);
            setFormData({
              employee_id: employees[0]?.id || '',
              leave_type: 'سنوية',
              start_date: new Date().toISOString().split('T')[0],
              end_date: new Date().toISOString().split('T')[0],
              days_count: 1,
              reason: ''
            });
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 text-xs md:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          تسجيل إجازة معتمدة
        </button>
      </div>

      {/* Control & Tab bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('balances')}
            className={`px-4 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'balances'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            أرصدة الموظفين السنوية ({filteredBalances.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'history'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            سجل الإجازات السابق والتعديل ({filteredHistory.length})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالاسم أو الكود..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
          />
        </div>
      </div>

      {/* Content View */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mb-3 text-emerald-600" />
            <p className="text-sm">جاري تحميل بيانات الإجازات...</p>
          </div>
        ) : activeTab === 'balances' ? (
          /* Balances Table with Edit Balance action */
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 select-none">
                <tr>
                  <th className="py-3 px-3 text-center">الكود</th>
                  <th className="py-3 px-4 font-bold text-slate-900">اسم الموظف</th>
                  <th className="py-3 px-3">القسم</th>
                  <th className="py-3 px-3">الوظيفة</th>
                  <th className="py-3 px-3 text-center font-bold text-slate-800">الرصيد السنوي الكامل</th>
                  <th className="py-3 px-3 text-center font-bold text-amber-700 bg-amber-50/50">المستنفذ</th>
                  <th className="py-3 px-3 text-center font-bold text-emerald-700 bg-emerald-50/50">الرصيد المتبقي</th>
                  <th className="py-3 px-4 text-center">نسبة الاستهلاك</th>
                  <th className="py-3 px-3 text-center">تعديل الرصيد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredBalances.map((b) => {
                  const percent = b.total_balance > 0 ? Math.round((b.taken_days / b.total_balance) * 100) : 0;
                  return (
                    <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 text-center font-bold text-blue-700 bg-blue-50/20">
                        {b.code}
                      </td>
                      <td className="py-3 px-4 font-sans font-bold text-slate-900">{b.name}</td>
                      <td className="py-3 px-3 font-sans text-slate-600">{b.department}</td>
                      <td className="py-3 px-3 font-sans text-slate-600">{b.job_title}</td>
                      <td className="py-3 px-3 text-center font-bold text-slate-800">
                        {b.total_balance} يوم
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-amber-700 bg-amber-50/20">
                        {b.taken_days} يوم
                      </td>
                      <td className="py-3 px-3 text-center font-black text-emerald-700 bg-emerald-50/30 text-sm">
                        {b.remaining_balance} يوم
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-28 mx-auto">
                          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                            <span>{b.taken_days}/{b.total_balance}</span>
                            <span>{percent}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${percent > 80 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-sans">
                        <button
                          onClick={() => handleOpenEditBalance(b)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all"
                          title="تعديل الرصيد السنوي للموظف"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>تعديل الرصيد</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Leaves History with Edit and Delete */
          filteredHistory.length === 0 ? (
            <div className="text-center p-12 text-slate-400">
              <Palmtree className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="text-base font-medium text-slate-600">لا توجد إجازات مسجلة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 select-none">
                  <tr>
                    <th className="py-3 px-3 text-center">الكود</th>
                    <th className="py-3 px-4 font-bold text-slate-900">الموظف</th>
                    <th className="py-3 px-3">النوع</th>
                    <th className="py-3 px-3 text-center">من تاريخ</th>
                    <th className="py-3 px-3 text-center">إلى تاريخ</th>
                    <th className="py-3 px-3 text-center font-bold text-emerald-700">عدد الأيام</th>
                    <th className="py-3 px-4">السبب / الملاحظات</th>
                    <th className="py-3 px-3 text-center">الحالة</th>
                    <th className="py-3 px-3 text-center w-24">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-blue-700 bg-blue-50/20">
                        {h.employee_code}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">{h.employee_name}</td>
                      <td className="py-3 px-3">
                        <span className="inline-block px-2 py-0.5 text-[11px] bg-slate-100 text-slate-700 font-medium rounded-md">
                          {h.leave_type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono">{h.start_date}</td>
                      <td className="py-3 px-3 text-center font-mono">{h.end_date}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700">
                        {h.days_count} يوم
                      </td>
                      <td className="py-3 px-4 text-slate-600">{h.reason || '-'}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded">
                          معتمدة
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditLeave(h)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="تعديل الإجازة"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteLeave(h.id, h.employee_name, h.days_count)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="حذف الإجازة وإعادة الرصيد"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Add / Edit Leave Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">
                {editingLeave ? 'تعديل بيانات الإجازة' : 'تسجيل إجازة معتمدة جديدة'}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLeave} className="p-5 space-y-4 text-sm">
              {!editingLeave && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">الموظف *</label>
                  <select
                    required
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  >
                    <option value="">-- اضغط لاختيار الموظف --</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.name} (كود: {e.code}) - الرصيد: {e.annual_leave_balance} يوم
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editingLeave && (
                <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-900 font-semibold">
                  الموظف: {editingLeave.employee_name} (كود: {editingLeave.employee_code})
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">نوع الإجازة</label>
                  <select
                    value={formData.leave_type}
                    onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  >
                    <option value="سنوية">سنوية (تخصم من الرصيد)</option>
                    <option value="عارضة">عارضة</option>
                    <option value="مرضية">مرضية</option>
                    <option value="بدل راحة">بدل راحة</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">عدد الأيام *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    value={formData.days_count}
                    onChange={(e) => setFormData({ ...formData, days_count: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">من تاريخ *</label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">إلى تاريخ *</label>
                  <input
                    type="date"
                    required
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">سبب الإجازة</label>
                <textarea
                  rows="2"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="ظروف عائلية، سفر، إلخ..."
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
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs"
                >
                  {editingLeave ? 'حفظ التعديلات' : 'تسجيل وخصم من الرصيد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Balance Modal */}
      {editingBalanceEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800">تعديل رصيد الإجازات السنوية</h2>
              <button
                onClick={() => setEditingBalanceEmp(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBalance} className="p-4 space-y-4 text-xs">
              <div>
                <p className="font-bold text-slate-900 text-sm mb-1">{editingBalanceEmp.name}</p>
                <p className="text-slate-500 font-mono">كود: {editingBalanceEmp.code} | {editingBalanceEmp.department}</p>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">إجمالي الرصيد السنوي (أيام)</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  required
                  value={newBalanceValue}
                  onChange={(e) => setNewBalanceValue(Number(e.target.value))}
                  className="w-full px-3 py-2 text-base font-bold font-mono text-center border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-[11px]">
                سيتم تحديث رصيد الموظف السنوي واحتساب المتبقي تلقائياً بعد خصم الأيام المستنفذة ({editingBalanceEmp.taken_days} يوم).
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingBalanceEmp(null)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs"
                >
                  حفظ الرصيد الجديد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
