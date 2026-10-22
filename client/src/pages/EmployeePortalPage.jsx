import React, { useState, useEffect } from 'react';
import { 
  User, Palmtree, Clock, CreditCard, FileText, Send, 
  CheckCircle2, Clock3, XCircle, LogOut, Printer, Eye, 
  ChevronLeft, Sparkles, Building2, Shield, AlertCircle,
  Key, Lock, Phone, Banknote, Calendar, ChevronRight, HelpCircle,
  Smartphone, DownloadCloud, ArrowRight, RefreshCw, AlertTriangle
} from 'lucide-react';
import { fetchJson } from '../utils/api';
import PayslipModal from '../components/PayslipModal';

export default function EmployeePortalPage() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('portal_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Auth State
  const [loginStep, setLoginStep] = useState('code'); // 'code', 'pin', 'setup_pin'
  const [loginCode, setLoginCode] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [setupPin, setSetupPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [setupPhone, setSetupPhone] = useState('');
  const [pendingEmployee, setPendingEmployee] = useState(null);
  const [loginError, setLoginError] = useState(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // Portal Data
  const [portalData, setPortalData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Request Forms State
  const [activeModal, setActiveModal] = useState(null); // 'leave', 'overtime', 'loan', 'payslip_request'
  const [leaveForm, setLeaveForm] = useState({
    title: 'طلب إجازة سنوية',
    date_from: new Date().toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
    quantity: 1,
    details: ''
  });
  const [overtimeForm, setOvertimeForm] = useState({
    title: 'طلب احتساب أيام إضافية',
    date_from: new Date().toISOString().split('T')[0],
    quantity: 0.5,
    details: 'العمل لوردية مسائية لتغطية متطلبات الإنتاج'
  });
  const [loanForm, setLoanForm] = useState({
    amount: 5000,
    months_count: 10,
    details: 'سلفة لتغطية مصاريف طارئة والتزامات أسرية'
  });
  const [payslipRequestForm, setPayslipRequestForm] = useState({
    entity: 'البنك الأهلي المصري',
    details: 'لتقديمها لفتح حساب بنكي / استخراج بطاقة ائتمانية'
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Payslip viewing
  const [selectedPayslipItem, setSelectedPayslipItem] = useState(null);

  const loadPortalData = async (employeeId) => {
    try {
      setLoading(true);
      const data = await fetchJson(`/portal/summary/${employeeId}`);
      setPortalData(data);
    } catch (err) {
      console.error('Error loading portal data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadPortalData(currentUser.id);
    }
  }, [currentUser]);

  // Handle Step 1: Check Employee Code
  const handleCheckCode = async (e) => {
    if (e) e.preventDefault();
    if (!loginCode.trim()) {
      setLoginError('يرجى إدخال كود الموظف أو رقم الموبايل');
      return;
    }

    try {
      setLoggingIn(true);
      setLoginError(null);
      const res = await fetchJson('/portal/login', {
        method: 'POST',
        body: JSON.stringify({ code: loginCode.trim() })
      });

      if (res.needPinSetup) {
        setPendingEmployee(res.employee);
        setSetupPhone(res.employee.phone || '');
        setLoginStep('setup_pin');
      } else if (res.needPin) {
        setPendingEmployee(res.employee);
        setLoginStep('pin');
      } else if (res.success && res.employee) {
        setCurrentUser(res.employee);
        localStorage.setItem('portal_user', JSON.stringify(res.employee));
      }
    } catch (err) {
      setLoginError(err.message || 'خطأ في التحقق من كود الموظف');
    } finally {
      setLoggingIn(false);
    }
  };

  // Handle Step 2: Login with PIN
  const handlePinLogin = async (e) => {
    if (e) e.preventDefault();
    if (!loginPin || loginPin.length < 4) {
      setLoginError('يرجى إدخال رمز الـ PIN المكون من 4 أرقام');
      return;
    }

    try {
      setLoggingIn(true);
      setLoginError(null);
      const res = await fetchJson('/portal/login', {
        method: 'POST',
        body: JSON.stringify({
          code: pendingEmployee ? pendingEmployee.code : loginCode.trim(),
          pin: loginPin.trim()
        })
      });

      if (res.success && res.employee) {
        setCurrentUser(res.employee);
        localStorage.setItem('portal_user', JSON.stringify(res.employee));
      } else {
        setLoginError(res.error || 'رمز الـ PIN غير صحيح');
      }
    } catch (err) {
      setLoginError(err.message || 'رمز المرور السري (PIN) غير صحيح');
    } finally {
      setLoggingIn(false);
    }
  };

  // Handle Step 3: First-time PIN Setup
  const handleSetupPin = async (e) => {
    if (e) e.preventDefault();
    if (!setupPin || setupPin.length !== 4) {
      setLoginError('رمز الـ PIN يجب أن يكون من 4 أرقام بالضبط');
      return;
    }
    if (setupPin !== confirmPin) {
      setLoginError('رمز الـ PIN وتأكيده غير متطابقين');
      return;
    }

    try {
      setLoggingIn(true);
      setLoginError(null);
      const res = await fetchJson('/portal/setup-pin', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: pendingEmployee.id,
          pin_code: setupPin.trim(),
          phone: setupPhone.trim()
        })
      });

      if (res.success && res.employee) {
        setCurrentUser(res.employee);
        localStorage.setItem('portal_user', JSON.stringify(res.employee));
      }
    } catch (err) {
      setLoginError(err.message || 'خطأ في حفظ رمز المرور');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setPortalData(null);
    setLoginStep('code');
    setLoginCode('');
    setLoginPin('');
    setPendingEmployee(null);
    localStorage.removeItem('portal_user');
  };

  const handleQuickLogin = (code) => {
    setLoginCode(code);
    setLoggingIn(true);
    setLoginError(null);
    fetchJson('/portal/login', {
      method: 'POST',
      body: JSON.stringify({ code })
    }).then(res => {
      if (res.needPinSetup) {
        setPendingEmployee(res.employee);
        setSetupPhone(res.employee.phone || '');
        setLoginStep('setup_pin');
      } else if (res.needPin) {
        setPendingEmployee(res.employee);
        setLoginStep('pin');
      } else if (res.success && res.employee) {
        setCurrentUser(res.employee);
        localStorage.setItem('portal_user', JSON.stringify(res.employee));
      }
    }).catch(err => {
      setLoginError(err.message);
    }).finally(() => {
      setLoggingIn(false);
    });
  };

  // Submit Leave Request
  const handleSubmitLeaveRequest = async (e) => {
    e.preventDefault();
    const remainingBal = portalData?.leaves?.remaining_balance ?? 0;
    if (Number(leaveForm.quantity) > remainingBal) {
      alert(`لا يمكن تقديم طلب إجازة (${leaveForm.quantity} يوم) يتجاوز رصيد إجازاتك السنوية المتبقي (${remainingBal} يوم).`);
      return;
    }

    try {
      setSubmitting(true);
      await fetchJson('/portal/requests', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: currentUser.id,
          request_type: 'leave',
          title: leaveForm.title,
          date_from: leaveForm.date_from,
          date_to: leaveForm.date_to,
          quantity: leaveForm.quantity,
          details: leaveForm.details
        })
      });
      setActiveModal(null);
      setSuccessMessage('تم إرسال طلب الإجازة بنجاح للمراجعة والاعتماد!');
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 4000);
      loadPortalData(currentUser.id);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Overtime Request
  const handleSubmitOvertimeRequest = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await fetchJson('/portal/requests', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: currentUser.id,
          request_type: 'overtime',
          title: overtimeForm.title,
          date_from: overtimeForm.date_from,
          date_to: overtimeForm.date_from,
          quantity: overtimeForm.quantity,
          details: overtimeForm.details
        })
      });
      setActiveModal(null);
      setSuccessMessage('تم إرسال طلب احتساب الإضافي بنجاح للإدارة!');
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 4000);
      loadPortalData(currentUser.id);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Loan Request (Administrative info only - does not affect treasury until physically disbursed)
  const handleSubmitLoanRequest = async (e) => {
    e.preventDefault();
    const amount = Number(loanForm.amount) || 0;
    if (amount <= 0) {
      alert('يرجى إدخال مبلغ سلفة صحيح');
      return;
    }

    try {
      setSubmitting(true);
      await fetchJson('/portal/requests', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: currentUser.id,
          request_type: 'loan',
          title: `طلب سلفة طويلة الأجل بقيمة ${amount.toLocaleString()} ج.م`,
          quantity: amount,
          details: `أشهر السداد المقترحة: ${loanForm.months_count} شهر | القسط التقديري: ${(amount / (Number(loanForm.months_count) || 1)).toFixed(0)} ج.م/شهر | السبب: ${loanForm.details}`
        })
      });
      setActiveModal(null);
      setSuccessMessage('تم تقديم طلب السلفة للإدارة للعلم والمراجعة. سيتم تفعيل السلفة في حسابك فور صرفها لك من الخزينة الرئيسية.');
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 5000);
      loadPortalData(currentUser.id);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Payslip / Salary Statement Request
  const handleSubmitPayslipRequest = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await fetchJson('/portal/requests', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: currentUser.id,
          request_type: 'payslip_request',
          title: `طلب بيان مفردات مرتب موجه إلى: ${payslipRequestForm.entity}`,
          quantity: 1,
          details: payslipRequestForm.details
        })
      });
      setActiveModal(null);
      setSuccessMessage('تم إرسال طلب بيان مفردات المرتب بنجاح! سيتم إخطارك عند تجهيز الشهادة المعتمدة من HR.');
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 4000);
      loadPortalData(currentUser.id);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------ LOGIN SCREEN (PWA / Mobile Native Feel) ------------------
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 font-['Cairo',sans-serif] text-slate-100">
        <div className="w-full max-w-md bg-slate-800/95 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-700/80 space-y-6">
          
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-2xl flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20 border border-emerald-400/30">
              <User className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-white">بوابة الخدمة الذاتية للموظف</h1>
            <p className="text-xs text-slate-400">
              متابعة كشوف المرتبات، رصيد الإجازات، السلف، المصروفات، وتقديم الطلبات
            </p>
          </div>

          {/* Error Message */}
          {loginError && (
            <div className="p-3 bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{loginError}</span>
            </div>
          )}

          {/* STEP 1: ENTER CODE */}
          {loginStep === 'code' && (
            <form onSubmit={handleCheckCode} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  كود الموظف أو رقم الموبايل
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="مثال: 1001 أو 326 أو 010xxxxxxxx"
                    value={loginCode}
                    onChange={(e) => setLoginCode(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-center font-mono text-lg font-bold tracking-wider"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black rounded-2xl shadow-lg shadow-emerald-500/20 transition-all text-sm flex items-center justify-center gap-2"
              >
                <span>{loggingIn ? 'جاري التحقق...' : 'متابعة الدخول'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* STEP 2: ENTER PIN */}
          {loginStep === 'pin' && (
            <form onSubmit={handlePinLogin} className="space-y-4 text-sm">
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700/60 text-center">
                <span className="text-xs text-slate-400 block">مرحباً بك:</span>
                <span className="text-sm font-bold text-emerald-400 block">{pendingEmployee?.name}</span>
                <span className="text-[11px] text-slate-400 font-mono">كود: {pendingEmployee?.code}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 text-center">
                  أدخل رمز المرور السري (PIN المكون من 4 أرقام)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  autoFocus
                  placeholder="••••"
                  value={loginPin}
                  onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-center font-mono text-2xl font-bold tracking-widest"
                />
              </div>

              <button
                type="submit"
                disabled={loggingIn || loginPin.length < 4}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-40 text-slate-950 font-black rounded-2xl shadow-lg transition-all text-sm flex items-center justify-center gap-2"
              >
                <span>{loggingIn ? 'جاري التحقق...' : 'دخول إلى حسابي'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-between text-xs pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setLoginStep('code');
                    setLoginPin('');
                  }}
                  className="text-slate-400 hover:text-slate-200"
                >
                  ← تغيير الكود
                </button>
                <span className="text-[11px] text-slate-500" title="في حال نسيان الـ PIN، اطلب من شؤون العاملين تصفير الرمز">
                  نسيت رمز الـ PIN؟ راجع الإدارة
                </span>
              </div>
            </form>
          )}

          {/* STEP 3: FIRST-TIME PIN SETUP */}
          {loginStep === 'setup_pin' && (
            <form onSubmit={handleSetupPin} className="space-y-4 text-xs">
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 text-center space-y-1">
                <Sparkles className="w-5 h-5 mx-auto text-emerald-400" />
                <h3 className="font-bold text-sm text-white">إنشاء رمز سري (PIN) لأول مرة</h3>
                <p className="text-[11px] text-emerald-200/80">
                  مرحباً بك يا <span className="font-bold underline">{pendingEmployee?.name}</span>! يرجى إنشاء رمز سري من 4 أرقام لحماية حسابك والدخول السريع.
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
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-center font-mono text-lg font-bold tracking-widest focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">تأكيد الرمز السري (أعد كتابته)</label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  placeholder="أعد إدخال الـ 4 أرقام"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-center font-mono text-lg font-bold tracking-widest focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">رقم الموبايل (لتثبيته بحسابك)</label>
                <input
                  type="tel"
                  placeholder="010xxxxxxxx"
                  value={setupPhone}
                  onChange={(e) => setSetupPhone(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={loggingIn || setupPin.length !== 4 || setupPin !== confirmPin}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-slate-950 font-black rounded-2xl shadow-lg transition-all text-sm flex items-center justify-center gap-2"
              >
                <span>{loggingIn ? 'جاري الحفظ...' : 'حفظ رمز PIN والدخول'}</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setLoginStep('code')}
                className="w-full text-center text-slate-400 hover:text-slate-200 text-xs py-1"
              >
                ← إلغاء والرجوع للخلف
              </button>
            </form>
          )}

        </div>
      </div>
    );
  }

  // ------------------ LOGGED-IN EMPLOYEE VIEW ------------------
  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-16 font-['Cairo',sans-serif]">
      
      {/* Employee Mobile Profile Card */}
      <div className="bg-gradient-to-br from-slate-900 via-teal-950 to-emerald-950 text-white p-5 md:p-6 rounded-3xl shadow-xl relative overflow-hidden border border-emerald-900/40">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-teal-500/20 rounded-full blur-2xl"></div>

        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-xl font-bold font-mono text-emerald-300 shadow-inner">
              {currentUser.code}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="text-xs px-2 py-0.5 bg-emerald-500/30 text-emerald-200 rounded-md border border-emerald-400/30">
                  {currentUser.department}
                </span>
                <span className="text-xs text-slate-300">| {currentUser.job_title}</span>
              </div>
              <h2 className="text-lg md:text-xl font-bold">{currentUser.name}</h2>
              <div className="flex items-center gap-3 text-[11px] text-slate-300 font-mono mt-0.5">
                <span>الرقم القومي: {currentUser.national_id || '-'}</span>
                {currentUser.phone && <span>| الهاتف: {currentUser.phone}</span>}
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-all shrink-0"
            title="تسجيل خروج"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">خروج</span>
          </button>
        </div>
      </div>

      {/* Success notification */}
      {submitSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-2 text-xs md:text-sm shadow-xs animate-in fade-in duration-300">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* 3 Main Stat Cards */}
      {portalData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 1. Remaining Leaves */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500">رصيد الإجازات السنوية</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <Palmtree className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xl sm:text-2xl font-black font-mono text-emerald-700 break-all">
                {portalData.leaves.remaining_balance}
              </span>
              <span className="text-xs font-semibold text-slate-400">يوم متبقي</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex justify-between">
              <span>الرصيد الكلي: {portalData.leaves.total_balance} يوم</span>
              <span>المستخدم: {portalData.leaves.taken_days}</span>
            </div>
          </div>

          {/* 2. Remaining Loans */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500">المتبقي من السلف</span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xl sm:text-2xl font-black font-mono text-indigo-700 break-all">
                {portalData.loans.total_remaining.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-slate-400">ج.م متبقي</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex justify-between">
              <span>القسط الشهري:</span>
              <span className="font-mono font-bold text-indigo-900">{portalData.loans.monthly_installment.toLocaleString()} ج.م</span>
            </div>
          </div>

          {/* 3. Latest Net Pay */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500">آخر صافي مرتب</span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xl sm:text-2xl font-black font-mono text-slate-900 break-all">
                {portalData.latest_payslip ? portalData.latest_payslip.net_salary.toLocaleString() : '0'}
              </span>
              <span className="text-xs font-semibold text-slate-400">ج.م</span>
            </div>
            <div className="mt-2 text-[11px] text-blue-600 flex justify-between items-center">
              <span>{portalData.latest_payslip ? portalData.latest_payslip.run_title : 'لا يوجد'}</span>
              {portalData.latest_payslip && (
                <button
                  onClick={() => setSelectedPayslipItem(portalData.latest_payslip)}
                  className="underline hover:text-blue-800 font-bold"
                >
                  معاينة الكشف
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4 Quick Action Buttons */}
      <div className="space-y-1.5">
        <h3 className="text-xs font-bold text-slate-500 px-1">تقديم الطلبات السريعة:</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {/* 1. Leave */}
          <button
            onClick={() => setActiveModal('leave')}
            className="flex flex-col items-center justify-center gap-1.5 p-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-md shadow-emerald-600/20 transition-all text-xs"
          >
            <Palmtree className="w-5 h-5 shrink-0" />
            <span>طلب إجازة</span>
          </button>

          {/* 2. Overtime */}
          <button
            onClick={() => setActiveModal('overtime')}
            className="flex flex-col items-center justify-center gap-1.5 p-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-md shadow-blue-600/20 transition-all text-xs"
          >
            <Clock className="w-5 h-5 shrink-0" />
            <span>احتساب إضافي</span>
          </button>

          {/* 3. Long Term Loan */}
          <button
            onClick={() => setActiveModal('loan')}
            className="flex flex-col items-center justify-center gap-1.5 p-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-md shadow-indigo-600/20 transition-all text-xs"
          >
            <CreditCard className="w-5 h-5 shrink-0" />
            <span>طلب سلفة طويلة</span>
          </button>

          {/* 4. Payslip Statement */}
          <button
            onClick={() => setActiveModal('payslip_request')}
            className="flex flex-col items-center justify-center gap-1.5 p-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-bold shadow-md shadow-amber-600/20 transition-all text-xs"
          >
            <FileText className="w-5 h-5 shrink-0" />
            <span>طلب مفردات مرتب</span>
          </button>
        </div>
      </div>

      {/* Mid-Month Cash Expenses Received (Day 10 & 20 from Treasury) */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
              <Banknote className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">سجل المصروفات النقدية المستلمة (يوم 10 ويوم 20)</h3>
              <p className="text-[11px] text-slate-400">المصروفات النقدية المسجلة والمنصرفة لك فعلياً من الخزينة الرئيسية</p>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg font-mono">
            {portalData?.mid_month_expenses?.length || 0} شهر
          </span>
        </div>

        {!portalData?.mid_month_expenses || portalData.mid_month_expenses.length === 0 ? (
          <p className="text-center py-6 text-xs text-slate-400">لا توجد مصروفات نقدية مسجلة حتى الآن</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {portalData.mid_month_expenses.map((exp) => (
              <div key={exp.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800 block text-sm">
                    شهر {exp.month} / {exp.year}
                  </span>
                  <div className="flex items-center gap-3 text-slate-500 text-[11px] mt-0.5">
                    <span>مصروف يوم 10: <strong className="font-mono text-slate-700">{exp.amount_day_10?.toLocaleString() || 0}</strong> ج.م</span>
                    <span>|</span>
                    <span>مصروف يوم 20: <strong className="font-mono text-slate-700">{exp.amount_day_20?.toLocaleString() || 0}</strong> ج.م</span>
                  </div>
                  {exp.notes && <p className="text-slate-400 text-[10px] mt-0.5">ملاحظات: {exp.notes}</p>}
                </div>

                <div className="text-left font-mono">
                  <span className="font-bold text-amber-700 text-sm block">
                    {exp.total_amount?.toLocaleString() || 0} ج.م
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> تم الصرف من الخزينة
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Loans Disbursed */}
      {portalData?.loans?.active_loans && portalData.loans.active_loans.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">السلف طويلة الأجل النشطة (المصروفة فعلياً)</h3>
                <p className="text-[11px] text-slate-400">تُخصم أقساطها الشهرية تلقائياً من مفردات المرتب</p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {portalData.loans.active_loans.map((loan) => (
              <div key={loan.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800 block text-sm">
                    سلفة بقيمة {loan.total_amount?.toLocaleString()} ج.م
                  </span>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    المدة: {loan.months_count} شهر | القسط الشهري: <strong className="font-mono text-indigo-800">{loan.monthly_installment?.toLocaleString()} ج.م</strong>
                  </p>
                  <p className="text-slate-400 text-[10px] mt-0.5">
                    الأقساط المسددة: {loan.paid_installments || 0} من {loan.months_count} شهر
                  </p>
                </div>

                <div className="text-left font-mono">
                  <span className="font-bold text-indigo-700 text-sm block">
                    المتبقي: {loan.remaining_amount?.toLocaleString()} ج.م
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    فترة السداد: {loan.start_date} إلى {loan.end_date}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Requests History */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-3">
        <h3 className="font-bold text-slate-800 text-sm flex items-center justify-between">
          <span>طلباتي المقدمة ومتابعة حالتها</span>
          <span className="text-xs text-slate-400 font-normal">
            ({portalData?.requests?.length || 0} طلب)
          </span>
        </h3>

        {!portalData?.requests || portalData.requests.length === 0 ? (
          <p className="text-center py-6 text-xs text-slate-400">لم تقم بتقديم أي طلبات حتى الآن</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {portalData.requests.map((req) => (
              <div key={req.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-slate-800 text-sm">{req.title}</span>
                    <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                      {req.request_type === 'leave' && 'إجازة'}
                      {req.request_type === 'overtime' && 'عمل إضافي'}
                      {req.request_type === 'loan' && 'سلفة طويلة'}
                      {req.request_type === 'payslip_request' && 'مفردات مرتب'}
                    </span>
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    التاريخ: {req.date_from || '-'} | المقدار: {req.quantity} {req.request_type === 'leave' ? 'أيام' : (req.request_type === 'loan' ? 'ج.م' : '')}
                  </p>
                  {req.details && <p className="text-slate-400 text-[11px] mt-0.5">{req.details}</p>}
                </div>

                <div>
                  {req.status === 'pending' || req.status === 'pending_manager' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 font-bold rounded-lg border border-amber-200">
                      <Clock3 className="w-3.5 h-3.5" /> قيد المراجعة
                    </span>
                  ) : null}
                  {req.status === 'approved' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-lg border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" /> معتمد ومقبول
                    </span>
                  )}
                  {req.status === 'rejected' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 font-bold rounded-lg border border-rose-200">
                      <XCircle className="w-3.5 h-3.5" /> مرفوض
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Payslips Archive (VIEW ONLY - PRINTING CANCELLED) */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">أرشيف كشوف الرواتب الشهرية السابقة</h3>
          <span className="text-[11px] text-slate-400">للاطلاع والمعاينة فقط (الطباعة غير مسموحة)</span>
        </div>

        {!portalData?.payslips_history || portalData.payslips_history.length === 0 ? (
          <p className="text-center py-6 text-xs text-slate-400">لا توجد كشوف مرتبات محفوظة بعد</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {portalData.payslips_history.map((slip) => (
              <div key={slip.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <h4 className="font-bold text-slate-800">{slip.run_title}</h4>
                  <p className="text-slate-400 text-[11px]">تاريخ الكشف: {slip.payroll_date}</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-left font-mono">
                    <span className="font-bold text-emerald-700 text-sm block">
                      {slip.net_salary.toLocaleString()} ج.م
                    </span>
                    <span className="text-[10px] text-slate-400">صافي المرتب</span>
                  </div>

                  <button
                    onClick={() => setSelectedPayslipItem(slip)}
                    className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors flex items-center gap-1 font-bold text-xs"
                    title="اطلاع ومعاينة فقط (للعلم)"
                  >
                    <Eye className="w-4 h-4" />
                    <span className="hidden sm:inline">معاينة</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ------------------ MODALS ------------------ */}

      {/* 1. Submit Leave Request Modal */}
      {activeModal === 'leave' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">تقديم طلب إجازة</h2>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitLeaveRequest} className="p-5 space-y-4 text-xs">
              {/* Remaining Leaves Display */}
              <div className="p-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Palmtree className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold text-slate-700">رصيد إجازاتك السنوية المتبقي:</span>
                </div>
                <span className="font-mono font-black text-emerald-800 text-sm">
                  {portalData?.leaves?.remaining_balance ?? 0} يوم
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">نوع الإجازة</label>
                <input
                  type="text"
                  required
                  value={leaveForm.title}
                  onChange={(e) => setLeaveForm({ ...leaveForm, title: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">من تاريخ</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.date_from}
                    onChange={(e) => setLeaveForm({ ...leaveForm, date_from: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">إلى تاريخ</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.date_to}
                    onChange={(e) => setLeaveForm({ ...leaveForm, date_to: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  عدد الأيام المطلوبة (الحد الأقصى: {portalData?.leaves?.remaining_balance ?? 0} يوم)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max={portalData?.leaves?.remaining_balance ?? 0}
                  required
                  value={leaveForm.quantity}
                  onChange={(e) => setLeaveForm({ ...leaveForm, quantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl font-bold"
                />
              </div>

              {Number(leaveForm.quantity) > (portalData?.leaves?.remaining_balance ?? 0) && (
                <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>عذراً: عدد الأيام المطلوبة يتجاوز رصيد إجازاتك المتبقي ({portalData?.leaves?.remaining_balance ?? 0} يوم).</span>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">سبب الإجازة</label>
                <textarea
                  rows="2"
                  value={leaveForm.details}
                  onChange={(e) => setLeaveForm({ ...leaveForm, details: e.target.value })}
                  placeholder="ظروف عائلية، راحة..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting || Number(leaveForm.quantity) > (portalData?.leaves?.remaining_balance ?? 0)}
                  className="px-5 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs"
                >
                  {submitting ? 'جاري الإرسال...' : 'إرسال الطلب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Submit Overtime Request Modal */}
      {activeModal === 'overtime' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">تقديم طلب احتساب إضافي</h2>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitOvertimeRequest} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">موضوع الطلب</label>
                <input
                  type="text"
                  required
                  value={overtimeForm.title}
                  onChange={(e) => setOvertimeForm({ ...overtimeForm, title: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">تاريخ اليوم</label>
                  <input
                    type="date"
                    required
                    value={overtimeForm.date_from}
                    onChange={(e) => setOvertimeForm({ ...overtimeForm, date_from: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    أيام الإضافي (أقل قيمة 0.5 يوم) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    placeholder="0.5 أو 1 أو 1.5 أو 2"
                    value={overtimeForm.quantity}
                    onChange={(e) => setOvertimeForm({ ...overtimeForm, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">تفاصيل العمل الإضافي المنجز</label>
                <textarea
                  rows="2"
                  value={overtimeForm.details}
                  onChange={(e) => setOvertimeForm({ ...overtimeForm, details: e.target.value })}
                  placeholder="شرح المهام الإضافية التي تم إنجازها..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs"
                >
                  {submitting ? 'جاري الإرسال...' : 'إرسال طلب الإضافي'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Submit Loan Request Modal */}
      {activeModal === 'loan' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                  <CreditCard className="w-5 h-5" />
                </div>
                <h2 className="text-base font-bold text-slate-800">تقديم طلب سلفة طويلة الأجل</h2>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitLoanRequest} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-indigo-50/80 border border-indigo-200/80 rounded-2xl text-[11px] text-indigo-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>تنبيه هام حول السلف:</span>
                </p>
                <p className="leading-relaxed text-indigo-800">
                  الموافقة على هذا الطلب هي موافقة إدارية مبدئية فقط (للعلم)، ولا تخصم من الخزينة تلقائياً. يتم قيد السلفة وتفعيل خصم أقساطها في حسابك فور صرف المبلغ لك نقدياً من الخزينة الرئيسية.
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">المبلغ المطلوب (ج.م) *</label>
                <input
                  type="number"
                  step="500"
                  min="500"
                  required
                  placeholder="مثال: 5000"
                  value={loanForm.amount}
                  onChange={(e) => setLoanForm({ ...loanForm, amount: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 font-mono text-lg font-bold border border-slate-200 rounded-xl focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  عدد أشهر السداد المقترحة (الأقساط)
                </label>
                <select
                  value={loanForm.months_count}
                  onChange={(e) => setLoanForm({ ...loanForm, months_count: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl font-bold bg-white"
                >
                  <option value={3}>3 أشهر (قسط: {(loanForm.amount / 3).toFixed(0)} ج.م/شهر)</option>
                  <option value={6}>6 أشهر (قسط: {(loanForm.amount / 6).toFixed(0)} ج.م/شهر)</option>
                  <option value={10}>10 أشهر (قسط: {(loanForm.amount / 10).toFixed(0)} ج.م/شهر)</option>
                  <option value={12}>12 شهراً (قسط: {(loanForm.amount / 12).toFixed(0)} ج.م/شهر)</option>
                  <option value={18}>18 شهراً (قسط: {(loanForm.amount / 18).toFixed(0)} ج.م/شهر)</option>
                  <option value={24}>24 شهراً (قسط: {(loanForm.amount / 24).toFixed(0)} ج.م/شهر)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">سبب طلب السلفة</label>
                <textarea
                  rows="2"
                  value={loanForm.details}
                  onChange={(e) => setLoanForm({ ...loanForm, details: e.target.value })}
                  placeholder="ظروف عائلية، مصاريف علاج، تجهيزات..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
                >
                  {submitting ? 'جاري الإرسال...' : 'إرسال طلب السلفة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Submit Payslip Statement Request Modal */}
      {activeModal === 'payslip_request' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
                  <FileText className="w-5 h-5" />
                </div>
                <h2 className="text-base font-bold text-slate-800">طلب شهادة / بيان مفردات مرتب</h2>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayslipRequest} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  الجهة المطلوب توجيه الخطاب إليها *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: البنك الأهلي المصري، بنك مصر، المرور، التأشيرات..."
                  value={payslipRequestForm.entity}
                  onChange={(e) => setPayslipRequestForm({ ...payslipRequestForm, entity: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  الغرض من الشهادة وتفاصيل إضافية
                </label>
                <textarea
                  rows="3"
                  value={payslipRequestForm.details}
                  onChange={(e) => setPayslipRequestForm({ ...payslipRequestForm, details: e.target.value })}
                  placeholder="مثال: لفتح حساب بنكي، قرض بنكي، استخراج فيزا، تجديد بطاقة..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs"
                >
                  {submitting ? 'جاري الإرسال...' : 'إرسال طلب الشهادة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payslip Viewer Modal (NO PRINT ALLOWED) */}
      {selectedPayslipItem && (
        <PayslipModal
          item={selectedPayslipItem}
          run={{
            title: selectedPayslipItem.run_title,
            payroll_date: selectedPayslipItem.payroll_date
          }}
          allowPrint={false}
          onClose={() => setSelectedPayslipItem(null)}
        />
      )}
    </div>
  );
}