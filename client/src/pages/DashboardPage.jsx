import React, { useState, useEffect } from 'react';
import { 
  Users, Calculator, CreditCard, Palmtree, DollarSign, 
  CalendarCheck, ArrowUpRight, TrendingUp, Inbox, ShieldCheck, 
  ChevronLeft, Sparkles, Building2, FileSpreadsheet
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
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white p-6 md:p-8 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-white/20 backdrop-blur-md text-white text-xs font-bold rounded-lg">
              نظام إدارة المرتبات الذكي
            </span>
            <span className="text-xs text-blue-200">الإصدار 1.0 (لوكال)</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black mb-2">
            مرحباً بك في نظام مرتبات عمال وسائقين عرابي
          </h1>
          <p className="text-xs md:text-sm text-blue-100 leading-relaxed">
            منظومة متكاملة لحساب المرتبات، الإضافي، الغياب، التأمينات، ضريبة كسب العمل، 
            مصروفات يوم 10 و 20، وسلف الأقساط، مع بوابة تفاعلية للموظفين قابلة للعمل على الموبايل كـ App.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-5">
            <button
              onClick={() => setActiveTab('payroll')}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-blue-800 text-xs md:text-sm font-bold rounded-xl shadow-xs hover:bg-blue-50 transition-all"
            >
              <Calculator className="w-4 h-4" />
              <span>فتح مسير الرواتب الشهري</span>
            </button>

            <button
              onClick={() => setActiveTab('portal')}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/30 text-white text-xs md:text-sm font-bold rounded-xl border border-white/20 hover:bg-blue-500/40 transition-all"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>تجربة بوابة الموظف (الموبايل)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Employees */}
        <div 
          onClick={() => setActiveTab('employees')}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500">إجمالي الموظفين</span>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black font-mono text-slate-900">
            {stats.employeesCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">{stats.departmentsCount} أقسام وإدارات</p>
        </div>

        {/* Latest Payroll */}
        <div 
          onClick={() => setActiveTab('payroll')}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-emerald-200 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500">صافي آخر مرتبات</span>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <Calculator className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-emerald-700">
            {stats.latestPayrollNet.toLocaleString()} <span className="text-xs font-sans text-slate-400">ج.م</span>
          </p>
          <p className="text-[11px] text-emerald-600 mt-1">كشف معتمد بالكامل</p>
        </div>

        {/* Mid-Month Expenses */}
        <div 
          onClick={() => setActiveTab('expenses')}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-amber-200 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500">مصروفات (10 و 20)</span>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-amber-700">
            {stats.expensesTotal.toLocaleString()} <span className="text-xs font-sans text-slate-400">ج.م</span>
          </p>
          <p className="text-[11px] text-amber-600 mt-1">تخصم نهاية الشهر الحالي</p>
        </div>

        {/* Active Loans */}
        <div 
          onClick={() => setActiveTab('loans')}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500">سلف طويلة الأجل</span>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-indigo-700">
            {stats.totalLoansRemaining.toLocaleString()} <span className="text-xs font-sans text-slate-400">ج.م</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">{stats.activeLoansCount} سلف نشطة بأقساط</p>
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
