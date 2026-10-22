import React, { useState, useEffect } from 'react';
import { X, Printer, Download, Search, RefreshCw, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { fetchJson } from '../utils/api';
import * as XLSX from 'xlsx';

export default function BalancesReportModal({ onClose }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');

  const loadReport = async () => {
    try {
      setLoading(true);
      const res = await fetchJson('/payroll/balances-report');
      setData(res);
    } catch (err) {
      alert('خطأ في جلب تقرير الأرصدة: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const departments = ['all', ...new Set(data.map(d => d.department).filter(Boolean))];

  const filtered = data.filter(d => {
    const matchDept = selectedDept === 'all' || d.department === selectedDept;
    const matchSearch = !searchTerm || 
      d.name.includes(searchTerm) || 
      String(d.code).includes(searchTerm) || 
      (d.job_title && d.job_title.includes(searchTerm));
    return matchDept && matchSearch;
  });

  const totalRemainingLoans = filtered.reduce((s, d) => s + (d.loans.remaining_amount || 0), 0);
  const totalRemainingLeaves = filtered.reduce((s, d) => s + (d.annual_leaves.remaining_days || 0), 0);
  const totalEmployees = filtered.length;

  const exportExcel = () => {
    const rows = filtered.map(d => ({
      'كود الموظف': d.code,
      'اسم الموظف': d.name,
      'القسم': d.department,
      'الوظيفة': d.job_title,
      'رصيد السنوي المستحق': d.annual_leaves.total_entitlement,
      'الإجازات السنوية المستهلكة': d.annual_leaves.used_days,
      'باقي رصيد الإجازات السنوية': d.annual_leaves.remaining_days,
      'إجمالي مبلغ السلف': d.loans.total_amount,
      'المبالغ المسددة': d.loans.paid_amount,
      'باقي السلف المستحقة': d.loans.remaining_amount
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'تقرير_أرصدة_السلف_والإجازات');
    XLSX.writeFile(workbook, `تقرير_الارصدة_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-100 overflow-hidden my-6">
        
        {/* Modal Header */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-800 text-base">تقرير شامل بأرصدة السلف والإجازات السنوية</h3>
            <p className="text-xs text-slate-500 mt-0.5">متابعة دقيقة لباقي السلف المستحقة وباقي رصيد الإجازات السنوية لكافة العاملين</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              تصدير إكسيل
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              طباعة التقرير
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          
          {/* Printable Header on paper */}
          <div className="hidden print:block text-center border-b pb-4 mb-4">
            <h2 className="text-lg font-black text-slate-900">تقرير أرصدة السلف والإجازات السنوية المتبقية</h2>
            <p className="text-xs text-slate-500">تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</p>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
              <span className="text-xs text-slate-500 font-medium">عدد الموظفين المشمولين</span>
              <p className="text-xl font-bold font-mono text-slate-800 mt-1">{totalEmployees} موظف</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
              <span className="text-xs text-amber-700 font-medium">إجمالي باقي السلف على الموظفين</span>
              <p className="text-xl font-black font-mono text-amber-800 mt-1">{totalRemainingLoans.toLocaleString()} ج.م</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
              <span className="text-xs text-blue-700 font-medium">إجمالي رصيد الإجازات السنوية المتبقي</span>
              <p className="text-xl font-black font-mono text-blue-800 mt-1">{totalRemainingLeaves.toLocaleString()} يوم</p>
            </div>
          </div>

          {/* Search & Filter (Hidden on print) */}
          <div className="no-print flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="بحث بالاسم أو الكود أو الوظيفة..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-medium"
            >
              <option value="all">كل الأقسام</option>
              {departments.filter(d => d !== 'all').map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mb-3 text-blue-600" />
              <p className="text-sm">جاري تجميع وحساب الأرصدة...</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[60vh] overflow-y-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 text-center w-12">كود</th>
                    <th className="p-2.5">اسم الموظف</th>
                    <th className="p-2.5">القسم</th>
                    <th className="p-2.5">الوظيفة</th>
                    <th className="p-2.5 text-center bg-blue-50 text-blue-900 border-x border-slate-200" colSpan={3}>
                      الإجازات السنوية (أيام)
                    </th>
                    <th className="p-2.5 text-center bg-amber-50 text-amber-900" colSpan={3}>
                      السلف المالية (ج.م)
                    </th>
                  </tr>
                  <tr className="bg-slate-50 text-[11px] text-slate-600 border-b border-slate-200">
                    <th></th>
                    <th></th>
                    <th></th>
                    <th></th>
                    <th className="p-1.5 text-center border-r border-slate-200">المستحق</th>
                    <th className="p-1.5 text-center">المستهلك</th>
                    <th className="p-1.5 text-center bg-blue-100/60 font-bold text-blue-900 border-l border-slate-200">المتبقي</th>
                    <th className="p-1.5 text-center">إجمالي السلفة</th>
                    <th className="p-1.5 text-center">المسدد</th>
                    <th className="p-1.5 text-center bg-amber-100/60 font-bold text-amber-900">باقي السلفة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                  {filtered.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-2.5 text-center font-bold text-slate-500">{row.code}</td>
                      <td className="p-2.5 font-sans font-bold text-slate-900">{row.name}</td>
                      <td className="p-2.5 font-sans text-slate-600">{row.department}</td>
                      <td className="p-2.5 font-sans text-slate-600">{row.job_title}</td>
                      <td className="p-2 text-center text-slate-500 border-r border-slate-100">{row.annual_leaves.total_entitlement}</td>
                      <td className="p-2 text-center text-rose-600">{row.annual_leaves.used_days}</td>
                      <td className="p-2 text-center bg-blue-50/50 font-bold text-blue-700 border-l border-slate-100">
                        {row.annual_leaves.remaining_days} يوم
                      </td>
                      <td className="p-2 text-center text-slate-500">{row.loans.total_amount ? row.loans.total_amount.toLocaleString() : '-'}</td>
                      <td className="p-2 text-center text-emerald-600">{row.loans.paid_amount ? row.loans.paid_amount.toLocaleString() : '-'}</td>
                      <td className="p-2 text-center bg-amber-50/50 font-bold text-amber-800">
                        {row.loans.remaining_amount ? `${row.loans.remaining_amount.toLocaleString()} ج` : 'خالص'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
