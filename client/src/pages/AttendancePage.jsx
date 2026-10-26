import React, { useState, useEffect } from 'react';
import { 
  CalendarCheck, Clock, Download, Upload, Search, Filter, 
  FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw, X, 
  PlusCircle, Check, Edit2, Trash2, AlertTriangle, ShieldCheck,
  Cpu, Users, CheckSquare, Square, ChevronDown, Sparkles
} from 'lucide-react';
import { fetchJson, uploadFile } from '../utils/api';

export default function AttendancePage({ setActiveTab: setParentTab }) {
  const currentDate = new Date();
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('daily'); // 'daily' or 'summary'

  // Advanced Filters
  const [punchFilter, setPunchFilter] = useState('all'); // all, missing_either, missing_both, has_punch
  const [checkInFrom, setCheckInFrom] = useState('');
  const [checkInTo, setCheckInTo] = useState('');
  const [checkOutFrom, setCheckOutFrom] = useState('');
  const [checkOutTo, setCheckOutTo] = useState('');

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Bulk Overtime / Absence Modals
  const [showBulkOvertimeModal, setShowBulkOvertimeModal] = useState(false);
  const [bulkOvertimeDays, setBulkOvertimeDays] = useState(1.0);
  const [bulkOvertimeNotes, setBulkOvertimeNotes] = useState('');

  const [showBulkAbsenceModal, setShowBulkAbsenceModal] = useState(false);
  const [bulkAbsenceDays, setBulkAbsenceDays] = useState(1.0);
  const [bulkAbsenceNotes, setBulkAbsenceNotes] = useState('');

  const [showBulkAnnualLeaveModal, setShowBulkAnnualLeaveModal] = useState(false);
  const [bulkAnnualLeaveDays, setBulkAnnualLeaveDays] = useState(1.0);
  const [bulkAnnualLeaveDate, setBulkAnnualLeaveDate] = useState(new Date().toISOString().split('T')[0]);
  const [bulkAnnualLeaveNotes, setBulkAnnualLeaveNotes] = useState('');

  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);

  // Official Holidays State
  const [holidays, setHolidays] = useState([]);
  const [holidayForm, setHolidayForm] = useState({
    name: '',
    holiday_date: new Date().toISOString().split('T')[0],
    notes: 'إجازة رسمية مدفوعة الأجر',
    autoApplyToAttendance: true
  });
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [applyingHolidays, setApplyingHolidays] = useState(false);

  // Quick Daily Entry / Edit Modal
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [entryData, setEntryData] = useState({
    employee_code: '',
    date: new Date().toISOString().split('T')[0],
    status: 'حاضر',
    check_in: '08:00',
    check_out: '16:00',
    late_minutes: 0,
    overtime_days: 0,
    absence_days: 0,
    is_absent: false,
    is_annual_leave: false,
    is_overnight: false,
    notes: ''
  });

  // Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [importMessage, setImportMessage] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      let query = `?year=${year}&month=${month}`;
      if (startDate) {
        query += `&startDate=${startDate}`;
      }
      if (endDate) {
        query += `&endDate=${endDate}`;
      }
      if (deptFilter !== 'all') {
        query += `&department=${encodeURIComponent(deptFilter)}`;
      }

      const [recs, sum, hols] = await Promise.all([
        fetchJson(`/attendance${query}`),
        fetchJson(`/attendance/summary?year=${year}&month=${month}`),
        fetchJson(`/holidays?year=${year}`).catch(() => [])
      ]);

      setRecords(recs);
      setSummary(sum);
      setHolidays(hols || []);
      setSelectedIds(new Set());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [year, month, startDate, endDate, deptFilter]);

  const getArabicDay = (dateStr) => {
    if (!dateStr) return '';
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const d = new Date(dateStr);
    return isNaN(d.getDay()) ? '' : days[d.getDay()];
  };

  const handleSaveHoliday = async (e) => {
    e.preventDefault();
    if (!holidayForm.name || !holidayForm.holiday_date) return;
    try {
      setSavingHoliday(true);
      const res = await fetchJson('/holidays', {
        method: 'POST',
        body: JSON.stringify(holidayForm)
      });
      alert(res.message);
      setHolidayForm({
        name: '',
        holiday_date: new Date().toISOString().split('T')[0],
        notes: 'إجازة رسمية مدفوعة الأجر',
        autoApplyToAttendance: true
      });
      loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (id, name) => {
    if (window.confirm(`هل أنت متأكد من حذف الإجازة الرسمية "${name}"؟`)) {
      try {
        await fetchJson(`/holidays/${id}`, { method: 'DELETE' });
        loadData();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const handleApplyAllHolidays = async () => {
    try {
      setApplyingHolidays(true);
      const res = await fetchJson('/holidays/apply-all', {
        method: 'POST',
        body: JSON.stringify({ year, month })
      });
      alert(res.message);
      loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setApplyingHolidays(false);
    }
  };

  const [editingHoliday, setEditingHoliday] = useState(null);
  const [showEditHolidayModal, setShowEditHolidayModal] = useState(false);
  const [editHolidayForm, setEditHolidayForm] = useState({
    name: '',
    holiday_date: '',
    notes: ''
  });

  const handleOpenEditHoliday = (h) => {
    setEditingHoliday(h);
    setEditHolidayForm({
      name: h.name,
      holiday_date: h.holiday_date,
      notes: h.notes || ''
    });
    setShowEditHolidayModal(true);
  };

  const handleUpdateHoliday = async (e) => {
    e.preventDefault();
    if (!editingHoliday) return;
    try {
      await fetchJson(`/holidays/${editingHoliday.id}`, {
        method: 'PUT',
        body: JSON.stringify(editHolidayForm)
      });
      setShowEditHolidayModal(false);
      setEditingHoliday(null);
      loadData();
    } catch (err) {
      alert('خطأ أثناء تحديث الإجازة الرسمية: ' + err.message);
    }
  };

  const handleQuickDecision = async (empCode, date, decisionType) => {
    try {
      await fetchJson('/attendance/quick-decision', {
        method: 'POST',
        body: JSON.stringify({
          employee_code: empCode,
          date,
          decisionType
        })
      });
      loadData();
    } catch (err) {
      alert('خطأ أثناء تسجيل الإجراء: ' + err.message);
    }
  };

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    try {
      if (editingRecord) {
        await fetchJson(`/attendance/${editingRecord.id}`, {
          method: 'PUT',
          body: JSON.stringify(entryData)
        });
      } else {
        await fetchJson('/attendance/record', {
          method: 'POST',
          body: JSON.stringify(entryData)
        });
      }
      setShowEntryModal(false);
      setEditingRecord(null);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenEdit = (rec) => {
    setEditingRecord(rec);
    setEntryData({
      employee_code: rec.employee_code,
      date: rec.date,
      status: rec.status,
      check_in: rec.check_in || '',
      check_out: rec.check_out || '',
      late_minutes: rec.late_minutes || 0,
      overtime_days: rec.overtime_days || 0,
      absence_days: rec.absence_days || (rec.is_absent ? 1 : 0),
      is_absent: rec.is_absent === 1,
      is_annual_leave: rec.is_annual_leave === 1,
      is_overnight: rec.is_overnight === 1,
      notes: rec.notes || ''
    });
    setShowEntryModal(true);
  };

  const handleDeleteRecord = async (id, empName, date) => {
    if (window.confirm(`هل أنت متأكد من حذف حركة الحضور ليوم ${date} للموظف ${empName}؟`)) {
      try {
        await fetchJson(`/attendance/${id}`, { method: 'DELETE' });
        loadData();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  // Bulk Overtime submission
  const handleBulkOvertimeSubmit = async (e) => {
    e.preventDefault();
    if (selectedIds.size === 0) return;
    try {
      const res = await fetchJson('/attendance/bulk-overtime', {
        method: 'POST',
        body: JSON.stringify({
          recordIds: Array.from(selectedIds),
          overtime_days: bulkOvertimeDays,
          notes: bulkOvertimeNotes
        })
      });
      alert(res.message);
      setShowBulkOvertimeModal(false);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Bulk Absence submission
  const handleBulkAbsenceSubmit = async (e) => {
    e.preventDefault();
    if (selectedIds.size === 0) return;
    try {
      const res = await fetchJson('/attendance/bulk-absence', {
        method: 'POST',
        body: JSON.stringify({
          recordIds: Array.from(selectedIds),
          absence_days: bulkAbsenceDays,
          notes: bulkAbsenceNotes
        })
      });
      alert(res.message);
      setShowBulkAbsenceModal(false);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Bulk Annual Leave submission
  const handleBulkAnnualLeaveSubmit = async (e) => {
    e.preventDefault();
    if (selectedIds.size === 0) return;
    try {
      const res = await fetchJson('/attendance/bulk-annual-leave', {
        method: 'POST',
        body: JSON.stringify({
          recordIds: Array.from(selectedIds),
          days_count: bulkAnnualLeaveDays,
          date: bulkAnnualLeaveDate,
          notes: bulkAnnualLeaveNotes
        })
      });
      alert(res.message);
      setSelectedIds(new Set());
      setShowBulkAnnualLeaveModal(false);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);
    try {
      setIsUploading(true);
      setImportMessage(null);
      const preview = await uploadFile('/attendance/import/preview', file);
      setImportPreview(preview);
    } catch (err) {
      alert('خطأ في معالجة ملف الحضور: ' + err.message);
      setImportPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview || !importPreview.items) return;
    try {
      setIsUploading(true);
      const res = await fetchJson('/attendance/import/confirm', {
        method: 'POST',
        body: JSON.stringify({ items: importPreview.items })
      });
      setImportMessage(res.message);
      setImportPreview(null);
      setImportFile(null);
      loadData();
      setTimeout(() => setShowImportModal(false), 2000);
    } catch (err) {
      alert('خطأ أثناء تأكيد الحضور: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Filtering records locally
  const filteredRecords = records.filter(r => {
    // 0. Date Range filter (strict filter based on selected from / to date)
    if (startDate && r.date < startDate) return false;
    if (endDate && r.date > endDate) return false;

    // 1. Text Search
    if (searchTerm) {
      const name = r.employee_name || '';
      const code = String(r.employee_code || '');
      const dept = r.department || '';
      if (!name.includes(searchTerm) && !code.includes(searchTerm) && !dept.includes(searchTerm)) {
        return false;
      }
    }

    // 2. Punch Filter
    const hasIn = !!r.check_in && r.check_in.trim() !== '';
    const hasOut = !!r.check_out && r.check_out.trim() !== '';

    if (punchFilter === 'missing_either') {
      if (hasIn && hasOut) return false;
    } else if (punchFilter === 'missing_both') {
      if (hasIn || hasOut) return false;
    } else if (punchFilter === 'has_punch') {
      if (!hasIn && !hasOut) return false;
    }

    // 3. Time Filter: Check-in
    if (checkInFrom && (!r.check_in || r.check_in < checkInFrom)) return false;
    if (checkInTo && (!r.check_in || r.check_in > checkInTo)) return false;

    // 4. Time Filter: Check-out
    if (checkOutFrom && (!r.check_out || r.check_out < checkOutFrom)) return false;
    if (checkOutTo && (!r.check_out || r.check_out > checkOutTo)) return false;

    return true;
  });

  const filteredSummary = summary.filter(s =>
    !searchTerm ||
    s.employee_name.includes(searchTerm) ||
    s.employee_code.includes(searchTerm) ||
    (s.department && s.department.includes(searchTerm))
  );

  // Selection handlers
  const toggleSelectRecord = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredRecords.map(r => r.id);
    setSelectedIds(new Set(allFilteredIds));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800">تسجيل ومتابعة الحضور والانصراف</h1>
            <p className="text-xs md:text-sm text-slate-500">
              تحديد متعدد، منح إضافي جماعي، تسجيل غياب (0.5 يوم ومضاعفاتها)، فلتر أوقات الحضور والبصمة، وربط الماكينات
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh / Sync from Cloud */}
          <button
            onClick={async () => {
              try {
                setLoading(true);
                await fetchJson('/sync/pull?full=false').catch(() => {});
                await loadData();
              } catch (e) {
                console.error(e);
                loadData();
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs md:text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all border border-blue-200"
            title="تحديث وسحب أحدث البصمات من السحابة"
          >
            <RefreshCw className={`w-4 h-4 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
            تحديث البصمات
          </button>

          {/* ZKTeco Link Button */}
          {setParentTab && (
            <button
              onClick={() => setParentTab('biometric')}
              className="flex items-center gap-2 px-3.5 py-2 text-xs md:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all border border-slate-200"
            >
              <Cpu className="w-4 h-4 text-blue-600" />
              ماكينة البصمة ZKTeco
            </button>
          )}

          {/* Download Template */}
          <a
            href="/api/attendance/template/download"
            className="flex items-center gap-2 px-3.5 py-2 text-xs md:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
            download
          >
            <Download className="w-4 h-4 text-slate-500" />
            قالب إكسيل
          </a>

          {/* Import Attendance */}
          <button
            onClick={() => {
              setImportPreview(null);
              setImportMessage(null);
              setImportFile(null);
              setShowImportModal(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 text-xs md:text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-all border border-emerald-200"
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            استيراد إكسيل
          </button>

          {/* Quick Record */}
          <button
            onClick={() => {
              setEditingRecord(null);
              setEntryData({
                employee_code: '',
                date: new Date().toISOString().split('T')[0],
                status: 'حاضر',
                check_in: '08:00',
                check_out: '16:00',
                late_minutes: 0,
                overtime_days: 0,
                absence_days: 0,
                is_absent: false,
                is_annual_leave: false,
                is_overnight: false,
                notes: ''
              });
              setShowEntryModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            تسجيل حركة سريعة
          </button>
        </div>
      </div>

      {/* Control Bar: Filters, Year, Month, Dates */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Year */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">السنة</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Month */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">الشهر</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl font-bold"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                <option key={m} value={m}>شهر {m}</option>
              ))}
            </select>
          </div>

          {/* Date from */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-500">من تاريخ</label>
              {startDate && (
                <button
                  onClick={() => setStartDate('')}
                  className="text-[10px] text-rose-500 hover:underline cursor-pointer"
                >
                  إلغاء
                </button>
              )}
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full py-1.5 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white"
            />
          </div>

          {/* Date to */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-500">إلى تاريخ</label>
              {endDate && (
                <button
                  onClick={() => setEndDate('')}
                  className="text-[10px] text-rose-500 hover:underline cursor-pointer"
                >
                  إلغاء
                </button>
              )}
            </div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full py-1.5 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white"
            />
          </div>

          {/* Search */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">بحث سريع</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="بالكود أو اسم الموظف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-9 pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Advanced Punch & Time Range Filters Bar */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50/70 p-3 rounded-xl text-xs">
          {/* Punch Status Filter */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">تصفية حالة البصمة</label>
            <select
              value={punchFilter}
              onChange={(e) => setPunchFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-medium"
            >
              <option value="all">الكل (جميع الحالات)</option>
              <option value="missing_either">⚠️ بدون بصمة حضور أو انصراف (ناقصة)</option>
              <option value="missing_both">❌ بدون أي بصمة إطلاقاً (غياب غير مبرر)</option>
              <option value="has_punch">✅ مسجل بها بصمة</option>
            </select>
          </div>

          {/* Check-in time range */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">وقت الحضور (من - إلى)</label>
            <div className="flex items-center gap-1">
              <input
                type="text"
                placeholder="00:01"
                value={checkInFrom}
                onChange={(e) => setCheckInFrom(e.target.value)}
                className="w-1/2 px-2 py-1 bg-white border border-slate-200 rounded font-mono text-center"
                title="من ساعة (مثال: 00:01)"
              />
              <span className="text-slate-400">-</span>
              <input
                type="text"
                placeholder="01:00"
                value={checkInTo}
                onChange={(e) => setCheckInTo(e.target.value)}
                className="w-1/2 px-2 py-1 bg-white border border-slate-200 rounded font-mono text-center"
                title="إلى ساعة (مثال: 01:00)"
              />
            </div>
          </div>

          {/* Check-out time range */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">وقت الانصراف (من - إلى)</label>
            <div className="flex items-center gap-1">
              <input
                type="text"
                placeholder="16:00"
                value={checkOutFrom}
                onChange={(e) => setCheckOutFrom(e.target.value)}
                className="w-1/2 px-2 py-1 bg-white border border-slate-200 rounded font-mono text-center"
              />
              <span className="text-slate-400">-</span>
              <input
                type="text"
                placeholder="18:00"
                value={checkOutTo}
                onChange={(e) => setCheckOutTo(e.target.value)}
                className="w-1/2 px-2 py-1 bg-white border border-slate-200 rounded font-mono text-center"
              />
            </div>
          </div>

          {/* Quick selection of filtered results */}
          <div className="flex items-end gap-1.5">
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              className="flex-1 py-1.5 px-3 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg font-bold transition-all text-center"
            >
              تحديد كل النتائج ({filteredRecords.length})
            </button>
            {(punchFilter !== 'all' || checkInFrom || checkInTo || checkOutFrom || checkOutTo) && (
              <button
                type="button"
                onClick={() => {
                  setPunchFilter('all');
                  setCheckInFrom('');
                  setCheckInTo('');
                  setCheckOutFrom('');
                  setCheckOutTo('');
                }}
                className="py-1.5 px-2 bg-slate-200 text-slate-600 hover:bg-slate-300 rounded-lg text-[11px]"
                title="إلغاء الفلاتر"
              >
                تفريغ
              </button>
            )}
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={() => setActiveTab('daily')}
            className={`px-4 py-1.5 text-xs md:text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'daily'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            سجل الحركات اليومية والتعديل ({filteredRecords.length})
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-1.5 text-xs md:text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'summary'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ملخص الشهر للمرتبات بالأيام ({filteredSummary.length} موظف)
          </button>
          <button
            onClick={() => setActiveTab('holidays')}
            className={`px-4 py-1.5 text-xs md:text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'holidays'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            📅 الإجازات الرسمية والعطلات ({holidays.length})
          </button>
        </div>
      </div>

      {/* Floating Bulk Actions Bar when rows are selected */}
      {selectedIds.size > 0 && activeTab === 'daily' && (
        <div className="sticky top-4 z-30 bg-slate-900 text-white p-3.5 rounded-2xl shadow-xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top duration-200">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center font-bold font-mono text-sm">
              {selectedIds.size}
            </span>
            <div>
              <p className="text-xs font-bold text-white">حركة حضور محددة</p>
              <p className="text-[10px] text-slate-400">يمكنك منح إضافي أو تسجيل غياب دفعة واحدة للمحددين</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Bulk Overtime Button */}
            <button
              onClick={() => {
                setBulkOvertimeDays(1.0);
                setBulkOvertimeNotes('');
                setShowBulkOvertimeModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-xs transition-all"
            >
              <Clock className="w-3.5 h-3.5" />
              إعطاء إضافي للمحددين (أيام)
            </button>

            {/* Bulk Absence Button */}
            <button
              onClick={() => {
                setBulkAbsenceDays(1.0);
                setBulkAbsenceNotes('');
                setShowBulkAbsenceModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-xs transition-all"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              تسجيل غياب للمحددين (0.5 يوم ومضاعفاتها)
            </button>

            {/* Bulk Annual Leave Button */}
            <button
              onClick={() => {
                setBulkAnnualLeaveDays(1.0);
                setBulkAnnualLeaveNotes('إجازة سنوية معتمدة');
                setShowBulkAnnualLeaveModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition-all"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              تسجيل إجازة سنوية للمحددين
            </button>

            {/* Cancel selection */}
            <button
              onClick={handleClearSelection}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl"
            >
              إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      

      {/* Main Content Tables */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin ml-2 text-blue-600" />
            <span>جارِ تحميل سجلات الحضور...</span>
          </div>
        ) : activeTab === 'daily' ? (
          /* Daily Log Table with Multi-Selection */
          filteredRecords.length === 0 ? (
            <div className="text-center p-12 text-slate-400">
              <CalendarCheck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="text-base font-medium text-slate-600">لا توجد حركات مطابقة للشروط أو الشهر المحدد</p>
              <p className="text-xs text-slate-400 mt-1">تأكد من إعدادات الفلاتر أو استورد حركات جديدة من إكسيل أو ماكينة البصمة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 select-none">
                  <tr>
                    <th className="py-3 px-3 text-center w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === filteredRecords.length && filteredRecords.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) handleSelectAllFiltered();
                          else handleClearSelection();
                        }}
                        className="rounded border-slate-300 text-blue-600 cursor-pointer"
                        title="تحديد الكل"
                      />
                    </th>
                    <th className="py-3 px-3">القسم</th>
                    <th className="py-3 px-3 text-center">الكود</th>
                    <th className="py-3 px-4 font-bold text-slate-900">الاسم</th>
                    <th className="py-3 px-3 text-center">التاريخ</th>
                    <th className="py-3 px-3 text-center font-bold text-slate-800">اليوم</th>
                    <th className="py-3 px-3 text-center font-bold text-slate-800">حضور</th>
                    <th className="py-3 px-3 text-center font-bold text-slate-800">انصراف</th>
                    <th className="py-3 px-3 text-center font-bold text-rose-700 bg-rose-50/40">غياب (أيام)</th>
                    <th className="py-3 px-3 text-center font-bold text-blue-700 bg-blue-50/40">إضافي (أيام)</th>
                    <th className="py-3 px-3 text-center">حالة اليوم والبت</th>
                    <th className="py-3 px-3 text-center">رصيد الإجازة</th>
                    <th className="py-3 px-3 text-center w-20">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map((rec) => {
                    const isSelected = selectedIds.has(rec.id);
                    const hasCheckIn = !!rec.check_in && rec.check_in !== '-';
                    const hasCheckOut = !!rec.check_out && rec.check_out !== '-';
                    const hasPunch = hasCheckIn || hasCheckOut;
                    const isAbsent = !!rec.is_absent || (rec.absence_days > 0) || (rec.status && rec.status.includes('غياب'));
                    const isApprovedLeave = rec.has_approved_leave || rec.is_annual_leave === 1 || (rec.status && rec.status.includes('سنوية'));
                    const isHoliday = rec.is_holiday === 1 || (rec.status && rec.status.includes('رسمية'));
                    const isWeekend = rec.is_weekend === 1 || (rec.status && rec.status.includes('أسبوعية'));
                    
                    // اليوم الذي لا يوجد له بصمة حضور وغياب (يحتاج بت فوري)
                    const isPendingDecision = rec.is_pending_decision || (!hasPunch && !isAbsent && !isApprovedLeave && !isHoliday && !isWeekend);

                    let rowClass = 'hover:bg-slate-50/80';
                    if (isSelected) {
                      rowClass = 'bg-blue-50/70 font-semibold';
                    } else if (isPendingDecision) {
                      // تلوين مميز جداً للصف للبت في هذا اليوم (غياب بدون إذن أو يحتاج قرار)
                      rowClass = 'bg-amber-100/85 hover:bg-amber-200/90 border-r-4 border-r-amber-500 font-semibold text-amber-950 shadow-2xs';
                    } else if (isWeekend) {
                      // إجازة أسبوعية (الجمعة / الأحد)
                      rowClass = 'bg-sky-50/80 hover:bg-sky-100/80 border-r-4 border-r-sky-500 font-medium text-sky-950';
                    } else if (isHoliday) {
                      // إجازة رسمية
                      rowClass = 'bg-purple-50/70 hover:bg-purple-100/70 border-r-4 border-r-purple-500 font-medium';
                    } else if (isAbsent) {
                      // غياب
                      rowClass = 'bg-rose-50/60 hover:bg-rose-50/90 border-r-4 border-r-rose-400';
                    } else if (isApprovedLeave) {
                      // إجازة سنوية
                      rowClass = 'bg-emerald-50/50 hover:bg-emerald-50/80 border-r-4 border-r-emerald-500';
                    }

                    return (
                      <tr key={rec.id || `virtual_${rec.employee_code}_${rec.date}`} className={`transition-colors ${rowClass}`}>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRecord(rec.id)}
                            className="rounded border-slate-300 text-blue-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-700">{rec.department || '-'}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-700 bg-blue-50/30">
                          {rec.employee_code}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{rec.employee_name}</td>
                        
                        {/* عمود التاريخ */}
                        <td className="py-2.5 px-3 text-center font-mono text-slate-600">{rec.date}</td>

                        {/* عمود اليوم بعد التاريخ مباشرة */}
                        <td className="py-2.5 px-3 text-center font-semibold text-slate-700 bg-slate-50/50">
                          {rec.day_name || getArabicDay(rec.date)}
                        </td>

                        {/* Clean formatted time */}
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">
                          {rec.check_in ? (
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800">{rec.check_in}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">
                          {rec.check_out ? (
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800">{rec.check_out}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Absence in Days (0.5, 1, ...) */}
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-rose-700 bg-rose-50/30">
                          {rec.is_absent ? (
                            <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded">
                              {rec.absence_days || 1} يوم
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>

                        {/* Overtime in Days (Min 0.5) */}
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-700 bg-blue-50/30">
                          {rec.overtime_days > 0 ? (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded">
                              {rec.overtime_days} يوم
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>

                        {/* Status Badge with Decisions / Warning */}
                        <td className="py-2.5 px-3 text-center font-sans">
                          {isPendingDecision ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold bg-amber-200 text-amber-950 rounded-lg border border-amber-300 shadow-2xs">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                                ⚠️ بدون بصمة (يحتاج بت)
                              </span>
                              {/* أزرار البت السريع */}
                              <div className="flex items-center gap-1 mt-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleQuickDecision(rec.employee_code, rec.date, 'absence')}
                                  className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded cursor-pointer transition-colors"
                                  title="اعتماد هذا اليوم كـ غياب بدون إذن"
                                >
                                  غياب
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickDecision(rec.employee_code, rec.date, 'weekend')}
                                  className="px-1.5 py-0.5 text-[9px] font-bold bg-sky-600 hover:bg-sky-700 text-white rounded cursor-pointer transition-colors"
                                  title="اعتماد هذا اليوم كـ إجازة أسبوعية"
                                >
                                  أسبوعي
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickDecision(rec.employee_code, rec.date, 'holiday')}
                                  className="px-1.5 py-0.5 text-[9px] font-bold bg-purple-700 hover:bg-purple-800 text-white rounded cursor-pointer transition-colors"
                                  title="اعتماد هذا اليوم كـ إجازة رسمية مدفوعة"
                                >
                                  رسمية
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickDecision(rec.employee_code, rec.date, 'annual')}
                                  className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded cursor-pointer transition-colors"
                                  title="اعتماد هذا اليوم كـ إجازة سنوية"
                                >
                                  سنوي
                                </button>
                              </div>
                            </div>
                          ) : isWeekend ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-sky-100 text-sky-900 rounded-lg border border-sky-200">
                                🏖️ {rec.status}
                              </span>
                              <div className="flex items-center gap-1 mt-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleQuickDecision(rec.employee_code, rec.date, 'absence')}
                                  className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded cursor-pointer"
                                  title="تحويل إلى غياب"
                                >
                                  غياب
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickDecision(rec.employee_code, rec.date, 'holiday')}
                                  className="px-1.5 py-0.5 text-[9px] font-bold bg-purple-700 hover:bg-purple-800 text-white rounded cursor-pointer"
                                  title="تحويل إلى إجازة رسمية"
                                >
                                  رسمية
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickDecision(rec.employee_code, rec.date, 'present')}
                                  className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded cursor-pointer"
                                  title="تسجيل كـ حاضر"
                                >
                                  حاضر
                                </button>
                              </div>
                            </div>
                          ) : isHoliday ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-purple-100 text-purple-900 rounded-lg border border-purple-200 shadow-2xs">
                              🎉 {rec.status}
                            </span>
                          ) : isApprovedLeave ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-200">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              {rec.status}
                            </span>
                          ) : (
                            <span className={`inline-block px-2 py-0.5 text-[11px] font-bold rounded-lg ${
                              rec.status === 'حاضر'
                                ? 'bg-emerald-50 text-emerald-700'
                                : rec.status.includes('غياب')
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {rec.status}
                            </span>
                          )}
                        </td>

                        {/* Leave Balance Remaining */}
                        <td className="py-2.5 px-3 text-center font-mono text-[11px]">
                          {rec.is_annual_leave || isApprovedLeave ? (
                            <span className={`font-semibold ${rec.balance_permits ? 'text-emerald-700' : 'text-rose-600'}`}>
                              {rec.balance_permits ? `رصيد يسمح (${rec.remaining_balance} ي)` : 'نفذ الرصيد'}
                            </span>
                          ) : (
                            <span className="text-slate-400">{rec.remaining_balance} ي</span>
                          )}
                        </td>

                        {/* Actions: Edit and Delete */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenEdit(rec)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="تعديل حركة الحضور"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteRecord(rec.id, rec.employee_name, rec.date)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="حذف حركة الحضور"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : activeTab === 'summary' ? (
          /* Monthly Summary with Days metrics (Remaining Leaves & Loans added, Delay removed) */
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-center">الكود</th>
                  <th className="py-3 px-4 font-bold text-slate-900">اسم الموظف</th>
                  <th className="py-3 px-3">القسم</th>
                  <th className="py-3 px-3 text-center font-bold text-emerald-700 bg-emerald-50/50">أيام الحضور</th>
                  <th className="py-3 px-3 text-center font-bold text-rose-700 bg-rose-50/50">أيام الغياب</th>
                  <th className="py-3 px-3 text-center font-bold text-blue-700 bg-blue-50/50">أيام الإضافي (يوم)</th>
                  <th className="py-3 px-3 text-center font-bold text-amber-700 bg-amber-50/50">إجازات سنوية</th>
                  <th className="py-3 px-3 text-center font-bold text-emerald-800 bg-emerald-100/50">باقي الإجازات السنوي</th>
                  <th className="py-3 px-3 text-center font-bold text-purple-800 bg-purple-100/50">باقي السلف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredSummary.map((sum) => (
                  <tr key={sum.employee_id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 text-center font-bold text-blue-700 bg-blue-50/20">
                      {sum.employee_code}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800 font-sans">{sum.employee_name}</td>
                    <td className="py-3 px-3 text-slate-600 font-sans">{sum.department}</td>
                    <td className="py-3 px-3 text-center font-bold text-emerald-700">
                      {sum.present_days} يوم
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-rose-700">
                      {sum.absent_days} يوم
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-blue-700 bg-blue-50/30">
                      {sum.total_overtime_days} يوم
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-amber-700">
                      {sum.annual_leave_days} يوم
                    </td>
                    {/* Remaining Annual Leave Balance */}
                    <td className="py-3 px-3 text-center font-bold text-emerald-800 bg-emerald-50/50">
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900">
                        {sum.remaining_annual_leave_balance || 0} يوم
                      </span>
                    </td>
                    {/* Remaining Loan Balance */}
                    <td className="py-3 px-3 text-center font-bold text-purple-800 bg-purple-50/50">
                      <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-900">
                        {(sum.remaining_loan_balance || 0).toLocaleString()} ج.م
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Official Holidays Management Tab */
          <div className="p-6 space-y-6">
            {/* Rules & Info Banner */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-5 flex items-start gap-4 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-purple-950 text-base">نظام الإجازات الرسمية والعطلات مدفوعة الأجر (حساب الشهر 30 يوماً)</h3>
                <p className="text-xs text-purple-800 leading-relaxed">
                  طبقاً لقانون العمل المصري ولوائح الشركة، يُحسب الراتب الشهري على أساس <strong>30 يوماً</strong>. الإجازات الرسمية والعطلات المعتمدة تعتبر أيام عمل مدفوعة الأجر بالكامل ولا يُخصم منها أي مليم من الراتب، وتظهر في كشف الحركات اليومية بلون بنفسجي مميز.
                </p>
              </div>
            </div>

            {/* Form to Add New Official Holiday */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 border-slate-100">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-purple-600" />
                  إضافة إجازة أو عطلة رسمية جديدة
                </h4>
                <button
                  type="button"
                  onClick={handleApplyAllHolidays}
                  disabled={applyingHolidays}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${applyingHolidays ? 'animate-spin' : ''}`} />
                  {applyingHolidays ? 'جارِ التطبيق...' : `تطبيق جميع إجازات الشهر (${month}/${year}) على حضور الموظفين`}
                </button>
              </div>

              <form onSubmit={handleSaveHoliday} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">اسم الإجازة / المناسبة الرسمية *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: عيد الفطر المبارك / 6 أكتوبر"
                    value={holidayForm.name}
                    onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">تاريخ الإجازة *</label>
                  <input
                    type="date"
                    required
                    value={holidayForm.holiday_date}
                    onChange={(e) => setHolidayForm({ ...holidayForm, holiday_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">ملاحظات وبيان</label>
                  <input
                    type="text"
                    placeholder="مثال: إجازة رسمية معتمدة"
                    value={holidayForm.notes}
                    onChange={(e) => setHolidayForm({ ...holidayForm, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={savingHoliday}
                    className="w-full py-2 px-4 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl shadow-xs transition-all disabled:opacity-50"
                  >
                    {savingHoliday ? 'جارِ الحفظ...' : '+ حفظ الإجازة الرسمية'}
                  </button>
                </div>

                <div className="md:col-span-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-600 font-medium text-xs">
                    <input
                      type="checkbox"
                      checked={holidayForm.autoApplyToAttendance}
                      onChange={(e) => setHolidayForm({ ...holidayForm, autoApplyToAttendance: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded border-slate-300"
                    />
                    <span>تطبيق هذه الإجازة فوراً على سجل حضور جميع الموظفين كـ "إجازة رسمية مدفوعة" لهذا اليوم</span>
                  </label>
                </div>
              </form>
            </div>

            {/* Table of Registered Holidays */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="bg-slate-100 p-3 flex justify-between items-center text-xs font-bold text-slate-700">
                <span>جدول الإجازات والعطلات الرسمية المسجلة لسنة ({year}): {holidays.length} إجازة</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4 text-center">التاريخ</th>
                      <th className="py-2.5 px-4 text-center">اليوم</th>
                      <th className="py-2.5 px-4 font-bold text-slate-900">المناسبة / الإجازة</th>
                      <th className="py-2.5 px-4">البيان والملاحظات</th>
                      <th className="py-2.5 px-4 text-center">الحالة بالراتب</th>
                      <th className="py-2.5 px-4 text-center w-20">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {holidays.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">لا توجد إجازات رسمية مسجلة لهذه السنة</td>
                      </tr>
                    ) : (
                      holidays.map(h => (
                        <tr key={h.id} className="hover:bg-purple-50/30 transition-colors">
                          <td className="py-3 px-4 text-center font-mono font-bold text-purple-900">{h.holiday_date}</td>
                          <td className="py-3 px-4 text-center font-semibold text-slate-700 bg-slate-50/50">{getArabicDay(h.holiday_date)}</td>
                          <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                            {h.name}
                          </td>
                          <td className="py-3 px-4 text-slate-600">{h.notes || 'إجازة رسمية مدفوعة الأجر'}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              مدفوعة الأجر بالكامل (30 يوماً)
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenEditHoliday(h)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title="تعديل الإجازة الرسمية"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteHoliday(h.id, h.name)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="حذف الإجازة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Overtime Modal */}
      {showBulkOvertimeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-slate-800 text-base">منح إضافي جماعي للمحددين</h3>
              <button onClick={() => setShowBulkOvertimeModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleBulkOvertimeSubmit} className="space-y-4 text-sm">
              <div className="p-3 bg-blue-50 text-blue-800 rounded-xl text-xs font-semibold">
                سيتم تطبيق الإضافي على عدد ({selectedIds.size}) موظف تم تحديدهم
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  أيام الإضافي (أقل قيمة 0.5 يوم) *
                </label>
                <select
                  value={bulkOvertimeDays}
                  onChange={(e) => setBulkOvertimeDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono font-bold text-blue-700"
                >
                  <option value={0.5}>0.5 يوم (نصف يوم إضافي)</option>
                  <option value={1.0}>1.0 يوم (يوم كامل إضافي)</option>
                  <option value={1.5}>1.5 يوم (يوم ونصف إضافي)</option>
                  <option value={2.0}>2.0 يوم (يومان إضافي)</option>
                  <option value={2.5}>2.5 يوم</option>
                  <option value={3.0}>3.0 يوم</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">بيان / ملاحظات</label>
                <input
                  type="text"
                  placeholder="مثال: إضافي مأمورية أو عمل ليلي"
                  value={bulkOvertimeNotes}
                  onChange={(e) => setBulkOvertimeNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkOvertimeModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs"
                >
                  تأكيد الإضافي
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      

{/* Bulk Annual Leave Modal */}
      {showBulkAnnualLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-slate-800 text-base">تسجيل إجازة سنوية جماعية للمحددين</h3>
              <button onClick={() => setShowBulkAnnualLeaveModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleBulkAnnualLeaveSubmit} className="space-y-4 text-sm">
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold">
                سيتم احتساب إجازة سنوية لعدد ({selectedIds.size}) موظف محدد وخصمها من رصيد إجازاتهم السنوية ولا يتم احتسابها كغياب.
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  تاريخ الإجازة *
                </label>
                <input
                  type="date"
                  required
                  value={bulkAnnualLeaveDate}
                  onChange={(e) => setBulkAnnualLeaveDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  المدة (أيام) *
                </label>
                <select
                  value={bulkAnnualLeaveDays}
                  onChange={(e) => setBulkAnnualLeaveDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono font-bold text-emerald-700"
                >
                  <option value={1.0}>1.0 يوم (يوم إجازة سنوي كامل)</option>
                  <option value={0.5}>0.5 يوم (نصف يوم سنوي)</option>
                  <option value={2.0}>2.0 يوم</option>
                  <option value={3.0}>3.0 يوم</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ملاحظات / سبب الإجازة</label>
                <input
                  type="text"
                  placeholder="مثال: إجازة سنوية بمناسبة العيد"
                  value={bulkAnnualLeaveNotes}
                  onChange={(e) => setBulkAnnualLeaveNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkAnnualLeaveModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs"
                >
                  تأكيد الإجازة السنوية
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Absence Modal */}
      {showBulkAbsenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-slate-800 text-base">تسجيل غياب جماعي للمحددين</h3>
              <button onClick={() => setShowBulkAbsenceModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleBulkAbsenceSubmit} className="space-y-4 text-sm">
              <div className="p-3 bg-rose-50 text-rose-800 rounded-xl text-xs font-semibold">
                سيتم تسجيل الغياب لعدد ({selectedIds.size}) موظف، ويؤثر مباشرة في الرواتب واستقطاع الضرائب
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  أيام الغياب (نصف يوم ومضاعفاتها) *
                </label>
                <select
                  value={bulkAbsenceDays}
                  onChange={(e) => setBulkAbsenceDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono font-bold text-rose-700"
                >
                  <option value={0.5}>0.5 يوم (غياب نصف يوم)</option>
                  <option value={1.0}>1.0 يوم (غياب يوم كامل)</option>
                  <option value={1.5}>1.5 يوم (غياب يوم ونصف)</option>
                  <option value={2.0}>2.0 يوم (غياب يومين)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">بيان / سبب الغياب</label>
                <input
                  type="text"
                  placeholder="مثال: غياب بدون إذن أو تأخير شديد"
                  value={bulkAbsenceNotes}
                  onChange={(e) => setBulkAbsenceNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkAbsenceModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs"
                >
                  تأكيد الغياب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      

      {/* Edit / Quick Entry Modal */}
      {showEntryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">
                {editingRecord ? `تعديل حركة حضور: ${editingRecord.employee_name}` : 'تسجيل حركة حضور جديدة'}
              </h2>
              <button
                onClick={() => setShowEntryModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="p-5 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                {!editingRecord && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">كود الموظف *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: 1001 أو 360"
                      value={entryData.employee_code}
                      onChange={(e) => setEntryData({ ...entryData, employee_code: e.target.value })}
                      className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">التاريخ *</label>
                  <input
                    type="date"
                    required
                    disabled={!!editingRecord}
                    value={entryData.date}
                    onChange={(e) => setEntryData({ ...entryData, date: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">وقت الحضور (HH:MM)</label>
                  <input
                    type="text"
                    placeholder="08:00"
                    value={entryData.check_in}
                    onChange={(e) => setEntryData({ ...entryData, check_in: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">وقت الانصراف (HH:MM)</label>
                  <input
                    type="text"
                    placeholder="16:00"
                    value={entryData.check_out}
                    onChange={(e) => setEntryData({ ...entryData, check_out: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">الحالة</label>
                  <select
                    value={entryData.status}
                    onChange={(e) => {
                      const st = e.target.value;
                      const isAbs = st.includes('غياب');
                      setEntryData({
                        ...entryData,
                        status: st,
                        is_absent: isAbs,
                        absence_days: isAbs ? (st.includes('نصف') ? 0.5 : 1.0) : 0,
                        is_annual_leave: st.includes('سنوي')
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="حاضر">حاضر</option>
                    <option value="غياب">غياب (يوم كامل)</option>
                    <option value="غياب نصف يوم">غياب نصف يوم (0.5)</option>
                    <option value="إجازة سنوية">إجازة سنوية</option>
                    <option value="مأمورية">مأمورية</option>
                    <option value="راحة أسبوعية">راحة أسبوعية</option>
                  </select>
                </div>

                {/* Absence days field */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    أيام الغياب (0.5 ومضاعفاتها)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="0 أو 0.5 أو 1"
                    value={entryData.absence_days}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setEntryData({
                        ...entryData,
                        absence_days: val,
                        is_absent: val > 0,
                        status: val === 0.5 ? 'غياب نصف يوم' : (val > 0 ? 'غياب' : 'حاضر')
                      });
                    }}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl font-bold text-rose-700"
                  />
                </div>

                {/* Overtime Days field */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    أيام الإضافي (أقل 0.5 يوم)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="0 أو 0.5 أو 1 أو 1.5"
                    value={entryData.overtime_days}
                    onChange={(e) => setEntryData({ ...entryData, overtime_days: Number(e.target.value) })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl font-bold text-blue-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">دقائق التأخير</label>
                  <input
                    type="number"
                    value={entryData.late_minutes}
                    onChange={(e) => setEntryData({ ...entryData, late_minutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">ملاحظات</label>
                  <input
                    type="text"
                    value={entryData.notes}
                    onChange={(e) => setEntryData({ ...entryData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEntryModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs"
                >
                  {editingRecord ? 'حفظ تعديلات الحركة' : 'حفظ الحركة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      

      {/* Attendance Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">استيراد شيت الحضور والانصراف</h2>
                  <p className="text-xs text-slate-500">معاينة الأوقات الفاعلة (HH:MM)، احتساب الإضافي بالأيام، وفحص الإجازات</p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="border-2 border-dashed border-slate-200 hover:border-emerald-400 bg-slate-50/50 rounded-2xl p-6 text-center transition-all">
                <Upload className="w-10 h-10 mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-semibold text-slate-700 mb-1">اختر ملف إكسيل للحضور والانصراف (.xlsx أو .xls)</p>
                <p className="text-xs text-slate-400 mb-4">يجب أن يحتوي الملف على أعمدة: الكود، الاسم، التاريخ، الحضور، الانصراف</p>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="block mx-auto text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer"
                />
              </div>

              {importPreview && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                    <div>
                      <p className="text-xs font-bold text-emerald-900">
                        تمت قراءة الملف بنجاح: {importPreview.totalRows} حركة حضور
                      </p>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        تم ربط {importPreview.matchedEmployees} موظفاً بقاعدة البيانات
                      </p>
                    </div>
                    <button
                      onClick={handleConfirmImport}
                      disabled={isUploading}
                      className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all disabled:opacity-50"
                    >
                      {isUploading ? 'جارِ التأكيد...' : 'تأكيد وحفظ في سجل الحضور'}
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                        <tr>
                          <th className="p-2">الكود</th>
                          <th className="p-2">الاسم</th>
                          <th className="p-2">التاريخ</th>
                          <th className="p-2">حضور</th>
                          <th className="p-2">انصراف</th>
                          <th className="p-2">إضافي (أيام)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {importPreview.items.slice(0, 30).map((row, idx) => (
                          <tr key={idx}>
                            <td className="p-2 font-bold text-blue-700">{row.employee_code}</td>
                            <td className="p-2 font-sans font-medium">{row.employee_name}</td>
                            <td className="p-2">{row.date}</td>
                            <td className="p-2 text-emerald-700 font-bold">{row.check_in || '-'}</td>
                            <td className="p-2 text-emerald-700 font-bold">{row.check_out || '-'}</td>
                            <td className="p-2 text-blue-700 font-bold">{row.overtime_days || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      
      {/* Edit Official Holiday Modal */}
      {showEditHolidayModal && editingHoliday && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-purple-600" />
                تعديل الإجازة الرسمية
              </h3>
              <button 
                onClick={() => { setShowEditHolidayModal(false); setEditingHoliday(null); }} 
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateHoliday} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">اسم المناسبة / الإجازة *</label>
                <input
                  type="text"
                  required
                  value={editHolidayForm.name}
                  onChange={(e) => setEditHolidayForm({ ...editHolidayForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">تاريخ الإجازة *</label>
                <input
                  type="date"
                  required
                  value={editHolidayForm.holiday_date}
                  onChange={(e) => setEditHolidayForm({ ...editHolidayForm, holiday_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ملاحظات وبيان</label>
                <input
                  type="text"
                  value={editHolidayForm.notes}
                  onChange={(e) => setEditHolidayForm({ ...editHolidayForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setShowEditHolidayModal(false); setEditingHoliday(null); }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl shadow-xs"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
