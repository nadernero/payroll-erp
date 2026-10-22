import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Download, Save, Search, RefreshCw, CheckCircle2, 
  Calendar, FileSpreadsheet, ArrowLeftRight, Wallet, MessageCircle, X, Check
} from 'lucide-react';
import { fetchJson } from '../utils/api';

export default function ExpensesPage() {
  const currentDate = new Date();
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(10);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Treasury Disburse Integration
  const [safes, setSafes] = useState([]);
  const [showTreasuryModal, setShowTreasuryModal] = useState(false);
  const [disburseSafeId, setDisburseSafeId] = useState('');
  const [disburseDay, setDisburseDay] = useState(10);
  const [disburseCourier, setDisburseCourier] = useState('');
  const [disbursePhone, setDisbursePhone] = useState('');
  const [disburseNotes, setDisburseNotes] = useState('');
  const [disburseDate, setDisburseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [disbursing, setDisbursing] = useState(false);

  useEffect(() => {
    fetchJson('/treasury/safes')
      .then(res => {
        const s = res.data || [];
        setSafes(s);
        if (s.length > 0) setDisburseSafeId(String(s[0].id));
      })
      .catch(() => {});
  }, []);

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const data = await fetchJson(`/expenses?year=${year}&month=${month}`);
      setItems(data.items || []);
    } catch (err) {
      alert('خطأ في جلب المصروفات: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [year, month]);

  const handleAmountChange = (index, field, value) => {
    const newItems = [...items];
    const num = parseFloat(value) || 0;
    newItems[index][field] = num;
    newItems[index].total_amount = (Number(newItems[index].amount_day_10) || 0) + (Number(newItems[index].amount_day_20) || 0);
    setItems(newItems);
  };

  const handleNotesChange = (index, value) => {
    const newItems = [...items];
    newItems[index].notes = value;
    setItems(newItems);
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      await fetchJson('/expenses/save', {
        method: 'POST',
        body: JSON.stringify({
          year,
          month,
          items
        })
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert('خطأ أثناء حفظ المصروفات: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDisburseFromTreasury = async (e) => {
    e.preventDefault();
    if (!disburseSafeId) {
      alert('يرجى اختيار الخزينة');
      return;
    }
    const field = disburseDay === 10 ? 'amount_day_10' : 'amount_day_20';
    const validItems = items.filter(it => (parseFloat(it[field]) || 0) > 0);
    const totalToPay = validItems.reduce((sum, it) => sum + (parseFloat(it[field]) || 0), 0);

    if (totalToPay <= 0) {
      alert(`لا توجد مبالغ مسجلة للموظفين في دفعة يوم ${disburseDay}. يرجى إدخال المبالغ أولاً في الجدول ثم الضغط على صرف من الخزينة`);
      return;
    }

    const safeObj = safes.find(s => String(s.id) === String(disburseSafeId));
    if (safeObj && totalToPay > safeObj.current_balance) {
      alert(`رصيد الخزينة (${safeObj.current_balance.toLocaleString()} ج.م) لا يكفي لصرف إجمالي الدفعة (${totalToPay.toLocaleString()} ج.م)`);
      return;
    }

    setDisbursing(true);
    try {
      const payload = {
        safe_id: disburseSafeId,
        year,
        month,
        day: disburseDay,
        transaction_date: disburseDate,
        courier_name: disburseCourier,
        sender_phone: disbursePhone,
        notes: disburseNotes,
        items: validItems.map(it => ({
          employee_id: it.employee_id,
          amount: parseFloat(it[field]),
          notes: it.notes
        }))
      };

      const res = await fetchJson('/treasury/disburse-mid-month', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      alert(res.message);
      setShowTreasuryModal(false);
      await loadExpenses();
    } catch (err) {
      alert('خطأ أثناء الصرف من الخزينة: ' + err.message);
    } finally {
      setDisbursing(false);
    }
  };

  // Totals
  const totalDay10 = items.reduce((s, i) => s + (Number(i.amount_day_10) || 0), 0);
  const totalDay20 = items.reduce((s, i) => s + (Number(i.amount_day_20) || 0), 0);
  const grandTotal = totalDay10 + totalDay20;

  const filteredItems = items.filter(i =>
    !searchTerm ||
    i.employee_name.includes(searchTerm) ||
    i.employee_code.includes(searchTerm) ||
    (i.department && i.department.includes(searchTerm))
  );

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800">
              بيان مصروفات الموظفين الخاصة بشهر {month} ({year})
            </h1>
            <p className="text-xs md:text-sm text-slate-500">
              تسجيل دفعات المصروفات يوم 10 و 20 وربط الإجمالي بالموظف مباشرة لخصمه تلقائياً من راتب الشهر
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export to Excel */}
          <a
            href={`/api/expenses/export/excel?year=${year}&month=${month}`}
            className="flex items-center gap-2 px-3.5 py-2 text-xs md:text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-all border border-emerald-200"
            download
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            تصدير شيت المصروفات (Excel)
          </a>

          {/* Disburse from Treasury Button */}
          <button
            onClick={() => setShowTreasuryModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Wallet className="w-4 h-4 text-amber-200" />
            <span>صرف الدفعة من الخزينة</span>
          </button>

          {/* Save Button */}
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-xs md:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>حفظ وربط مع الراتب</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 text-sm shadow-xs">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>تم حفظ بيانات المصروفات وربطها بالموظفين بنجاح! سيتم خصمها مباشرة في كشف مرتبات شهر {month}.</span>
        </div>
      )}

      {/* Control bar: Month / Year / Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                <option key={m} value={m}>شهر {m}</option>
              ))}
            </select>
          </div>

          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-700"
          >
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالكود أو اسم الموظف..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
          />
        </div>
      </div>

      {/* KPI Cards: Totals Day 10, Day 20, Grand Total */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-100 shadow-sm min-w-0">
          <span className="text-xs font-medium text-slate-500 block truncate">إجمالي مصروف يوم 10</span>
          <p className="text-xl sm:text-2xl font-bold font-mono text-blue-700 mt-1 sm:mt-2 truncate" title={`${totalDay10.toLocaleString()} ج.م`}>
            {totalDay10.toLocaleString()} <span className="text-xs font-sans text-slate-400">ج.م</span>
          </p>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-100 shadow-sm min-w-0">
          <span className="text-xs font-medium text-slate-500 block truncate">إجمالي مصروف يوم 20</span>
          <p className="text-xl sm:text-2xl font-bold font-mono text-amber-700 mt-1 sm:mt-2 truncate" title={`${totalDay20.toLocaleString()} ج.م`}>
            {totalDay20.toLocaleString()} <span className="text-xs font-sans text-slate-400">ج.م</span>
          </p>
        </div>

        <div className="bg-amber-500/10 p-3.5 sm:p-4 rounded-2xl border border-amber-300 shadow-sm min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 truncate">إجمالي المصروفات (تخصم من الرواتب)</span>
            <ArrowLeftRight className="w-4 h-4 text-amber-600 shrink-0 mr-1" />
          </div>
          <p className="text-xl sm:text-2xl font-black font-mono text-amber-900 mt-1 sm:mt-2 truncate" title={`${grandTotal.toLocaleString()} ج.م`}>
            {grandTotal.toLocaleString()} <span className="text-xs font-sans text-amber-700 font-normal">ج.م</span>
          </p>
        </div>
      </div>

      {/* Streamlined Expenses Table (without recipient columns) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mb-3 text-blue-600" />
            <p className="text-sm">جاري تحميل كشف المصروفات...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs text-slate-600">
              <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200 select-none">
                <tr>
                  <th className="py-3 px-3 w-12 text-center">م</th>
                  <th className="py-3 px-3 text-center">كود الموظف</th>
                  <th className="py-3 px-4 font-bold text-slate-900">اسم الموظف</th>
                  <th className="py-3 px-3">القسم</th>
                  <th className="py-3 px-3">الوظيفة</th>
                  <th className="py-3 px-3 text-center bg-blue-50/80 text-blue-900">
                    مصروف يوم 10 (ج.م)
                  </th>
                  <th className="py-3 px-3 text-center bg-amber-50/80 text-amber-900">
                    مصروف يوم 20 (ج.م)
                  </th>
                  <th className="py-3 px-4 text-center bg-amber-100/80 text-amber-950 font-black">
                    إجمالي المصروفات (خصم الراتب)
                  </th>
                  <th className="py-3 px-3">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredItems.map((item) => {
                  const originalIndex = items.findIndex(i => i.employee_id === item.employee_id);
                  const isHighlighted = item.total_amount > 0;
                  return (
                    <tr
                      key={item.employee_id}
                      className={isHighlighted ? 'bg-amber-50/20 hover:bg-amber-50/40' : 'hover:bg-slate-50/80'}
                    >
                      <td className="py-2.5 px-3 text-center text-slate-400">{item.seq}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-blue-700 bg-blue-50/20">
                        {item.employee_code}
                      </td>
                      <td className="py-2.5 px-4 font-sans font-bold text-slate-900">{item.employee_name}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-600">{item.department}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-600">{item.job_title}</td>

                      {/* Amount Day 10 */}
                      <td className="py-1.5 px-2 text-center bg-blue-50/30">
                        <input
                          type="number"
                          step="50"
                          value={item.amount_day_10 === 0 ? '' : item.amount_day_10}
                          placeholder="0"
                          onChange={(e) => handleAmountChange(originalIndex, 'amount_day_10', e.target.value)}
                          className="w-28 text-center font-mono font-bold text-slate-800 py-1.5 px-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </td>

                      {/* Amount Day 20 */}
                      <td className="py-1.5 px-2 text-center bg-amber-50/30">
                        <input
                          type="number"
                          step="50"
                          value={item.amount_day_20 === 0 ? '' : item.amount_day_20}
                          placeholder="0"
                          onChange={(e) => handleAmountChange(originalIndex, 'amount_day_20', e.target.value)}
                          className="w-28 text-center font-mono font-bold text-slate-800 py-1.5 px-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                        />
                      </td>

                      {/* Total tied to salary */}
                      <td className="py-2.5 px-4 text-center font-black text-amber-900 bg-amber-100/50">
                        {item.total_amount > 0 ? `${item.total_amount.toLocaleString()} ج.م` : '0'}
                      </td>

                      {/* Notes */}
                      <td className="py-1.5 px-2 font-sans">
                        <input
                          type="text"
                          value={item.notes}
                          placeholder="ملاحظات..."
                          onChange={(e) => handleNotesChange(originalIndex, e.target.value)}
                          className="w-48 text-xs py-1.5 px-2 bg-white border border-slate-200 rounded-lg"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-amber-400 font-black text-slate-950 border-t-2 border-amber-500 text-sm">
                <tr>
                  <td colSpan="5" className="py-3 px-4 text-center">الإجمالي الكلي لمصروفات شهر {month}</td>
                  <td className="py-3 px-2 text-center font-mono">{totalDay10.toLocaleString()} ج.م</td>
                  <td className="py-3 px-2 text-center font-mono">{totalDay20.toLocaleString()} ج.م</td>
                  <td className="py-3 px-4 text-center font-mono text-base bg-amber-500 text-white">
                    {grandTotal.toLocaleString()} ج.م
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      {/* Disburse from Treasury Modal */}
      {showTreasuryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 p-6 space-y-5">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">صرف دفعة المصروفات من الخزينة مباشرة</h3>
                  <p className="text-[11px] text-slate-400">تخصم من رصيد الخزينة المحددة وتسجل في حركة الخزينة والرواتب</p>
                </div>
              </div>
              <button onClick={() => setShowTreasuryModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDisburseFromTreasury} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">الخزينة المراد الصرف منها *</label>
                <select
                  required
                  value={disburseSafeId}
                  onChange={e => setDisburseSafeId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold bg-white"
                >
                  {safes.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} — رصيد متاح: {s.current_balance.toLocaleString()} ج.م
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">اختر الدفعة المراد صرفها *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDisburseDay(10)}
                    className={`p-3 rounded-2xl border text-right cursor-pointer transition-all ${
                      disburseDay === 10
                        ? 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-bold text-slate-800 block text-xs">دفعة يوم 10</span>
                    <span className="font-mono font-black text-amber-800 text-sm">{totalDay10.toLocaleString()} ج.م</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      لعدد ({items.filter(i => (Number(i.amount_day_10) || 0) > 0).length}) موظف
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDisburseDay(20)}
                    className={`p-3 rounded-2xl border text-right cursor-pointer transition-all ${
                      disburseDay === 20
                        ? 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-bold text-slate-800 block text-xs">دفعة يوم 20</span>
                    <span className="font-mono font-black text-amber-800 text-sm">{totalDay20.toLocaleString()} ج.م</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      لعدد ({items.filter(i => (Number(i.amount_day_20) || 0) > 0).length}) موظف
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">تاريخ الصرف بالخزينة *</label>
                  <input
                    type="date"
                    required
                    value={disburseDate}
                    onChange={e => setDisburseDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">اسم الموظف / السائق المستلم</label>
                  <input
                    type="text"
                    value={disburseCourier}
                    onChange={e => setDisburseCourier(e.target.value)}
                    placeholder="اسم من استلم المبلغ للتوزيع..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">موبايل المستلم (للواتساب)</label>
                <input
                  type="text"
                  value={disbursePhone}
                  onChange={e => setDisbursePhone(e.target.value)}
                  placeholder="010xxxxxxxx"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات</label>
                <input
                  type="text"
                  value={disburseNotes}
                  onChange={e => setDisburseNotes(e.target.value)}
                  placeholder="ملاحظات الصرف..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">المبلغ الإجمالي المخصوم من الخزينة:</span>
                <span className="font-black font-mono text-base text-amber-900">
                  {(disburseDay === 10 ? totalDay10 : totalDay20).toLocaleString()} ج.م
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTreasuryModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={disbursing || (disburseDay === 10 ? totalDay10 : totalDay20) <= 0}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {disbursing ? 'جاري الصرف والخصم...' : 'تأكيد الصرف من الخزينة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
