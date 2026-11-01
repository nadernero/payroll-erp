import React, { useState } from 'react';
import { 
  LayoutDashboard, Users, CalendarCheck, Calculator, 
  Sparkles, Menu, X, DollarSign, CreditCard, Palmtree, Inbox, Building2, Cpu, Wallet,
  Briefcase
} from 'lucide-react';

export default function MobileNav({ activeTab, setActiveTab }) {
  const [showDrawer, setShowDrawer] = useState(false);

  // الأزرار السريعة بالشريط السفلي للجوال
  const mainTabs = [
    { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
    { id: 'treasury', label: 'الخزينة والعهد', icon: Wallet, highlight: true },
    { id: 'attendance', label: 'الحضور', icon: CalendarCheck },
    { id: 'payroll', label: 'الرواتب', icon: Calculator },
    { id: 'portal', label: 'بوابتي', icon: Sparkles }
  ];

  // صفحات شؤون العاملين
  const hrTabs = [
    { id: 'employees', label: 'الموظفون وبياناتهم', icon: Users, desc: 'ملفات العاملين والرواتب الأساسية' },
    { id: 'attendance', label: 'الحضور والانصراف', icon: CalendarCheck, desc: 'تسجيل الحضور اليومي والغياب والإضافي' },
    { id: 'biometric', label: 'ماكينة البصمة (ZKTeco)', icon: Cpu, desc: 'ربط وسحب حركات البصمة عبر الشبكة' },
    { id: 'payroll', label: 'مسير الرواتب والأجور', icon: Calculator, desc: 'حساب مفردات المرتب وكسب العمل' },
    { id: 'expenses', label: 'المصروفات الشهرية', icon: DollarSign, desc: 'مصروفات يوم 10 و 20 وتنزيلها بالراتب' },
    { id: 'loans', label: 'السلف وتقسيطها', icon: CreditCard, desc: 'السلف طويلة الأجل والخصم الشهري' },
    { id: 'leaves', label: 'الإجازات السنوية', icon: Palmtree, desc: 'أرصدة وسجلات الإجازات وتعديلها' },
    { id: 'requests', label: 'طلبات وتظلمات الموظفين', icon: Inbox, desc: 'مراجعة واعتماد طلبات الإجازة والسلف' }
  ];

  return (
    <>
      {/* Top Mobile Bar */}
      <header className="md:hidden bg-slate-900 text-white p-3.5 flex items-center justify-between sticky top-0 z-40 border-b border-slate-800 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight">نظام الرواتب ERP</h1>
            <p className="text-[10px] text-slate-400">عمال وسائقين عرابي</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('portal')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'portal'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-blue-300 border border-blue-500/30'
            }`}
          >
            بوابة الموظف
          </button>

          <button
            onClick={() => setShowDrawer(true)}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg bg-slate-800 cursor-pointer"
            title="القائمة"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Bottom Mobile App Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg safe-bottom">
        {mainTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
                isActive
                  ? tab.id === 'treasury' ? 'text-emerald-700 font-bold' : 'text-blue-600 font-bold'
                  : 'text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <div className={`p-1 rounded-lg ${
                isActive 
                  ? tab.id === 'treasury' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-50 text-blue-600'
                  : tab.highlight ? 'text-emerald-600' : ''
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] mt-0.5">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Overflow Drawer Menu */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-xs md:hidden">
          <div className="bg-white rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base">أقسام النظام</h3>
              <button
                onClick={() => setShowDrawer(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1. الخزينة والعهد (مستقلة وبارزة) */}
            <div className="space-y-1">
              <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider px-1">
                الإدارة المالية
              </p>
              <button
                onClick={() => {
                  setActiveTab('treasury');
                  setShowDrawer(false);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl text-right transition-all border ${
                  activeTab === 'treasury'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-emerald-50/40 border-emerald-200/60 text-emerald-800 hover:bg-emerald-100/50'
                }`}
              >
                <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-sm block">الخزينة والعهد النقدية</span>
                  <span className="text-xs text-emerald-600/80">الخزينة الرئيسية والفرعية وجرد فئات النقدية</span>
                </div>
              </button>
            </div>

            {/* 2. شؤون العاملين (تجميع لكافة صفحات الموظفين) */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 px-1">
                <Briefcase className="w-4 h-4 text-blue-600" />
                <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  شؤون العاملين
                </p>
                <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.2 rounded-full">
                  {hrTabs.length} صفحات
                </span>
              </div>

              <div className="space-y-1.5">
                {hrTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setShowDrawer(false);
                      }}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-right transition-all border cursor-pointer ${
                        isActive
                          ? 'bg-blue-50 border-blue-200 text-blue-800'
                          : 'bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className={`p-2 rounded-lg shadow-2xs ${isActive ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-xs block truncate">{tab.label}</span>
                        <span className="text-[10px] text-slate-400 block truncate">{tab.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. بوابات الدخول السريع */}
            <div className="space-y-1 pt-2 border-t border-slate-100">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                بوابات إضافية
              </p>
              <button
                onClick={() => {
                  setActiveTab('warehouse');
                  setShowDrawer(false);
                }}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl text-right transition-all border bg-amber-50/50 border-amber-200/50 text-amber-900"
              >
                <div className="p-2 bg-amber-600 text-white rounded-lg">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-xs block">بوابة مدير المخازن والفروع</span>
                  <span className="text-[10px] text-amber-700/70">مراجعة العمال والخصومات واعتماد الطلبات</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
