import React, { useState } from 'react';
import { 
  LayoutDashboard, Users, CalendarCheck, Calculator, 
  Sparkles, Menu, X, DollarSign, CreditCard, Palmtree, Inbox, Building2, Cpu, Wallet
} from 'lucide-react';

export default function MobileNav({ activeTab, setActiveTab }) {
  const [showDrawer, setShowDrawer] = useState(false);

  const mainTabs = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
    { id: 'employees', label: 'الموظفون', icon: Users },
    { id: 'attendance', label: 'الحضور', icon: CalendarCheck },
    { id: 'payroll', label: 'الرواتب', icon: Calculator },
    { id: 'portal', label: 'بوابتي', icon: Sparkles, highlight: true }
  ];

  const drawerTabs = [
    { id: 'warehouse', label: 'بوابة مدير المخازن والفروع', icon: Building2, desc: 'مراجعة العمال والخصومات وطلبات الإجازات' },
    { id: 'biometric', label: 'ماكينة البصمة (ZKTeco)', icon: Cpu, desc: 'ربط وسحب حركات البصمة عبر الشبكة' },
    { id: 'treasury', label: 'الخزينة والعهد', icon: Wallet, desc: 'الخزينة الرئيسية والفرعية وجرد فئات الدرج' },
    { id: 'expenses', label: 'مصروفات', icon: DollarSign, desc: 'مصروفات 10 و 20 وتنزيلها بالراتب' },
    { id: 'loans', label: 'سلف', icon: CreditCard, desc: 'السلف طويلة الأجل وتقسيطها' },
    { id: 'leaves', label: 'الإجازات السنوية', icon: Palmtree, desc: 'أرصدة وسجلات الإجازات وتعديلها' },
    { id: 'requests', label: 'طلبات الموظفين', icon: Inbox, desc: 'مراجعة واعتماد طلبات العاملين' }
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
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'portal'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-blue-300 border border-blue-500/30'
            }`}
          >
            بوابة الموظف
          </button>

          <button
            onClick={() => setShowDrawer(true)}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg bg-slate-800"
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
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                isActive
                  ? 'text-blue-600 font-bold'
                  : 'text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <div className={`p-1 rounded-lg ${isActive ? 'bg-blue-50' : ''}`}>
                <Icon className={`w-5 h-5 ${tab.highlight && !isActive ? 'text-amber-500' : ''}`} />
              </div>
              <span className="text-[10px] mt-0.5">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Overflow Drawer Menu */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-xs md:hidden">
          <div className="bg-white rounded-t-3xl p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base">القائمة الإضافية</h3>
              <button
                onClick={() => setShowDrawer(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {drawerTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setShowDrawer(false);
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-right transition-all border ${
                      isActive
                        ? 'bg-blue-50 border-blue-200 text-blue-800'
                        : 'bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="p-2.5 bg-white rounded-xl shadow-2xs">
                      <Icon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <span className="font-bold text-sm block">{tab.label}</span>
                      <span className="text-xs text-slate-400">{tab.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
