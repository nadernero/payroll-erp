import React from 'react';
import { Sparkles, Calendar, CheckCircle2, ShieldCheck, User, Building2, Copy } from 'lucide-react';

export default function Header({ activeTab, setActiveTab }) {
  const arabicDate = new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date());

  const handleCopyWarehouseLink = () => {
    const url = `${window.location.origin}/warehouse-portal`;
    navigator.clipboard.writeText(url);
    alert(`تم نسخ رابط بوابة مدير المخازن:\n${url}\n\nيمكنك إرساله لأمين المخزن على الواتساب لفتحه مباشرة.`);
  };

  const handleCopyPortalLink = () => {
    const url = `${window.location.origin}/portal`;
    navigator.clipboard.writeText(url);
    alert(`تم نسخ رابط بوابة الموظف:\n${url}\n\nيمكنك إرساله للموظفين على الواتساب لفتحه مباشرة.`);
  };

  return (
    <header className="hidden md:flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200/80 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span>{arabicDate}</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/60 font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>المزامنة السحابية متصلة ولحظية (Supabase Live)</span>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Employee Portal Direct Link & Copy */}
        <div className="flex items-center bg-blue-50 rounded-xl border border-blue-200/80 p-0.5">
          <button
            onClick={() => setActiveTab('portal')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-blue-900 text-xs font-bold hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
            title="فتح بوابة الموظف"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>بوابة الموظف</span>
          </button>
          <button
            onClick={handleCopyPortalLink}
            className="p-1.5 text-blue-700 hover:text-blue-900 hover:bg-blue-100 rounded-lg transition-colors border-r border-blue-200 cursor-pointer"
            title="نسخ رابط بوابة الموظف لإرساله بالواتساب"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Warehouse Portal Direct Link & Copy */}
        <div className="flex items-center bg-amber-50 rounded-xl border border-amber-200/80 p-0.5">
          <button
            onClick={() => setActiveTab('warehouse')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-amber-900 text-xs font-bold hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
            title="فتح بوابة مدير المخازن"
          >
            <Building2 className="w-4 h-4 text-amber-600" />
            <span>بوابة مدير المخازن</span>
          </button>
          <button
            onClick={handleCopyWarehouseLink}
            className="p-1.5 text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded-lg transition-colors border-r border-amber-200 cursor-pointer"
            title="نسخ رابط بوابة مدير المخازن لإرساله بالواتساب"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
