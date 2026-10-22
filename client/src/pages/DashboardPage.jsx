import React, { useState, useEffect } from 'react';
import { 
  Users, Calculator, CreditCard, Palmtree, DollarSign, 
  CalendarCheck, ArrowUpRight, TrendingUp, Inbox, ShieldCheck, 
  ChevronLeft, Sparkles, Building2, FileSpreadsheet, Copy, Check,
  ExternalLink, MessageCircle, Smartphone, Share2
} from 'lucide-react';
import { fetchJson } from '../utils/api';

export default function DashboardPage({ setActiveTab }) {
  const [stats, setStats] = useState({
    employeesCount: 0,
    departmentsCount: 0,
    activeLoansCount: 0,
    totalLoansRemaining: 0,
    pendingRequestsCount: 0,
    latestPayrollNet: 0,
    expensesTotal: 0
  });
  const [loading, setLoading] = useState(true);
  const [copiedPortal, setCopiedPortal] = useState(false);
  const [copiedWarehouse, setCopiedWarehouse] = useState(false);

  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/portal` : '';
  const warehouseUrl = typeof window !== 'undefined' ? `${window.location.origin}/warehouse-portal` : '';

  const handleCopy = (url, type) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
    if (type === 'portal') {
      setCopiedPortal(true);
      setTimeout(() => setCopiedPortal(false), 2500);
    } else {
      setCopiedWarehouse(true);
      setTimeout(() => setCopiedWarehouse(false), 2500);
    }
  };

  useEffect(() => {
    async function loadStats() {
      try {
        const [emps, loans, requests, runs, expenses] = await Promise.all([
          fetchJson('/employees'),
          fetchJson('/loans?status=active'),
          fetchJson('/requests?status=pending'),
          fetchJson('/payroll/runs'),
          fetchJson('/expenses?year=2026&month=10')
        ]);

        const depts = new Set(emps.map(e => e.department));
        const remLoans = loans.reduce((s, l) => s + l.remaining_amount, 0);

        let latestNet = 0;
        if (runs.length > 0) {
          const runDetails = await fetchJson(`/payroll/runs/${runs[0].id}`);
          latestNet = runDetails.summary?.totalNet || 0;
        }

        setStats({
          employeesCount: emps.length,
          departmentsCount: depts.size,
          activeLoansCount: loans.length,
          totalLoansRemaining: remLoans,
          pendingRequestsCount: requests.length,
          latestPayrollNet: latestNet,
          expensesTotal: expenses.grandTotal || 0
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white p-5 md:p-8 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-white/20 backdrop-blur-md text-white text-xs font-bold rounded-lg">
              نظام إدارة المرتبات الذكي
            </span>
            <span className="text-xs text-blue-200">سحابي ومحلي متكامل</span>
          </div>
          <h1 className="text-xl md:text-3xl font-black mb-2">
            مرحباً بك في نظام مرتبات عمال وسائقين عرابي
          </h1>
          <p className="text-xs md:text-sm text-blue-100 leading-relaxed">
            منظومة متكاملة لحساب المرتبات، الإضافي، الغياب، التأمينات، ضريبة كسب العمل، 
            مصروفات يوم 10 و 20، وسلف الأقساط، مع بوابات تفاعلية للموظفين ومديري المخازن تعمل على الموبايل كـ App.
          </p>

          <div className="flex flex-wrap items-center gap-2.5 mt-5">
            <button
              onClick={() => setActiveTab('payroll')}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-blue-800 text-xs md:text-sm font-bold rounded-xl shadow-xs hover:bg-blue-50 transition-all cursor-pointer"
            >
              <Calculator className="w-4 h-4" />
              <span>الرواتب الشهرية</span>
            </button>

            <button
              onClick={() => setActiveTab('portal')}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/30 text-white text-xs md:text-sm font-bold rounded-xl border border-white/20 hover:bg-blue-500/40 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>تجربة بوابة الموظف</span>
            </button>

            <button
              onClick={() => setActiveTab('warehouse')}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/30 text-white text-xs md:text-sm font-bold rounded-xl border border-white/20 hover:bg-amber-500/40 transition-all cursor-pointer"
            >
              <Building2 className="w-4 h-4 text-amber-300" />
              <span>بوابة مدير المخازن</span>
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════ PORTAL SHARING & DIRECT LINKS (نسخ ومشاركة الروابط) ══════════════════ */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-sm md:text-base">روابط بوابات الموبايل للموظفين والمخازن</h3>
              <p className="text-[11px] text-slate-500">انسخ الرابط وأرسله للموظف أو مدير المخزن ليفتحه من موبايله كـ تطبيق فوري</p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold">
            الرابط السحابي نشط الآن ⚡
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Employee Portal Link */}
          <div className="p-4 bg-gradient-to-br from-blue-50/60 to-indigo-50/40 rounded-2xl border border-blue-200/80 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">بوابة الموظف (Employee Portal)</h4>
                  <p className="text-[11px] text-slate-500">لتقديم الإجازات، السلف، وبيان مفردات المرتب</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-blue-200 flex items-center justify-between gap-2">
              <code className="text-xs text-blue-900 font-mono font-bold truncate dir-ltr select-all">
                {portalUrl}
              </code>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={() => handleCopy(portalUrl, 'portal')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs ${
                  copiedPortal
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {copiedPortal ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedPortal ? 'تم نسخ الرابط بنجاح ✓' : 'نسخ رابط بوابة الموظف'}</span>
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(`رابط بوابة الموظفين لطلب الإجازات والسلف ومتابعة الراتب:\n${portalUrl}`)}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                title="مشاركة الرابط عبر واتساب"
              >
                <MessageCircle className="w-4 h-4" />
                <span>واتساب</span>
              </a>

              <a
                href={portalUrl}
                target="_blank"
                rel="noreferrer"
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                title="فتح البوابة في نافذة جديدة"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Card 2: Warehouse Portal Link */}
          <div className="p-4 bg-gradient-to-br from-amber-50/60 to-orange-50/40 rounded-2xl border border-amber-200/80 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">بوابة مدير المخازن والفروع</h4>
                  <p className="text-[11px] text-slate-500">لمراجعة العمال واعتماد الخصومات وطلبات الإجازات</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-amber-200 flex items-center justify-between gap-2">
              <code className="text-xs text-amber-950 font-mono font-bold truncate dir-ltr select-all">
                {warehouseUrl}
              </code>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={() => handleCopy(warehouseUrl, 'warehouse')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs ${
                  copiedWarehouse
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-600 hover:bg-amber-700 text-white'
                }`}
              >
                {copiedWarehouse ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedWarehouse ? 'تم نسخ الرابط بنجاح ✓' : 'نسخ رابط بوابة مدير المخازن'}</span>
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(`رابط بوابة مسؤولي المخازن والفروع:\n${warehouseUrl}`)}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                title="مشاركة الرابط عبر واتساب"
              >
                <MessageCircle className="w-4 h-4" />
                <span>واتساب</span>
              </a>

              <a
                href={warehouseUrl}
                target="_blank"
                rel="noreferrer"
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                title="فتح البوابة في نافذة جديدة"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Main KPI Stats Grid (Fully responsive without text overflowing on mobile) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Employees */}
        <div 
          onClick={() => setActiveTab('employees')}
          className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 cursor-pointer transition-all overflow-hidden"
        >
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500 truncate">إجمالي الموظفين</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl shrink-0">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl md:text-3xl font-black font-mono text-slate-900 truncate">
            {stats.employeesCount}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1 truncate">{stats.departmentsCount} أقسام وإدارات</p>
        </div>

        {/* Latest Payroll */}
        <div 
          onClick={() => setActiveTab('payroll')}
          className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-emerald-200 cursor-pointer transition-all overflow-hidden"
        >
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500 truncate">صافي آخر مرتبات</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
              <Calculator className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-lg sm:text-xl md:text-2xl font-black font-mono text-emerald-700 truncate" title={`${stats.latestPayrollNet.toLocaleString()} ج.م`}>
            {stats.latestPayrollNet.toLocaleString()} <span className="text-[10px] sm:text-xs font-sans text-slate-400">ج.م</span>
          </p>
          <p className="text-[10px] sm:text-[11px] text-emerald-600 mt-1 truncate">كشف معتمد بالكامل</p>
        </div>

        {/* Mid-Month Expenses */}
        <div 
          onClick={() => setActiveTab('expenses')}
          className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-amber-200 cursor-pointer transition-all overflow-hidden"
        >
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500 truncate">مصروفات 10 و 20</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl shrink-0">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-lg sm:text-xl md:text-2xl font-black font-mono text-amber-700 truncate" title={`${stats.expensesTotal.toLocaleString()} ج.م`}>
            {stats.expensesTotal.toLocaleString()} <span className="text-[10px] sm:text-xs font-sans text-slate-400">ج.م</span>
          </p>
          <p className="text-[10px] sm:text-[11px] text-amber-600 mt-1 truncate">تخصم نهاية الشهر الحالي</p>
        </div>

        {/* Active Loans */}
        <div 
          onClick={() => setActiveTab('loans')}
          className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 cursor-pointer transition-all overflow-hidden"
        >
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500 truncate">سلف طويلة الأجل</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
              <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-lg sm:text-xl md:text-2xl font-black font-mono text-indigo-700 truncate" title={`${stats.totalLoansRemaining.toLocaleString()} ج.م`}>
            {stats.totalLoansRemaining.toLocaleString()} <span className="text-[10px] sm:text-xs font-sans text-slate-400">ج.م</span>
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1 truncate">{stats.activeLoansCount} سلف نشطة بأقساط</p>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Import Excel */}
        <div 
          onClick={() => setActiveTab('employees')}
          className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-blue-300 cursor-pointer group transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
          </div>
          <h3 className="font-bold text-slate-900 text-base mb-1">استيراد بيانات الموظفين</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            تحميل قالب الإكسيل الجاهز ومعاينة البيانات والربط بالكود والرقم التأميني قبل الاعتماد.
          </p>
        </div>

        {/* Card 2: Attendance Import */}
        <div 
          onClick={() => setActiveTab('attendance')}
          className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-emerald-300 cursor-pointer group transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-all">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
          </div>
          <h3 className="font-bold text-slate-900 text-base mb-1">حضور وانصراف الشهر</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            تحديد السنة والشهر وتاريخ من وإلى، استيراد شيت الحضور وحساب أيام الغياب وساعات الإضافي.
          </p>
        </div>

        {/* Card 3: Employee Portal */}
        <div 
          onClick={() => setActiveTab('portal')}
          className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-300 cursor-pointer group transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <Sparkles className="w-6 h-6" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
          </div>
          <h3 className="font-bold text-slate-900 text-base mb-1">بوابة الموظف الذكية</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            واجهة تطبيق موبايل متجاوبة تتيح للموظف تقديم الإجازات والإضافي ومعرفة رصيد السلف وقسيمة الراتب.
          </p>
        </div>
      </div>
    </div>
  );
}
