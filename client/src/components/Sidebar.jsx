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

      {/* Switch to Employee Mobile Portal */}
      <div className="p-3 border-t border-slate-800 space-y-2">
        <button
          onClick={() => setActiveTab('portal')}
          className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all border ${
            activeTab === 'portal'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400/30'
              : 'bg-slate-800/50 hover:bg-slate-800 text-slate-300 border-slate-700/50'
          }`}
        >
          <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
            <Sparkles className="w-5 h-5 text-amber-300" />
          </div>
          <div className="text-right">
            <span className="font-bold text-xs block text-white">بوابة الموظف (الموبايل)</span>
            <span className="text-[10px] text-slate-400">تقديم إجازات وإضافي واستعلام</span>
          </div>
        </button>

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
