import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, CalendarCheck, DollarSign, 
  CreditCard, Palmtree, Calculator, Inbox, Sparkles, 
  Building2, Cpu, Wifi, Copy, Check, Wallet, ChevronDown, ChevronLeft,
  Briefcase
} from 'lucide-react';
import { fetchJson } from '../utils/api';

export default function Sidebar({ activeTab, setActiveTab }) {
  const [networkInfo, setNetworkInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  const [hrExpanded, setHrExpanded] = useState(true);

  useEffect(() => {
    fetchJson('/system/network-info')
      .then(info => setNetworkInfo(info))
      .catch(() => {});
  }, []);

  // شؤون العاملين - قائمة الصفحات التابعة لها
  const hrSubItems = [
    { id: 'employees', label: 'الموظفون وبياناتهم', icon: Users },
    { id: 'attendance', label: 'الحضور والانصراف', icon: CalendarCheck },
    { id: 'biometric', label: 'ماكينة البصمة (ZKTeco)', icon: Cpu },
    { id: 'payroll', label: 'مسير الرواتب والأجور', icon: Calculator },
    { id: 'expenses', label: 'المصروفات الشهرية', icon: DollarSign },
    { id: 'loans', label: 'السلف وتقسيطها', icon: CreditCard },
    { id: 'leaves', label: 'الإجازات السنوية', icon: Palmtree },
    { id: 'requests', label: 'طلبات وتظلمات الموظفين', icon: Inbox },
  ];

  const hrIds = hrSubItems.map(i => i.id);
  const isHrActive = hrIds.includes(activeTab);

  // Auto expand HR menu if an HR tab is active
  useEffect(() => {
    if (isHrActive) {
      setHrExpanded(true);
    }
  }, [activeTab, isHrActive]);

  const copyLan = () => {
    if (networkInfo?.primaryLanUrl) {
      navigator.clipboard.writeText(networkInfo.primaryLanUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex-col justify-between hidden md:flex shrink-0 border-l border-slate-800 select-none overflow-y-auto">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/30">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-black text-white text-base tracking-tight">نظام الرواتب ERP</h1>
              <p className="text-[11px] text-slate-400">عمال وسائقين عرابي</p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-2">
          {/* 1. لوحة التحكم */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <LayoutDashboard className={`w-4 h-4 ${activeTab === 'dashboard' ? 'text-white' : 'text-slate-400'}`} />
            <span>لوحة التحكم الرئيسية</span>
          </button>

          {/* 2. الخزينة والعهد (بند مالي رئيسي ومستقل تماماً) */}
          <div className="pt-1">
            <button
              onClick={() => setActiveTab('treasury')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                activeTab === 'treasury'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-900/30'
                  : 'text-emerald-400 bg-emerald-950/20 border-emerald-800/40 hover:bg-emerald-900/40 hover:text-emerald-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>الخزينة والعهد النقدية</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                activeTab === 'treasury' ? 'bg-emerald-700 text-white' : 'bg-emerald-900/60 text-emerald-300'
              }`}>
                مالية
              </span>
            </button>
          </div>

          <div className="pt-2 border-t border-slate-800/60">
            {/* 3. شؤون العاملين (البند المجمع لكافة شؤون الموظفين) */}
            <div className="rounded-2xl bg-slate-800/40 border border-slate-800/80 overflow-hidden">
              <button
                onClick={() => setHrExpanded(!hrExpanded)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                  isHrActive
                    ? 'text-blue-400 bg-blue-950/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-1 rounded-lg ${isHrActive ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    <Briefcase className="w-3.5 h-3.5" />
                  </div>
                  <span>شؤون العاملين</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full font-mono">
                    {hrSubItems.length}
                  </span>
                  {hrExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronLeft className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </button>

              {/* القوائم الفرعية لشؤون العاملين */}
              {hrExpanded && (
                <div className="p-1.5 space-y-0.5 bg-slate-900/60 border-t border-slate-800/60 pr-3">
                  {hrSubItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                          isActive
                            ? 'bg-blue-600 text-white font-bold shadow-xs'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </nav>
      </div>

      {/* Switch to Portals & LAN */}
      <div className="p-3 border-t border-slate-800 space-y-2">
        <div className="flex items-center gap-1.5 bg-slate-800/60 rounded-2xl p-1 border border-slate-700/60">
          <button
            onClick={() => setActiveTab('portal')}
            className={`flex-1 flex items-center gap-2 p-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'portal'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
            <div className="text-right">
              <span className="font-bold text-xs block">بوابة الموظف</span>
              <span className="text-[9px] text-slate-400">إجازات وسلف</span>
            </div>
          </button>
          <button
            onClick={() => {
              const url = `${window.location.origin}/portal`;
              navigator.clipboard.writeText(url);
              alert(`تم نسخ رابط بوابة الموظف:\n${url}`);
            }}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-colors cursor-pointer"
            title="نسخ رابط بوابة الموظف"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-800/60 rounded-2xl p-1 border border-slate-700/60">
          <button
            onClick={() => setActiveTab('warehouse')}
            className={`flex-1 flex items-center gap-2 p-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'warehouse'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Building2 className="w-4 h-4 text-amber-300 shrink-0" />
            <div className="text-right">
              <span className="font-bold text-xs block">بوابة المخازن</span>
              <span className="text-[9px] text-slate-400">فروع وعمال</span>
            </div>
          </button>
          <button
            onClick={() => {
              const url = `${window.location.origin}/warehouse-portal`;
              navigator.clipboard.writeText(url);
              alert(`تم نسخ رابط بوابة مدير المخازن:\n${url}`);
            }}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-colors cursor-pointer"
            title="نسخ رابط بوابة مدير المخازن"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* LAN Access Info */}
        {networkInfo && networkInfo.primaryLanUrl && (
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-[10px]">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="flex items-center gap-1 font-semibold text-slate-300">
                <Wifi className="w-3 h-3 text-emerald-400" /> شبكة الكمبيوتر (LAN)
              </span>
              <button
                onClick={copyLan}
                className="text-blue-400 hover:text-white flex items-center gap-0.5 cursor-pointer"
                title="نسخ الرابط"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
              </button>
            </div>
            <code className="block text-emerald-400 font-mono font-bold truncate">
              {networkInfo.primaryLanUrl}
            </code>
          </div>
        )}
      </div>
    </aside>
  );
}
