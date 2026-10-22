import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, FileSpreadsheet, Download, Upload, Search, 
  Filter, Edit2, Trash2, CheckCircle2, AlertTriangle, X, RefreshCw, 
  CheckSquare, Square, Check, DollarSign, TrendingUp, Briefcase,
  Layers, Percent, Calendar, ShieldCheck, History, Key, Phone
} from 'lucide-react';
import { fetchJson, uploadFile } from '../utils/api';
import OfficialSalaryStatementModal from '../components/OfficialSalaryStatementModal';

export default function EmployeesPage() {
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'progression'
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState([]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [officialStatement, setOfficialStatement] = useState(null);

  // Salary Progression & Annual Increment State
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [incrementForm, setIncrementForm] = useState({
    year: 2027,
    effective_date: '2027-01-01',
    increase_percent: 10,
    adjust_basic: true,
    adjust_insurance: true,
    apply_to: 'all',
    notes: 'الزيادة السنوية المقررة لعام 2027'
  });
  const [applyingIncrement, setApplyingIncrement] = useState(false);

  // Form State
  const initialForm = {
    seq: '',
    department: 'الفلتر',
    name: '',
    code: '',
    national_id: '',
    insurance_no: '',
    job_title: '',
    basic_salary: 5660,
    actual_salary: 5660,
    insurance_basic: 5660,
    taxable_allowances: 1615,
    non_taxable_allowances: 0,
    medical_insurance: 0,
    annual_leave_balance: 21,
    phone: '',
    pin_code: '',
    exclude_from_payroll: 0
  };
  const [formData, setFormData] = useState(initialForm);

  // Import preview state
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [importMessage, setImportMessage] = useState(null);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const data = await fetchJson(`/employees?search=${encodeURIComponent(searchTerm)}&department=${deptFilter}`);
      setEmployees(data);
      // Clean selected IDs that might no longer exist
      setSelectedIds(prev => prev.filter(id => data.some(e => e.id === id)));
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSalaryHistory = async () => {
    try {
      setLoadingHistory(true);
      const data = await fetchJson('/employees/salary-history/all');
      setSalaryHistory(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, [searchTerm, deptFilter]);

  useEffect(() => {
    if (activeTab === 'progression') {
      loadSalaryHistory();
    }
  }, [activeTab]);

  const handleApplyAnnualIncrement = async (e) => {
    e.preventDefault();
    const incPct = Number(incrementForm.increase_percent);
    if (isNaN(incPct) || incPct <= 0) {
      alert('يرجى إدخال نسبة زيادة صحيحة أكبر من صفر');
      return;
    }

    const targetIds = incrementForm.apply_to === 'selected' && selectedIds.length > 0 
      ? selectedIds 
      : null;

    const countText = targetIds ? `${targetIds.length} موظف محدد` : 'جميع الموظفين المقيدين';
    if (!window.confirm(`هل أنت متأكد من تطبيق زيادة سنوية بنسبة ${incPct}% على ${countText} للعام ${incrementForm.year}؟`)) {
      return;
    }

    try {
      setApplyingIncrement(true);
      const res = await fetchJson('/employees/apply-annual-increment', {
        method: 'POST',
        body: JSON.stringify({
          year: Number(incrementForm.year),
          effective_date: incrementForm.effective_date,
          increase_percent: incPct,
          employeeIds: targetIds,
          adjust_basic: incrementForm.adjust_basic,
          adjust_insurance: incrementForm.adjust_insurance,
          notes: incrementForm.notes
        })
      });

      alert(res.message);
      loadEmployees();
      loadSalaryHistory();
    } catch (err) {
      alert('خطأ أثناء تطبيق الزيادة السنوية: ' + err.message);
    } finally {
      setApplyingIncrement(false);
    }
  };

  const handleViewOfficialStatement = async (employeeId) => {
    try {
      const data = await fetchJson(`/payroll/official-statement/${employeeId}`);
      setOfficialStatement(data);
    } catch (err) {
      alert('خطأ في استخراج مفردات المرتب: ' + err.message);
    }
  };

  // Selection handlers
  const handleToggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === employees.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(employees.map(e => e.id));
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`هل أنت متأكد من حذف ${selectedIds.length} موظف محدد نهائياً من قاعدة البيانات؟`)) {
      try {
        await fetchJson('/employees/bulk-delete', {
          method: 'POST',
          body: JSON.stringify({ ids: selectedIds })
        });
        setSelectedIds([]);
        loadEmployees();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    try {
      if (editingEmployee) {
        await fetchJson(`/employees/${editingEmployee.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });
      } else {
        await fetchJson('/employees', {
          method: 'POST',
          body: JSON.stringify(formData)
        });
      }
      setShowAddModal(false);
      setEditingEmployee(null);
      setFormData(initialForm);
      loadEmployees();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEditClick = (emp) => {
    setEditingEmployee(emp);
    setFormData(emp);
    setShowAddModal(true);
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`هل أنت متأكد من حذف الموظف: ${name}؟`)) {
      try {
        await fetchJson(`/employees/${id}`, { method: 'DELETE' });
        loadEmployees();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const handleResetPin = async (emp) => {
    if (!window.confirm(`هل أنت متأكد من تصفير رمز الـ PIN للموظف:\n${emp.name} (${emp.code})؟\n\nعند الدخول القادم للبوابة، سيطلب منه النظام إنشاء رمز سري جديد مكون من 4 أرقام.`)) {
      return;
    }
    try {
      const res = await fetchJson(`/employees/${emp.id}/reset-pin`, { method: 'POST' });
      alert(res.message);
      loadEmployees();
      if (editingEmployee && editingEmployee.id === emp.id) {
        setEditingEmployee(prev => ({ ...prev, pin_code: null }));
      }
    } catch (err) {
      alert('خطأ في تصفير رمز الـ PIN: ' + err.message);
    }
  };

  // Excel Import Flow
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);
    try {
      setIsUploading(true);
      setImportMessage(null);
      const previewData = await uploadFile('/employees/import/preview', file);
      setImportPreview(previewData);
    } catch (err) {
      alert('خطأ في قراءة ملف الإكسيل: ' + err.message);
      setImportPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview || !importPreview.items) return;
    try {
      setIsUploading(true);
      const res = await fetchJson('/employees/import/confirm', {
        method: 'POST',
        body: JSON.stringify({ items: importPreview.items })
      });
      setImportMessage(res.message);
      setImportPreview(null);
      setImportFile(null);
      loadEmployees();
      setTimeout(() => setShowImportModal(false), 2000);
    } catch (err) {
      alert('خطأ أثناء تأكيد الاستيراد: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Departments list for filter
  const departments = ['all', ...new Set(employees.map(e => e.department).filter(Boolean))];

  // Quick Stats
  const totalPayrollBasic = employees.reduce((s, e) => s + (Number(e.basic_salary) || 0), 0);
  const avgBasic = employees.length > 0 ? Math.round(totalPayrollBasic / employees.length) : 0;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-800">سجل وبيانات الموظفين</h1>
              <p className="text-xs md:text-sm text-slate-500">
                إدارة ملفات العاملين مع التحديد الجماعي، الحذف المتعدد، واستيراد وتصدير الإكسيل
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Download Template */}
          <a
            href="/api/employees/template/download"
            className="flex items-center gap-2 px-3.5 py-2 text-xs md:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
            download
          >
            <Download className="w-4 h-4 text-slate-500" />
            تحميل قالب الإكسيل
          </a>

          {/* Import Excel */}
          <button
            onClick={() => {
              setImportPreview(null);
              setImportMessage(null);
              setImportFile(null);
              setShowImportModal(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 text-xs md:text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-all border border-emerald-200"
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            استيراد من إكسيل
          </button>

          {/* Export Excel */}
          <a
            href="/api/employees/export/excel"
            className="flex items-center gap-2 px-3.5 py-2 text-xs md:text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all border border-blue-200"
            download
          >
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            تصدير كشف الموظفين
          </a>

          {/* Add Employee */}
          <button
            onClick={() => {
              setEditingEmployee(null);
              setFormData(initialForm);
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all"
          >
            <UserPlus className="w-4 h-4" />
            إضافة موظف جديد
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-2 py-3 px-5 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'list'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          قائمة وبيانات الموظفين
        </button>

        <button
          onClick={() => setActiveTab('progression')}
          className={`flex items-center gap-2 py-3 px-5 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'progression'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          تدرج الرواتب والزيادات السنوية
        </button>
      </div>

      {activeTab === 'list' ? (
        <>
          {/* Enhanced Statistics Banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>عدد الموظفين المقيدين</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black font-mono text-slate-900">{employees.length}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>إجمالي المرتب الأساسي</span>
            <DollarSign className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black font-mono text-rose-700">
            {totalPayrollBasic.toLocaleString()} <span className="text-xs font-sans text-slate-400">ج.م</span>
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>متوسط المرتب الأساسي</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black font-mono text-emerald-700">
            {avgBasic.toLocaleString()} <span className="text-xs font-sans text-slate-400">ج.م</span>
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>الأقسام والإدارات</span>
            <Briefcase className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black font-mono text-indigo-700">
            {departments.filter(d => d !== 'all').length}
          </p>
        </div>
      </div>

      {/* Sticky Bulk Action Bar (Visible when rows are selected) */}
      {selectedIds.length > 0 && (
        <div className="sticky top-20 z-20 flex items-center justify-between p-4 bg-slate-900 text-white rounded-2xl shadow-xl border border-slate-700 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center font-mono font-bold text-sm">
              {selectedIds.length}
            </span>
            <div>
              <p className="font-bold text-sm">تم تحديد {selectedIds.length} موظف</p>
              <p className="text-xs text-slate-400">يمكنك تطبيق إجراء الحذف الجماعي عليهم بضغطة واحدة</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs md:text-sm font-bold rounded-xl shadow-xs transition-all"
            >
              <Trash2 className="w-4 h-4" />
              <span>حذف المحددين ({selectedIds.length})</span>
            </button>

            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
            >
              إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <div className="relative md:col-span-2">
          <Search className="w-5 h-5 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالاسم، الكود، الرقم القومي، أو الوظيفة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-11 pl-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="w-full py-2.5 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="all">كل الأقسام والإدارات</option>
            {departments.filter(d => d !== 'all').map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Employees Table (Desktop) & Cards (Mobile) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mb-3 text-blue-600" />
            <p className="text-sm">جاري تحميل بيانات الموظفين...</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center p-12 text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-base font-medium text-slate-600">لا يوجد موظفين مطابقين للبحث</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View with Multi-Select Checkboxes */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-right text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 select-none">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={employees.length > 0 && selectedIds.length === employees.length}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                        title="تحديد الكل"
                      />
                    </th>
                    <th className="py-3 px-2 w-10 text-center">م</th>
                    <th className="py-3 px-3">القسم</th>
                    <th className="py-3 px-4 font-bold text-slate-900">اسم الموظف</th>
                    <th className="py-3 px-3 text-center">الكود</th>
                    <th className="py-3 px-2 text-center bg-emerald-50/60 text-emerald-900 font-bold" title="رمز الدخول السريع للبوابة">رمز PIN</th>
                    <th className="py-3 px-3">الرقم القومي</th>
                    <th className="py-3 px-3">الرقم التأميني</th>
                    <th className="py-3 px-3">الوظيفة</th>
                    <th className="py-3 px-3 text-center bg-rose-50/60 text-rose-800 font-bold">المرتب الأساسي</th>
                    <th className="py-3 px-3 text-center">مرتب فعلي</th>
                    <th className="py-3 px-3 text-center">أساسي تأمينات</th>
                    <th className="py-3 px-3 text-center">بدلات خاضعة</th>
                    <th className="py-3 px-3 text-center">بدلات غير خاضعة</th>
                    <th className="py-3 px-3 text-center text-teal-800 bg-teal-50/60" title="اشتراك التأمين الطبي الخاص">تأمين طبي</th>
                    <th className="py-3 px-3 text-center bg-blue-50/60 text-blue-800 font-bold">رصيد سنوي</th>
                    <th className="py-3 px-3 text-center w-24">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map((emp) => {
                    const isSelected = selectedIds.includes(emp.id);
                    return (
                      <tr 
                        key={emp.id} 
                        className={`transition-colors ${
                          isSelected ? 'bg-blue-50/60 font-semibold' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(emp.id)}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-2 text-center font-mono text-slate-400">{emp.seq}</td>
                        <td className="py-3 px-3">
                          <span className="inline-block px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-700 rounded-md">
                            {emp.department}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{emp.name}</span>
                            {emp.exclude_from_payroll === 1 && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded border border-amber-200" title="مستثنى من كشف المرتبات الشهري (مثل مدير المخازن)">
                                بدون مرتب
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-semibold text-blue-700 bg-blue-50/40 rounded">
                          {emp.code}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {emp.pin_code ? (
                            <span className="px-2 py-0.5 font-mono font-black text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md">
                              {emp.pin_code}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono">غير محدد</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600">{emp.national_id || '-'}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">{emp.insurance_no || '-'}</td>
                        <td className="py-3 px-3 font-medium text-slate-800">{emp.job_title}</td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-rose-700 bg-rose-50/30">
                          {emp.basic_salary.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-medium text-slate-700">
                          {emp.actual_salary.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-600">
                          {emp.insurance_basic.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-700">
                          {emp.taxable_allowances.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-500">
                          {emp.non_taxable_allowances || 0}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-teal-700 bg-teal-50/20 font-bold">
                          {emp.medical_insurance ? emp.medical_insurance.toLocaleString() : '-'}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-blue-700 bg-blue-50/30">
                          {emp.annual_leave_balance} يوم
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {emp.pin_code && (
                              <button
                                onClick={() => handleResetPin(emp)}
                                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                title="تصفير رمز المرور السري PIN"
                              >
                                <Key className="w-3.5 h-3.5 text-amber-600" />
                              </button>
                            )}
                            <button
                              onClick={() => handleViewOfficialStatement(emp.id)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="شهادة مفردات مرتب رسمية معتمدة"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                            </button>
                            <button
                              onClick={() => handleEditClick(emp)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="تعديل"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(emp.id, emp.name)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="حذف"
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

            {/* Mobile Cards View with Multi-Select Checkboxes */}
            <div className="lg:hidden divide-y divide-slate-100 p-3 space-y-3">
              <div className="flex items-center justify-between px-2 pb-2 border-b border-slate-100 text-xs">
                <button
                  onClick={handleSelectAll}
                  className="font-bold text-blue-600 flex items-center gap-1.5"
                >
                  {selectedIds.length === employees.length ? (
                    <><CheckSquare className="w-4 h-4" /> إلغاء تحديد الكل</>
                  ) : (
                    <><Square className="w-4 h-4" /> تحديد كل الموظفين</>
                  )}
                </button>
                <span className="text-slate-400 font-mono">({employees.length} موظف)</span>
              </div>

              {employees.map((emp) => {
                const isSelected = selectedIds.includes(emp.id);
                return (
                  <div 
                    key={emp.id} 
                    className={`p-4 rounded-xl border transition-all space-y-3 ${
                      isSelected 
                        ? 'bg-blue-50/80 border-blue-300 shadow-sm' 
                        : 'bg-slate-50/70 border-slate-200/70'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(emp.id)}
                          className="w-5 h-5 mt-1 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs px-2 py-0.5 bg-blue-100 text-blue-700 font-bold rounded">
                              {emp.code}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-slate-200/80 text-slate-700 rounded">
                              {emp.department}
                            </span>
                          </div>
                          <h3 className="font-bold text-slate-900 text-base">{emp.name}</h3>
                          <p className="text-xs text-slate-500">{emp.job_title}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditClick(emp)}
                          className="p-2 text-blue-600 bg-white shadow-xs rounded-lg border border-slate-200"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(emp.id, emp.name)}
                          className="p-2 text-rose-600 bg-white shadow-xs rounded-lg border border-slate-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/60 font-mono">
                      <div className="bg-white p-2 rounded-lg border border-slate-100">
                        <span className="text-slate-400 block text-[10px]">المرتب الأساسي</span>
                        <span className="font-bold text-rose-600">{emp.basic_salary.toLocaleString()} ج.م</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-100">
                        <span className="text-slate-400 block text-[10px]">المرتب الفعلي</span>
                        <span className="font-bold text-slate-800">{emp.actual_salary.toLocaleString()} ج.م</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-100">
                        <span className="text-slate-400 block text-[10px]">البدلات الخاضعة</span>
                        <span className="font-semibold text-slate-700">{emp.taxable_allowances.toLocaleString()} ج.م</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-100">
                        <span className="text-slate-400 block text-[10px]">رصيد الإجازات</span>
                        <span className="font-bold text-blue-600">{emp.annual_leave_balance} يوم</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      </>
      ) : (
        /* =================== TAB 2: SALARY PROGRESSION & ANNUAL INCREMENT =================== */
        <div className="space-y-6">
          {/* Header Explanation */}
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-bold">نظام تدرج الرواتب والزيادات السنوية الدورية</h2>
              </div>
              <p className="text-xs text-blue-200 leading-relaxed max-w-2xl">
                يتيح هذا النظام تطبيق الزيادات السنوية كنسبة مئوية من الراتب الفعلي وتحديث الراتب الأساسي والتأمينات والبدلات تلقائياً مع بداية العام الجديد، مع حفظ وتوثيق كامل لتاريخ تدرج راتب كل موظف على مدار الأعوام.
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
                إجمالي العاملين: <strong>{employees.length}</strong>
              </span>
            </div>
          </div>

          {/* Card 1: Annual Increment Tool */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-800">أداة احتساب وتطبيق الزيادة السنوية للعام الجديد</h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg">
                معاينة فورية قبل التطبيق
              </span>
            </div>

            <form onSubmit={handleApplyAnnualIncrement} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">عام الزيادة السنوية</label>
                  <select
                    value={incrementForm.year}
                    onChange={(e) => setIncrementForm({ ...incrementForm, year: Number(e.target.value) })}
                    className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800"
                  >
                    {[2025, 2026, 2027, 2028, 2029].map(y => (
                      <option key={y} value={y}>عام {y}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">تاريخ سريان الزيادة</label>
                  <input
                    type="date"
                    required
                    value={incrementForm.effective_date}
                    onChange={(e) => setIncrementForm({ ...incrementForm, effective_date: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">نسبة الزيادة السنوية (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="100"
                      required
                      value={incrementForm.increase_percent}
                      onChange={(e) => setIncrementForm({ ...incrementForm, increase_percent: Number(e.target.value) })}
                      className="w-full py-2 px-3 pl-8 bg-blue-50/50 border border-blue-200 rounded-xl font-mono font-bold text-blue-700 text-sm"
                    />
                    <Percent className="w-3.5 h-3.5 absolute left-3 top-3 text-blue-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">نطاق تطبيق الزيادة</label>
                  <select
                    value={incrementForm.apply_to}
                    onChange={(e) => setIncrementForm({ ...incrementForm, apply_to: e.target.value })}
                    className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  >
                    <option value="all">كافة الموظفين المقيدين ({employees.length} موظف)</option>
                    <option value="selected" disabled={selectedIds.length === 0}>
                      الموظفون المحددون فقط ({selectedIds.length} موظف)
                    </option>
                  </select>
                </div>
              </div>

              {/* Options */}
              <div className="flex flex-wrap items-center gap-6 pt-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={incrementForm.adjust_basic}
                    onChange={(e) => setIncrementForm({ ...incrementForm, adjust_basic: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span>زيادة الراتب الأساسي بنفس النسبة</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={incrementForm.adjust_insurance}
                    onChange={(e) => setIncrementForm({ ...incrementForm, adjust_insurance: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span>زيادة أساسي التأمينات الاجتماعية بنفس النسبة</span>
                </label>
              </div>

              {/* Live Preview Table */}
              <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 flex justify-between items-center">
                  <span>جدول المعاينة التقديرية للرواتب بعد الزيادة المقترحة ({incrementForm.increase_percent}%)</span>
                  <span className="font-mono text-blue-700 font-bold">
                    معامل الضرب: {(1 + (Number(incrementForm.increase_percent) / 100)).toFixed(2)}
                  </span>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead className="bg-slate-50 text-[11px] text-slate-600 border-b border-slate-200 sticky top-0 font-bold">
                      <tr>
                        <th className="p-2 text-center w-12">كود</th>
                        <th className="p-2">اسم الموظف</th>
                        <th className="p-2">القسم</th>
                        <th className="p-2 text-center">المرتب الفعلي الحالي</th>
                        <th className="p-2 text-center text-emerald-700">قيمة الزيادة (+{incrementForm.increase_percent}%)</th>
                        <th className="p-2 text-center bg-emerald-50 text-emerald-900 font-bold">المرتب الفعلي الجديد</th>
                        <th className="p-2 text-center">الأساسي المقترح</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {employees.slice(0, 15).map(emp => {
                        const curActual = Number(emp.actual_salary) || Number(emp.basic_salary) || 0;
                        const incVal = Math.round(curActual * (Number(incrementForm.increase_percent) / 100));
                        const newActual = curActual + incVal;
                        const curBasic = Number(emp.basic_salary) || 0;
                        const newBasic = incrementForm.adjust_basic 
                          ? Math.round(curBasic * (1 + (Number(incrementForm.increase_percent) / 100))) 
                          : curBasic;

                        return (
                          <tr key={emp.id} className="hover:bg-slate-50">
                            <td className="p-2 text-center font-bold text-slate-500">{emp.code}</td>
                            <td className="p-2 font-sans font-bold text-slate-800">{emp.name}</td>
                            <td className="p-2 font-sans text-slate-600">{emp.department}</td>
                            <td className="p-2 text-center text-slate-600">{curActual.toLocaleString()} ج</td>
                            <td className="p-2 text-center font-bold text-emerald-600">+{incVal.toLocaleString()} ج</td>
                            <td className="p-2 text-center font-black bg-emerald-50 text-emerald-900">{newActual.toLocaleString()} ج</td>
                            <td className="p-2 text-center text-slate-700">{newBasic.toLocaleString()} ج</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {employees.length > 15 && (
                  <div className="bg-slate-50 px-4 py-2 text-center text-[11px] text-slate-500 border-t border-slate-200">
                    عرض أول 15 موظف كعينة للمعاينة — سيتم تطبيق الزيادة على كامل الـ {employees.length} موظف عند التأكيد.
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="submit"
                  disabled={applyingIncrement}
                  className="flex items-center gap-2 px-6 py-2.5 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-all text-xs"
                >
                  {applyingIncrement ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>اعتماد وتطبيق الزيادة السنوية رسمياً لعام {incrementForm.year}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Card 2: Historical Salary Progression Log */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-800">سجل تاريخ تدرج رواتب العاملين عبر السنوات</h3>
              </div>
              <button
                onClick={loadSalaryHistory}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                تحديث السجل
              </button>
            </div>

            {loadingHistory ? (
              <div className="p-8 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                <p className="text-xs">جاري تحميل سجل تدرج الرواتب...</p>
              </div>
            ) : salaryHistory.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-medium text-slate-600">لا توجد حركات تدرج رواتب سابقة مسجلة حتى الآن</p>
                <p className="text-[11px] text-slate-400 mt-0.5">عند تطبيق زيادة سنوية ستظهر حركات الزيادة لكل موظف وتاريخها هنا</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-right border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 text-center">عام الزيادة</th>
                      <th className="p-2.5 text-center">تاريخ السريان</th>
                      <th className="p-2.5 text-center">كود</th>
                      <th className="p-2.5">اسم الموظف</th>
                      <th className="p-2.5 text-center">نسبة الزيادة</th>
                      <th className="p-2.5 text-center">الراتب الفعلي السابق</th>
                      <th className="p-2.5 text-center font-bold text-emerald-800 bg-emerald-50/50">الراتب الفعلي الجديد</th>
                      <th className="p-2.5 text-center">الأساسي الجديد</th>
                      <th className="p-2.5">البيان والملاحظات</th>
                      <th className="p-2.5 text-center">تاريخ التسجيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                    {salaryHistory.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="p-2.5 text-center font-bold text-blue-700">{row.year}</td>
                        <td className="p-2.5 text-center text-slate-600">{row.effective_date}</td>
                        <td className="p-2.5 text-center font-bold text-slate-500">{row.employee_code}</td>
                        <td className="p-2.5 font-sans font-bold text-slate-900">{row.employee_name}</td>
                        <td className="p-2.5 text-center font-bold text-amber-700">+{row.increase_percent}%</td>
                        <td className="p-2.5 text-center text-slate-500 line-through">{row.old_actual_salary.toLocaleString()} ج</td>
                        <td className="p-2.5 text-center font-black text-emerald-800 bg-emerald-50/30">
                          {row.new_actual_salary.toLocaleString()} ج
                        </td>
                        <td className="p-2.5 text-center text-slate-700">{row.new_basic_salary.toLocaleString()} ج</td>
                        <td className="p-2.5 font-sans text-slate-600">{row.notes || '-'}</td>
                        <td className="p-2.5 text-center text-[10px] text-slate-400">{row.created_at ? row.created_at.split(' ')[0] : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-slate-800">
                {editingEmployee ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">اسم الموظف *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">كود الموظف *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3.5 py-2 font-mono border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">القسم / الإدارة</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">الوظيفة</label>
                  <input
                    type="text"
                    value={formData.job_title}
                    onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">رقم البطاقة (الرقم القومي)</label>
                  <input
                    type="text"
                    value={formData.national_id}
                    onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                    className="w-full px-3.5 py-2 font-mono border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">الرقم التأميني</label>
                  <input
                    type="text"
                    value={formData.insurance_no}
                    onChange={(e) => setFormData({ ...formData, insurance_no: e.target.value })}
                    className="w-full px-3.5 py-2 font-mono border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">المرتب الأساسي (ج.م) *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.basic_salary}
                    onChange={(e) => setFormData({ ...formData, basic_salary: e.target.value })}
                    className="w-full px-3.5 py-2 font-mono border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">مرتب فعلي (ج.م)</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.actual_salary}
                    onChange={(e) => setFormData({ ...formData, actual_salary: e.target.value })}
                    className="w-full px-3.5 py-2 font-mono border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">أساسي تأمينات (ج.م)</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.insurance_basic}
                    onChange={(e) => setFormData({ ...formData, insurance_basic: e.target.value })}
                    className="w-full px-3.5 py-2 font-mono border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">البدلات الخاضعة للضريبة (ج.م)</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.taxable_allowances}
                    onChange={(e) => setFormData({ ...formData, taxable_allowances: e.target.value })}
                    className="w-full px-3.5 py-2 font-mono border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">البدلات غير الخاضعة للضريبة (ج.م)</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.non_taxable_allowances}
                    onChange={(e) => setFormData({ ...formData, non_taxable_allowances: e.target.value })}
                    className="w-full px-3.5 py-2 font-mono border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    اشتراك التأمين الطبي الخاص (شهرياً - ج.م)
                    <span className="text-[11px] text-rose-500 font-normal mr-1">(خاضع للضريبة)</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.medical_insurance || 0}
                    onChange={(e) => setFormData({ ...formData, medical_insurance: e.target.value })}
                    className="w-full px-3.5 py-2 font-mono border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">رصيد الإجازات السنوية (أيام)</label>
                  <input
                    type="number"
                    value={formData.annual_leave_balance}
                    onChange={(e) => setFormData({ ...formData, annual_leave_balance: e.target.value })}
                    className="w-full px-3.5 py-2 font-mono border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    رقم الهاتف المحمول (للدخول والتواصل)
                  </label>
                  <input
                    type="tel"
                    placeholder="010xxxxxxxx"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2 font-mono border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    رمز المرور السري (PIN) لدخول البوابة (4 أرقام)
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="مثال: 1234"
                    value={formData.pin_code || ''}
                    onChange={(e) => setFormData({ ...formData, pin_code: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3.5 py-2 font-mono text-center tracking-widest text-base font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                {/* Exclude from Payroll Switch */}
                <div className="md:col-span-2 p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-2xl flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="font-bold text-amber-950 block text-xs md:text-sm">
                      استثناء الموظف من كشف المرتبات الشهري
                    </span>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      فعل هذا الخيار للوظائف التي لا يتم احتساب مرتب شهري لها في مسير الرواتب (مثل مدير المخازن، الإدارة العليا، والشركاء).
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={!!formData.exclude_from_payroll}
                      onChange={(e) => setFormData({ ...formData, exclude_from_payroll: e.target.checked ? 1 : 0 })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                  </label>
                </div>

                {/* PIN Code Status & Reset */}
                {editingEmployee && (
                  <div className="md:col-span-2 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-xl ${editingEmployee.pin_code ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        <Key className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 text-xs block">حالة رمز المرور السري (PIN Code):</span>
                        <span className="text-[11px] text-slate-500">
                          {editingEmployee.pin_code 
                            ? 'تم تعيين رمز سري PIN خاص للموظف للدخول من البوابة' 
                            : 'لم يتم تعيين رمز سري بعد (سيطلب منه النظام إنشاء رمز سري عند أول دخول)'}
                        </span>
                      </div>
                    </div>
                    {editingEmployee.pin_code && (
                      <button
                        type="button"
                        onClick={() => handleResetPin(editingEmployee)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all shrink-0"
                      >
                        تصفير رمز الـ PIN
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs"
                >
                  {editingEmployee ? 'حفظ التعديلات' : 'إضافة الموظف'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Import & Preview Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">استيراد بيانات الموظفين من إكسيل</h2>
                  <p className="text-xs text-slate-500">معاينة البيانات قبل الاعتماد والتأكيد</p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/50 rounded-2xl p-6 text-center transition-all">
                <Upload className="w-10 h-10 mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-semibold text-slate-700 mb-1">
                  اختر ملف الإكسيل (.xlsx أو .xls) الخاص ببيانات الموظفين
                </p>
                <p className="text-xs text-slate-400 mb-4">
                  يمكنك تحميل القالب القياسي لتعبئته أولاً لتفادي أي أخطاء
                </p>

                <div className="flex items-center justify-center gap-3">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-semibold rounded-xl shadow-xs transition-all">
                    <span>تصفح الملف من جهازك</span>
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>

                  <a
                    href="/api/employees/template/download"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100"
                    download
                  >
                    <Download className="w-3.5 h-3.5" />
                    تحميل القالب
                  </a>
                </div>

                {importFile && (
                  <p className="mt-3 text-xs font-mono text-emerald-600 font-medium">
                    الملف المحدد: {importFile.name}
                  </p>
                )}
              </div>

              {importMessage && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
                  <span>{importMessage}</span>
                </div>
              )}

              {importPreview && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 text-sm">
                      معاينة البيانات ({importPreview.total} صف إجمالي - {importPreview.newCount} جديد - {importPreview.updateCount} تحديث)
                    </h3>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-72">
                    <table className="w-full text-right text-xs text-slate-600">
                      <thead className="bg-slate-100 text-slate-700 sticky top-0 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 text-center">الحالة</th>
                          <th className="py-2.5 px-3">الكود</th>
                          <th className="py-2.5 px-4 font-bold text-slate-900">اسم الموظف</th>
                          <th className="py-2.5 px-3">القسم</th>
                          <th className="py-2.5 px-3">الوظيفة</th>
                          <th className="py-2.5 px-3 text-center">الأساسي</th>
                          <th className="py-2.5 px-3 text-center">الفعلي</th>
                          <th className="py-2.5 px-3 text-center">بدلات خاضعة</th>
                          <th className="py-2.5 px-3 text-center">رصيد سنوي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {importPreview.items.map((row, idx) => (
                          <tr key={idx} className={row.warnings.length > 0 ? 'bg-amber-50/40' : ''}>
                            <td className="py-2 px-3 text-center">
                              {row.isExisting ? (
                                <span className="inline-block px-2 py-0.5 text-[10px] bg-blue-100 text-blue-800 font-semibold rounded">
                                  تحديث
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 text-[10px] bg-emerald-100 text-emerald-800 font-semibold rounded">
                                  جديد
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-blue-700">{row.code}</td>
                            <td className="py-2 px-4 font-semibold text-slate-800">{row.name}</td>
                            <td className="py-2 px-3">{row.department}</td>
                            <td className="py-2 px-3">{row.job_title}</td>
                            <td className="py-2 px-3 text-center font-mono">{row.basic_salary}</td>
                            <td className="py-2 px-3 text-center font-mono">{row.actual_salary}</td>
                            <td className="py-2 px-3 text-center font-mono">{row.taxable_allowances}</td>
                            <td className="py-2 px-3 text-center font-mono">{row.annual_leave_balance}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-xl"
              >
                إغلاق
              </button>

              {importPreview && importPreview.items.length > 0 && (
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={handleConfirmImport}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تأكيد استيراد {importPreview.items.length} موظف إلى النظام</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Official Salary Statement Modal (شهادة مفردات مرتب رسمية معتمدة) */}
      {officialStatement && (
        <OfficialSalaryStatementModal
          statement={officialStatement}
          onClose={() => setOfficialStatement(null)}
        />
      )}
    </div>
  );
}
