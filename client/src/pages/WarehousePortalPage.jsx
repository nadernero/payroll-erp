import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Users, CheckCircle2, XCircle, Clock3, PlusCircle, 
  Search, Check, X, Palmtree, Clock, DollarSign, AlertCircle, 
  ArrowLeft, LogOut, FileText, Send, UserCheck, Shield, ChevronRight,
  TrendingDown, ArrowUpDown, Filter, Sparkles
} from 'lucide-react';
import { fetchJson } from '../utils/api';

export default function WarehousePortalPage() {
  const [manager, setManager] = useState(() => {
    const saved = localStorage.getItem('warehouse_manager_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [managerCode, setManagerCode] = useState('');
  const [managerPin, setManagerPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'new_request', 'workers_balances', 'history'

  const [requests, setRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(false);

  // Workers Balances Tab Filters & Search
  const [balanceSearch, setBalanceSearch] = useState('');
  const [balanceJobFilter, setBalanceJobFilter] = useState('all');
  const [balanceSortBy, setBalanceSortBy] = useState('code_asc');

  // New Request On-Behalf Form
  const [form, setForm] = useState({
    employee_id: '',
    request_type: 'leave', // 'leave', 'overtime', 'deduction', 'loan'
    title: '',
    date_from: new Date().toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
    quantity: 1,
    details: '',
    manager_notes: 'معتمد وموصى به من مدير المخازن'
  });
  const [submitting, setSubmitting] = useState(false);

  // Load Data
  const loadData = async () => {
    try {
      setLoading(true);
      const [reqData, empData, balData] = await Promise.all([
        fetchJson('/requests'),
        fetchJson('/employees'),
        fetchJson('/payroll/balances-report')
      ]);
      setRequests(reqData);
      setEmployees(empData);
      setBalances(balData);
      if (empData.length > 0 && !form.employee_id) {
        setForm(prev => ({ ...prev, employee_id: empData[0].id }));
      }
    } catch (err) {
      console.error('Error loading warehouse portal data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (manager) {
      loadData();
    }
  }, [manager]);

  const [loginStep, setLoginStep] = useState('login'); // 'login', 'setup_pin'
  const [setupPin, setSetupPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pendingMgr, setPendingMgr] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    const code = managerCode.trim();
    if (!code) {
      setLoginError('يرجى إدخال كود المدير أو رقم المرور');
      return;
    }

    // Default override for demo 'manager'
    if (code.toLowerCase() === 'manager') {
      const mgrUser = {
        code: 'manager',
        name: 'أمين المخازن الرئيسي',
        department: 'إدارة المخازن والحركة',
        title: 'مدير مخازن'
      };
      localStorage.setItem('warehouse_manager_user', JSON.stringify(mgrUser));
      setManager(mgrUser);
      return;
    }

    try {
      const res = await fetchJson('/portal/login', {
        method: 'POST',
        body: JSON.stringify({ code, pin: managerPin.trim() })
      });

      if (res.needPinSetup) {
        setPendingMgr(res.employee);
        setLoginStep('setup_pin');
      } else if (res.needPin) {
        setLoginError('يرجى إدخال رمز الـ PIN المكون من 4 أرقام');
      } else if (res.success && res.employee) {
        const mgrUser = {
          id: res.employee.id,
          code: res.employee.code,
          name: res.employee.name,
          department: res.employee.department,
          title: res.employee.job_title
        };
        localStorage.setItem('warehouse_manager_user', JSON.stringify(mgrUser));
        setManager(mgrUser);
      }
    } catch (err) {
      setLoginError(err.message || 'خطأ في تسجيل الدخول');
    }
  };

  const handleSaveManagerPin = async (e) => {
    e.preventDefault();
    if (!setupPin || setupPin.length !== 4) {
      setLoginError('رمز الـ PIN يجب أن يكون من 4 أرقام بالضبط');
      return;
    }
    if (setupPin !== confirmPin) {
      setLoginError('رمز الـ PIN وتأكيده غير متطابقين');
      return;
    }

    try {
      const res = await fetchJson('/portal/setup-pin', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: pendingMgr.id,
          pin_code: setupPin.trim()
        })
      });

      if (res.success && res.employee) {
        const mgrUser = {
          id: res.employee.id,
          code: res.employee.code,
          name: res.employee.name,
          department: res.employee.department,
          title: res.employee.job_title
        };
        localStorage.setItem('warehouse_manager_user', JSON.stringify(mgrUser));
        setManager(mgrUser);
      }
    } catch (err) {
      setLoginError(err.message || 'خطأ في حفظ رمز المرور');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('warehouse_manager_user');
    setManager(null);
  };

  // Warehouse Manager Action on worker's request
  const handleManagerAction = async (id, action) => {
    const isApprove = action === 'approved';
    const notes = prompt(
      isApprove ? 'ملاحظات وتوصية مدير المخزن للموافقة والتمرير للإدارة:' : 'سبب رفض الطلب:',
      isApprove ? 'تمت مراجعة رصيد العامل وحاجة العمل والموافقة من طرفي' : 'مرفوض لضغط العمل بالمخزن'
    );
    if (notes === null) return;

    try {
      await fetchJson(`/requests/${id}/manager-action`, {
        method: 'PUT',
        body: JSON.stringify({ action, manager_notes: notes })
      });
      alert(isApprove ? 'تمت الموافقة وتمرير الطلب للإدارة العامة للاعتماد النهائي!' : 'تم رفض الطلب');
      loadData();
    } catch (err) {
      alert('خطأ أثناء معالجة الطلب: ' + err.message);
    }
  };

  // Selected employee & remaining leaves
  const selectedEmpBalance = balances.find(b => String(b.id) === String(form.employee_id));
  const remainingLeaveDays = selectedEmpBalance?.annual_leaves?.remaining_days ?? 21;

  // Filtered and sorted workers for Balances Tab
  const jobTitlesList = useMemo(() => {
    return Array.from(new Set(balances.map(b => b.job_title).filter(Boolean)));
  }, [balances]);

  const filteredBalances = useMemo(() => {
    return balances.filter(b => {
      const q = balanceSearch.trim().toLowerCase();
      const matchesSearch = !q || 
        (b.name && b.name.toLowerCase().includes(q)) || 
        String(b.code).includes(q) ||
        (b.job_title && b.job_title.toLowerCase().includes(q));
      const matchesJob = balanceJobFilter === 'all' || b.job_title === balanceJobFilter;
      return matchesSearch && matchesJob;
    }).sort((a, b) => {
      if (balanceSortBy === 'name_asc') return a.name.localeCompare(b.name, 'ar');
      if (balanceSortBy === 'job_title') return (a.job_title || '').localeCompare(b.job_title || '', 'ar');
      if (balanceSortBy === 'remaining_desc') return (b.annual_leaves?.remaining_days || 0) - (a.annual_leaves?.remaining_days || 0);
      if (balanceSortBy === 'remaining_asc') return (a.annual_leaves?.remaining_days || 0) - (b.annual_leaves?.remaining_days || 0);
      return Number(a.code) - Number(b.code);
    });
  }, [balances, balanceSearch, balanceJobFilter, balanceSortBy]);

  // Submit on behalf of worker
  const handleOnBehalfSubmit = async (e) => {
    e.preventDefault();
    if (!form.employee_id) {
      alert('يرجى اختيار العامل أو السائق');
      return;
    }

    if (form.request_type === 'leave') {
      const q = Number(form.quantity) || 1;
      if (q > remainingLeaveDays) {
        alert(`لا يمكن تقديم طلب إجازة (${q} يوم) يتجاوز رصيد الإجازات المتبقي للعامل (${remainingLeaveDays} يوم).`);
        return;
      }
    }

    if (form.request_type === 'deduction') {
      const q = Number(form.quantity);
      if (isNaN(q) || q < 0.5) {
        alert('مقدار الخصم يجب أن يبدأ من نصف يوم (0.5) على الأقل');
        return;
      }
      if (!form.details || !form.details.trim()) {
        alert('يرجى كتابة وتوضيح سبب الخصم بالتفصيل');
        return;
      }
    }

    try {
      setSubmitting(true);
      const title = form.title || (
        form.request_type === 'leave' ? `إجازة سنوية (${form.quantity} يوم)` :
        form.request_type === 'overtime' ? `احتساب إضافي (${form.quantity} يوم)` :
        form.request_type === 'deduction' ? `خصم / غياب جزئي (${form.quantity} يوم) - ${form.details}` :
        `طلب سلفة مالية (${form.quantity} ج)`
      );

      await fetchJson('/requests/on-behalf', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          title
        })
      });

      alert(form.request_type === 'deduction'
        ? 'تم بنجاح رفع طلب الخصم والغياب للإدارة العامة للاعتماد!'
        : 'تم بنجاح رفع الطلب نيابة عن الموظف واعتماده مبدئياً وإحالته للإدارة العامة للاعتماد النهائي!');

      setForm({
        employee_id: employees.length > 0 ? employees[0].id : '',
        request_type: 'leave',
        title: '',
        date_from: new Date().toISOString().split('T')[0],
        date_to: new Date().toISOString().split('T')[0],
        quantity: 1,
        details: '',
        manager_notes: 'معتمد وموصى به من مدير المخازن'
      });
      setActiveTab('pending');
      loadData();
    } catch (err) {
      alert('خطأ أثناء تقديم الطلب: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Filter requests for warehouse manager
  const pendingForManager = requests.filter(r => r.status === 'pending_manager' || (r.status === 'pending' && r.manager_status !== 'approved'));
  const approvedByManager = requests.filter(r => r.manager_status === 'approved' || r.submitted_by?.includes('مدير المخزن'));

  // ------------------ LOGIN SCREEN ------------------
  if (!manager) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 font-['Cairo',sans-serif] text-slate-100">
        <div className="w-full max-w-md bg-slate-800/90 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-700 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-2xl mx-auto flex items-center justify-center border border-amber-500/30">
              <Building2 className="w-9 h-9" />
            </div>
            <h1 className="text-2xl font-black text-white">بوابة مسؤولي المخازن والفروع</h1>
            <p className="text-xs text-slate-400">
              تسجيل دخول مستقل لاعتماد طلبات العمال والسائقين وتقديم طلبات بالنيابة عنهم
            </p>
          </div>

          {loginStep === 'setup_pin' ? (
            <form onSubmit={handleSaveManagerPin} className="space-y-4 text-xs">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 text-center space-y-1">
                <Sparkles className="w-5 h-5 mx-auto text-amber-400" />
                <h3 className="font-bold text-sm text-white">إنشاء رمز PIN للمدير لأول مرة</h3>
                <p className="text-[11px] text-amber-200/80">
                  مرحباً بك يا <span className="font-bold underline">{pendingMgr?.name}</span>! أنشئ رمز مرور سري (4 أرقام) لبوابتك.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">الرمز السري الجديد (4 أرقام)</label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  autoFocus
                  placeholder="مثال: 1234"
                  value={setupPin}
                  onChange={(e) => setSetupPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-center font-mono text-lg font-bold tracking-widest focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">تأكيد الرمز السري</label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  placeholder="أعد إدخال الـ 4 أرقام"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-center font-mono text-lg font-bold tracking-widest focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={setupPin.length !== 4 || setupPin !== confirmPin}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-950 font-black rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2"
              >
                <span>حفظ رمز PIN والدخول</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setLoginStep('login')}
                className="w-full text-center text-slate-400 hover:text-slate-200 text-xs py-1"
              >
                ← إلغاء والرجوع
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              {loginError && (
                <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-xs text-rose-300">
                  {loginError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  كود المدير / رقم التعريف
                </label>
                <input
                  type="text"
                  required
                  value={managerCode}
                  onChange={(e) => setManagerCode(e.target.value)}
                  placeholder="مثال: 326 أو 435 أو manager"
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm font-mono text-center"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  رمز المرور (PIN السريع)
                </label>
                <input
                  type="password"
                  value={managerPin}
                  onChange={(e) => setManagerPin(e.target.value)}
                  placeholder="••••"
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm font-mono text-center tracking-widest"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2"
              >
                <span>دخول إلى بوابة المخازن</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </form>
          )}

        </div>
      </div>
    );
  }

  // ------------------ MAIN LOGGED-IN PORTAL ------------------
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-['Cairo',sans-serif] flex flex-col">
      {/* Top Standalone Header */}
      <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center border border-amber-500/30">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-white">بوابة مدير المخازن والفروع</h1>
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-bold rounded-md border border-amber-500/30">
                  بوابة مستقلة
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {manager.name} ({manager.department || 'إدارة المخازن'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="تحديث البيانات"
            >
              <Users className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 text-xs font-bold rounded-xl transition-all border border-slate-700"
              title="تسجيل الخروج"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="max-w-6xl mx-auto px-4 border-t border-slate-800/80 flex gap-2 overflow-x-auto text-xs py-2">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all shrink-0 ${
              activeTab === 'pending'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Clock3 className="w-4 h-4" />
            <span>طلبات العمال المعلقة للموافقة</span>
            {pendingForManager.length > 0 && (
              <span className="px-1.5 py-0.5 bg-rose-600 text-white text-[10px] font-black rounded-full">
                {pendingForManager.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('new_request')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all shrink-0 ${
              activeTab === 'new_request'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>تقديم طلب نيابة عن سائق أو عامل</span>
          </button>

          <button
            onClick={() => setActiveTab('workers_balances')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all shrink-0 ${
              activeTab === 'workers_balances'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Palmtree className="w-4 h-4" />
            <span>أرصدة إجازات العمال</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all shrink-0 ${
              activeTab === 'history'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>سجل الطلبات المعتمدة من قبلك</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl w-full mx-auto p-4 md:p-6 flex-1 space-y-6">
        
        {/* TAB 1: PENDING REQUESTS FOR MANAGER */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">طلبات عمال وسائقي المخازن المعلقة</h2>
                <p className="text-xs text-slate-500">
                  الطلبات التي تنتظر موافقة وتوصية مدير المخزن قبل تمريرها للإدارة العامة
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-amber-100 text-amber-900 rounded-xl">
                {pendingForManager.length} طلبات قيد المراجعة
              </span>
            </div>

            {pendingForManager.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center shadow-xs border border-slate-200 space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h3 className="text-base font-bold text-slate-800">لا توجد طلبات معلقة حالياً</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  جميع طلبات العمال والسائقين تمت مراجعتها، أو يمكنك تقديم طلب جديد نيابة عن عامل لا يمتلك هاتفاً ذكياً
                </p>
                <button
                  onClick={() => setActiveTab('new_request')}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl shadow-xs"
                >
                  تقديم طلب جديد نيابة عن عامل
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {pendingForManager.map((req) => (
                  <div 
                    key={req.id}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-amber-400 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-3 rounded-2xl shrink-0 ${
                        req.request_type === 'leave' ? 'bg-emerald-100 text-emerald-700' : 
                        req.request_type === 'deduction' ? 'bg-rose-100 text-rose-700' : 
                        req.request_type === 'loan' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {req.request_type === 'leave' ? <Palmtree className="w-6 h-6" /> : 
                         req.request_type === 'deduction' ? <AlertCircle className="w-6 h-6" /> : 
                         req.request_type === 'loan' ? <DollarSign className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs px-2 py-0.5 bg-blue-100 text-blue-800 font-bold rounded">
                            {req.employee_code}
                          </span>
                          <h4 className="font-black text-slate-900 text-sm">{req.employee_name}</h4>
                          <span className="text-xs text-slate-500">({req.job_title || req.department})</span>
                          
                          {/* Direct vs On Behalf indicator */}
                          {req.request_type === 'deduction' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-50 text-rose-700 rounded-md border border-rose-200">
                              طلب خصم / جزاء مرفوع من مدير المخزن
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
                              مقدم من العامل مباشرة عبر الموبايل
                            </span>
                          )}
                        </div>

                        <p className="text-sm font-bold text-slate-800">{req.title}</p>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span>التاريخ: <strong className="text-slate-700 font-mono">{req.date_from || '-'}</strong></span>
                          {req.date_to && req.date_to !== req.date_from && (
                            <span>إلى: <strong className="text-slate-700 font-mono">{req.date_to}</strong></span>
                          )}
                          <span>المقدار: <strong className="text-amber-800 font-bold font-mono">{req.quantity} {req.request_type === 'leave' || req.request_type === 'deduction' ? 'يوم' : req.request_type === 'loan' ? 'ج.م' : 'ساعة'}</strong></span>
                          <span className="text-[11px] text-slate-400">تاريخ الطلب: {req.created_at ? req.created_at.split(' ')[0] : ''}</span>
                        </div>

                        {req.details && (
                          <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 mt-1">
                            سبب الطلب: {req.details}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons for Warehouse Manager */}
                    <div className="flex items-center gap-2 shrink-0 md:self-center border-t md:border-t-0 pt-3 md:pt-0">
                      <button
                        onClick={() => handleManagerAction(req.id, 'approved')}
                        className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl shadow-xs transition-all"
                      >
                        <Check className="w-4 h-4" />
                        <span>موافقة وتمرير للإدارة</span>
                      </button>

                      <button
                        onClick={() => handleManagerAction(req.id, 'rejected')}
                        className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition-all"
                      >
                        <X className="w-4 h-4" />
                        <span>رفض</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SUBMIT ON BEHALF OF WORKER */}
        {activeTab === 'new_request' && (
          <div className="max-w-2xl mx-auto bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-black text-slate-900">تقديم طلب أو احتساب خصم نيابة عن عامل / سائق</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                نافذة خاصة بمدير المخازن لتقديم طلبات الإجازات، الإضافي، السلف، أو تسجيل خصومات وغيابات العمال
              </p>
            </div>

            <form onSubmit={handleOnBehalfSubmit} className="space-y-4 text-xs">
              {/* Employee Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  اختيار العامل أو السائق *
                </label>
                <select
                  required
                  value={form.employee_id}
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  <option value="">-- اختر العامل / السائق --</option>
                  {employees.map(emp => {
                    const b = balances.find(item => item.id === emp.id);
                    const remLeaves = b?.annual_leaves?.remaining_days ?? (emp.annual_leave_balance || 21);
                    return (
                      <option key={emp.id} value={emp.id}>
                        [{emp.code}] {emp.name} - {emp.job_title || emp.department} (رصيد الإجازات المتبقي: {remLeaves} يوم)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Selected Worker Info & Remaining Leaves Card */}
              {selectedEmpBalance && (
                <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                      <Palmtree className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm">{selectedEmpBalance.name}</span>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-md font-bold text-[10px]">
                          {selectedEmpBalance.job_title || selectedEmpBalance.department}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        كود: <strong className="font-mono text-blue-700">{selectedEmpBalance.code}</strong> | المستحق: <strong>{selectedEmpBalance.annual_leaves?.total_entitlement || 21} يوم</strong> | المستهلك: <strong className="text-rose-600">{selectedEmpBalance.annual_leaves?.used_days || 0} يوم</strong>
                      </p>
                    </div>
                  </div>
                  <div className="text-left bg-white px-3.5 py-2 rounded-xl border border-emerald-300 shadow-2xs">
                    <span className="text-[10px] text-slate-400 font-bold block">رصيد الإجازات المتبقي</span>
                    <span className="font-black font-mono text-base text-emerald-800">
                      {remainingLeaveDays} <span className="text-xs font-normal">يوم</span>
                    </span>
                  </div>
                </div>
              )}

              {/* Request Type Selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  نوع الطلب / الإجراء *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, request_type: 'leave' })}
                    className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                      form.request_type === 'leave'
                        ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Palmtree className="w-4 h-4" />
                    <span>إجازة سنوية</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, request_type: 'overtime' })}
                    className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                      form.request_type === 'overtime'
                        ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    <span>احتساب إضافي</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, request_type: 'deduction' })}
                    className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                      form.request_type === 'deduction'
                        ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                        : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span>خصم / غياب جزئي</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, request_type: 'loan' })}
                    className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                      form.request_type === 'loan'
                        ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>طلب سلفة</span>
                  </button>
                </div>
              </div>

              {/* Date & Quantity Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {form.request_type === 'leave' ? 'تاريخ بداية الإجازة *' : 
                     form.request_type === 'deduction' ? 'تاريخ يوم الخصم أو الغياب *' : 'التاريخ *'}
                  </label>
                  <input
                    type="date"
                    required
                    value={form.date_from}
                    onChange={(e) => setForm({ ...form, date_from: e.target.value, date_to: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl font-mono text-xs"
                  />
                </div>

                {form.request_type === 'leave' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      تاريخ نهاية الإجازة
                    </label>
                    <input
                      type="date"
                      value={form.date_to}
                      onChange={(e) => setForm({ ...form, date_to: e.target.value })}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl font-mono text-xs"
                    />
                  </div>
                )}

                <div className={form.request_type === 'deduction' ? 'col-span-1 sm:col-span-2' : ''}>
                  <label className="block font-bold text-slate-700 mb-1">
                    {form.request_type === 'leave' ? `عدد أيام الإجازة المطلوبة (الحد الأقصى: ${remainingLeaveDays} يوم) *` : 
                     form.request_type === 'deduction' ? 'مقدار الخصم أو الغياب (بداية من نصف يوم: 0.5، 1، 1.5...) *' :
                     form.request_type === 'loan' ? 'مبلغ السلفة المطلوب (ج.م) *' : 'عدد الساعات / الأيام الإضافية *'}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max={form.request_type === 'leave' ? remainingLeaveDays : undefined}
                    required
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className={`w-full px-3.5 py-2 border rounded-xl font-mono font-bold text-xs ${
                      form.request_type === 'deduction' ? 'border-rose-300 bg-rose-50/40 text-rose-900' : 'border-slate-200'
                    }`}
                  />

                  {/* Quick Preset Buttons for Deductions */}
                  {form.request_type === 'deduction' && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="text-[11px] font-bold text-slate-500">خيارات سريعة:</span>
                      {[
                        { label: 'نصف يوم (0.5)', val: 0.5 },
                        { label: 'يوم كامل (1.0)', val: 1.0 },
                        { label: 'يوم ونصف (1.5)', val: 1.5 },
                        { label: 'يومان (2.0)', val: 2.0 }
                      ].map(chip => (
                        <button
                          key={chip.val}
                          type="button"
                          onClick={() => setForm({ ...form, quantity: chip.val })}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                            Number(form.quantity) === chip.val
                              ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                              : 'bg-white text-rose-800 border-rose-200 hover:bg-rose-50'
                          }`}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Annual Leave Over-Balance Alert Banner */}
              {form.request_type === 'leave' && Number(form.quantity) > remainingLeaveDays && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    ⚠️ عذراً: عدد أيام الإجازة المطلوبة ({form.quantity} يوم) يتجاوز رصيد الإجازات المتبقي للعامل ({remainingLeaveDays} يوم). يرجى تقليل المدة لتتوافق مع الرصيد المتبقي.
                  </span>
                </div>
              )}

              {/* Details & Reason Field */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {form.request_type === 'deduction' ? 'سبب الخصم أو الغياب بالتفصيل (إلزامي للإدارة) *' : 'سبب أو تفاصيل الطلب'}
                </label>
                <textarea
                  rows="2"
                  required={form.request_type === 'deduction'}
                  value={form.details}
                  onChange={(e) => setForm({ ...form, details: e.target.value })}
                  placeholder={
                    form.request_type === 'deduction'
                      ? 'اكتب سبب الخصم بوضوح (مثال: تأخر عن العمل ساعتين دون إذن، إهمال في عهدة السيارة، غياب بدون إذن...)'
                      : 'اكتب سبب طلب العامل أو طبيعة المأمورية...'
                  }
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              {/* Manager Notes Field */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  ملاحظات وتوصية مدير المخزن
                </label>
                <input
                  type="text"
                  value={form.manager_notes}
                  onChange={(e) => setForm({ ...form, manager_notes: e.target.value })}
                  placeholder="ملاحظات..."
                  className="w-full px-3.5 py-2 border border-amber-200 bg-amber-50/50 rounded-xl text-amber-900 font-bold"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting || (form.request_type === 'leave' && Number(form.quantity) > remainingLeaveDays)}
                  className={`w-full py-3 font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    form.request_type === 'deduction'
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {submitting ? 'جاري الإرسال...' : 
                     form.request_type === 'deduction' ? 'تأكيد ورفع طلب الخصم للإدارة العامة للاعتماد' :
                     'تأكيد وإرسال الطلب للإدارة العامة معتمد مبدئياً'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: WORKERS LEAVE BALANCES (أرصدة إجازات العمال بدون سلف) */}
        {activeTab === 'workers_balances' && (
          <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 space-y-5">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                    <Palmtree className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900">سجل أرصدة الإجازات السنوية للعمال والسائقين</h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  متابعة الرصيد المستحق والمستهلك والمتبقي من الإجازات السنوية لكل عامل وسائق بدقة
                </p>
              </div>

              <button
                onClick={loadData}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                تحديث الأرصدة
              </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <span className="text-xs font-bold text-slate-500 block">إجمالي العمال والسائقين</span>
                <p className="text-2xl font-black font-mono text-slate-800 mt-1">{balances.length} <span className="text-xs font-normal">عامل</span></p>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <span className="text-xs font-bold text-emerald-700 block">إجمالي الأيام المتبقية لجميع العمال</span>
                <p className="text-2xl font-black font-mono text-emerald-900 mt-1">
                  {balances.reduce((acc, b) => acc + (b.annual_leaves?.remaining_days || 0), 0)} <span className="text-xs font-normal">يوم</span>
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <span className="text-xs font-bold text-amber-700 block">عمال استنفدوا رصيد إجازاتهم</span>
                <p className="text-2xl font-black font-mono text-amber-900 mt-1">
                  {balances.filter(b => (b.annual_leaves?.remaining_days || 0) <= 0).length} <span className="text-xs font-normal">عامل</span>
                </p>
              </div>
            </div>

            {/* Filters & Search Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="بحث باسم العامل أو الكود أو الوظيفة..."
                  value={balanceSearch}
                  onChange={(e) => setBalanceSearch(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-emerald-500"
                />
              </div>

              {/* Job Title Filter */}
              <div>
                <select
                  value={balanceJobFilter}
                  onChange={(e) => setBalanceJobFilter(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 font-bold focus:bg-white"
                >
                  <option value="all">كل الوظائف ({jobTitlesList.length} وظيفة)</option>
                  {jobTitlesList.map((job, idx) => (
                    <option key={idx} value={job}>{job}</option>
                  ))}
                </select>
              </div>

              {/* Sort By */}
              <div>
                <select
                  value={balanceSortBy}
                  onChange={(e) => setBalanceSortBy(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 font-bold focus:bg-white"
                >
                  <option value="code_asc">ترتيب حسب كود العامل (تصاعدي)</option>
                  <option value="name_asc">ترتيب حسب الاسم (أبجدياً)</option>
                  <option value="remaining_desc">الرصيد المتبقي (من الأعلى للأقل)</option>
                  <option value="remaining_asc">الرصيد المتبقي (من الأقل للأعلى)</option>
                  <option value="job_title">ترتيب حسب الوظيفة</option>
                </select>
              </div>
            </div>

            {/* Workers Table without Loans */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
              <table className="w-full text-center border-collapse text-xs" dir="rtl">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-3 px-3 text-right">الموظف / العامل</th>
                    <th className="py-3 px-2">الكود</th>
                    <th className="py-3 px-3 text-right">الوظيفة</th>
                    <th className="py-3 px-2 bg-emerald-50 text-emerald-800">رصيد الإجازات المستحق</th>
                    <th className="py-3 px-2 bg-emerald-50 text-emerald-800">المستهلك</th>
                    <th className="py-3 px-3 bg-emerald-600 text-white font-black">المتبقي من الإجازات</th>
                    <th className="py-3 px-3 text-center">إجراءات سريعة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredBalances.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400 font-sans font-bold">
                        لا يوجد عمال يطابقون شروط البحث أو التصفية
                      </td>
                    </tr>
                  ) : (
                    filteredBalances.map(b => {
                      const rem = b.annual_leaves?.remaining_days || 0;
                      const isExhausted = rem <= 0;

                      return (
                        <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-3 font-sans font-bold text-right text-slate-900">
                            {b.name}
                          </td>
                          <td className="py-3 px-2 font-bold text-blue-700">{b.code}</td>
                          <td className="py-3 px-3 font-sans text-right">
                            <span className="inline-block px-2.5 py-0.5 bg-slate-100 text-slate-700 font-bold rounded-md text-[11px] border border-slate-200">
                              {b.job_title || 'عامل'}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-slate-700 font-bold">{b.annual_leaves?.total_entitlement || 21} يوم</td>
                          <td className="py-3 px-2 text-rose-600 font-bold">{b.annual_leaves?.used_days || 0} يوم</td>
                          <td className={`py-3 px-3 font-black text-sm ${
                            isExhausted ? 'text-rose-700 bg-rose-50/60' : 'text-emerald-900 bg-emerald-50/70'
                          }`}>
                            {rem} يوم
                          </td>
                          <td className="py-3 px-3 font-sans">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  setForm({
                                    employee_id: b.id,
                                    request_type: 'leave',
                                    title: '',
                                    date_from: new Date().toISOString().split('T')[0],
                                    date_to: new Date().toISOString().split('T')[0],
                                    quantity: Math.min(1, Math.max(0.5, rem)),
                                    details: '',
                                    manager_notes: 'معتمد وموصى به من مدير المخازن'
                                  });
                                  setActiveTab('new_request');
                                }}
                                disabled={isExhausted}
                                className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-900 rounded-lg font-bold text-[10px] transition-colors cursor-pointer"
                                title="تقديم طلب إجازة لهذا العامل"
                              >
                                + طلب إجازة
                              </button>

                              <button
                                onClick={() => {
                                  setForm({
                                    employee_id: b.id,
                                    request_type: 'deduction',
                                    title: '',
                                    date_from: new Date().toISOString().split('T')[0],
                                    date_to: new Date().toISOString().split('T')[0],
                                    quantity: 0.5,
                                    details: '',
                                    manager_notes: 'طلب خصم معتمد ومرفوع من مدير المخزن'
                                  });
                                  setActiveTab('new_request');
                                }}
                                className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-lg font-bold text-[10px] transition-colors cursor-pointer"
                                title="تسجيل خصم أو جزاء على العامل"
                              >
                                − تسجيل خصم
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: HISTORY OF APPROVED REQUESTS */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-base font-black text-slate-900">سجل الطلبات المعتمدة من مدير المخزن</h3>
            
            <div className="divide-y divide-slate-100 text-xs">
              {approvedByManager.length === 0 ? (
                <p className="text-center py-8 text-slate-400">لا توجد طلبات معتمدة سابقة</p>
              ) : (
                approvedByManager.map(req => (
                  <div key={req.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-700">[{req.employee_code}]</span>
                        <span className="font-bold text-slate-800">{req.employee_name}</span>
                        {req.request_type === 'deduction' ? (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">
                            خصم / جزاء
                          </span>
                        ) : req.request_type === 'leave' ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                            إجازة
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">({req.title})</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        البيان: <strong className="text-slate-800">{req.title}</strong> | 
                        التاريخ: {req.date_from} | المقدار: <strong className="font-mono">{req.quantity} {req.request_type === 'leave' || req.request_type === 'deduction' ? 'يوم' : 'ساعة'}</strong> | 
                        مقدم الطلب: <strong className="text-amber-800">{req.submitted_by?.includes('مدير المخزن') ? 'مدير المخزن بالنيابة' : 'العامل مباشرة'}</strong>
                      </p>
                    </div>

                    <div>
                      {req.status === 'approved' ? (
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-bold">
                          معتمد نهائياً من الإدارة ✓
                        </span>
                      ) : req.status === 'rejected' ? (
                        <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-lg font-bold">
                          مرفوض ✕
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg font-bold">
                          قيد اعتماد الإدارة العامة
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
