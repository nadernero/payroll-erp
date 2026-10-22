import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, CalendarCheck, DollarSign, 
  CreditCard, Palmtree, Calculator, Inbox, Sparkles, 
  Building2, Shield, Cpu, Wifi, Copy, Check, Wallet
} from 'lucide-react';
import { fetchJson } from '../utils/api';

export default function Sidebar({ activeTab, setActiveTab }) {
  const [networkInfo, setNetworkInfo] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchJson('/system/network-info')
      .then(info => setNetworkInfo(info))
      .catch(() => {});
  }, []);

  const menuItems = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
    { id: 'employees', label: 'الموظفون', icon: Users },
    { id: 'attendance', label: 'الحضور والانصراف', icon: CalendarCheck },
    { id: 'biometric', label: 'ماكينة البصمة (ZKTeco)', icon: Cpu },
    { id: 'treasury', label: 'الخزينة والعهد', icon: Wallet },
    { id: 'expenses', label: 'مصروفات', icon: DollarSign },
    { id: 'loans', label: 'سلف', icon: CreditCard },
    { id: 'leaves', label: 'الإجازات السنوية', icon: Palmtree },
    { id: 'payroll', label: 'الرواتب', icon: Calculator },
    { id: 'requests', label: 'طلبات الموظفين', icon: Inbox },
  ];

  const copyLan = () => {
    if (networkInfo?.primaryLanUrl) {
      navigator.clipboard.writeText(networkInfo.primaryLanUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex-col justify-between hidden md:flex shrink-0 border-l border-slate-800 select-none">
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
        <nav className="p-3 space-y-1">
          <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            الإدارة وشؤون العاملين
          </p>

          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Switch to Portals */}
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
                className="text-blue-400 hover:text-white flex items-center gap-0.5"
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
