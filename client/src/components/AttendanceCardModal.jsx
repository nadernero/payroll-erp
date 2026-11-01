import React, { useState, useEffect } from 'react';
import { 
  X, Printer, Calendar, Building2, ShieldCheck, 
  ChevronRight, ChevronLeft, CheckCircle2, Clock, Loader2
} from 'lucide-react';
import { fetchJson } from '../utils/api';

// Unified helper to determine true absence days (0, 0.5, 1, etc.)
function getAbsenceValue(r) {
  if (!r) return 0;
  if (r.is_holiday === 1 || !!r.holiday_name || (r.status && (r.status.includes('رسمية') || r.status.includes('أسبوعية')))) {
    return 0;
  }
  const statusStr = String(r.status || '');
  const isExplicitAbsent = r.is_absent === 1 || statusStr.includes('غياب');

  if (isExplicitAbsent) {
    if (r.absence_days === 0.5 || statusStr.includes('نصف') || statusStr.includes('0.5')) {
      return 0.5;
    }
    const num = Number(r.absence_days);
    return num > 0 ? num : 1.0;
  }

  const num = Number(r.absence_days);
  if (num > 0 && num < 1) {
    return num; // partial deduction like 0.5 day
  }

  return 0;
}

export default function AttendanceCardModal({ 
  records = [], 
  summary = [], 
  employees = [],
  initialEmployeeCode = '',
  year, 
  month, 
  startDate, 
  endDate,
  onClose 
}) {
  const [selectedCode, setSelectedCode] = useState(initialEmployeeCode || (summary[0]?.employee_code || ''));
  const [printAll, setPrintAll] = useState(false);
  const [paperSize, setPaperSize] = useState('A4'); // 'A4' or 'A5'
  const [fetchedRecords, setFetchedRecords] = useState({});
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);

  // Auto fetch employee attendance records if not already in the passed `records`
  useEffect(() => {
    if (!selectedCode) return;
    const existing = records.filter(r => String(r.employee_code).trim() === String(selectedCode).trim());
    if (existing.length === 0 && !fetchedRecords[selectedCode]) {
      setIsLoadingRecords(true);
      const q = year && month 
        ? `?year=${year}&month=${month}&employeeCode=${selectedCode}` 
        : `?startDate=${startDate || ''}&endDate=${endDate || ''}&employeeCode=${selectedCode}`;
      fetchJson(`/attendance${q}`)
        .then(data => {
          if (Array.isArray(data)) {
            setFetchedRecords(prev => ({ ...prev, [selectedCode]: data }));
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingRecords(false));
    }
  }, [selectedCode, year, month, startDate, endDate, records, fetchedRecords]);

  // Load company profile from localStorage
  const [companyProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('company_profile');
      return saved ? JSON.parse(saved) : {
        name: 'اسم المؤسسة / الشركة',
        activity: 'إدارة الموارد البشرية وشؤون العاملين',
        cr: 'س.ت: 123456',
        tax_card: 'ب.ض: 100-200-300',
        logo: ''
      };
    } catch {
      return {
        name: 'اسم المؤسسة / الشركة',
        activity: 'إدارة الموارد البشرية وشؤون العاملين',
        cr: 'س.ت: 123456',
        tax_card: 'ب.ض: 100-200-300',
        logo: ''
      };
    }
  });

  // Arabic Month Names
  const arabicMonths = [
    '', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  const monthLabel = month ? `${arabicMonths[Number(month)]} ${year}` : `${year}`;
  const periodLabel = startDate && endDate ? `من ${startDate} إلى ${endDate}` : `شهر ${monthLabel}`;

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // List of employees to show / print
  const employeeList = summary.length > 0 ? summary : employees;
  const currentIndex = employeeList.findIndex(e => String(e.employee_code).trim() === String(selectedCode).trim());

  const handlePrev = () => {
    if (currentIndex > 0) {
      setSelectedCode(employeeList[currentIndex - 1].employee_code);
    }
  };

  const handleNext = () => {
    if (currentIndex < employeeList.length - 1) {
      setSelectedCode(employeeList[currentIndex + 1].employee_code);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Helper to calculate hours between check-in and check-out
  const calculateWorkHours = (inTime, outTime) => {
    if (!inTime || !outTime || inTime === '-' || outTime === '') return '-';
    try {
      const [inH, inM] = inTime.split(':').map(Number);
      const [outH, outM] = outTime.split(':').map(Number);
      let diffMinutes = (outH * 60 + outM) - (inH * 60 + inM);
      if (diffMinutes < 0) diffMinutes += 24 * 60; // overnight
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return `${hours}س ${minutes > 0 ? `${minutes}د` : ''}`;
    } catch {
      return '-';
    }
  };

  // Single card renderer for an employee
  const renderCard = (empCode) => {
    const empInfo = employeeList.find(e => String(e.employee_code).trim() === String(empCode).trim()) || {};
    
    // Employee records for the month sorted chronologically ASC
    const baseRecords = (records.filter(r => String(r.employee_code).trim() === String(empCode).trim()).length > 0)
      ? records.filter(r => String(r.employee_code).trim() === String(empCode).trim())
      : (fetchedRecords[empCode] || []);

    const empRecords = [...baseRecords].sort((a, b) => a.date.localeCompare(b.date));

    // Stats calculation
    let actualPunches = 0;
    let weekendDays = 0;
    let holidayDays = 0;
    let leaveDays = 0;
    let absentDays = 0;
    let overtimeDays = 0;

    empRecords.forEach(r => {
      const hasIn = !!r.check_in && r.check_in.trim() !== '' && r.check_in !== '-';
      const hasOut = !!r.check_out && r.check_out.trim() !== '' && r.check_out !== '-';
      const hasPunch = hasIn || hasOut;
      const isHol = r.is_holiday === 1 || !!r.holiday_name || (r.status && r.status.includes('رسمية'));
      const isWknd = (r.status && r.status.includes('أسبوعية')) || (!r.is_absent && (!r.absence_days || r.absence_days === 0) && (r.is_weekend === 1 || r.day_name === 'الجمعة' || r.day_name === 'الأحد'));
      const isAnn = r.has_approved_leave || r.is_annual_leave === 1 || (r.status && r.status.includes('سنوية'));

      // Absence parsing (including 0.5 day)
      const absVal = getAbsenceValue(r);

      if (isHol) {
        holidayDays++;
      } else if (isWknd) {
        weekendDays++;
      } else if (isAnn) {
        leaveDays++;
      } else if (absVal > 0) {
        absentDays += absVal;
        if (hasPunch && absVal === 0.5) {
          actualPunches += 0.5;
        }
      } else if (hasPunch || (r.status && r.status.includes('حاضر'))) {
        actualPunches++;
      }

      if (r.overtime_days > 0) {
        overtimeDays += Number(r.overtime_days);
      }
    });

    // Rule 1: The month is counted as 30 days regardless of calendar length.
    // Total Paid Days = 30 days - absent days
    const totalPaidDays = Math.max(0, 30 - absentDays);

    const isA5 = paperSize === 'A5';

    return (
      <div 
        key={empCode} 
        className={`attendance-card-print-page bg-white rounded-2xl border border-slate-200 shadow-sm print:shadow-none print:border-none ${
          isA5 ? 'p-2 text-[8px]' : 'p-3 md:p-4 text-[9px]'
        }`}
        style={{ direction: 'rtl' }}
      >
        {/* Document Header */}
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 mb-1.5">
          <div className="flex items-center gap-2">
            {companyProfile.logo ? (
              <img 
                src={companyProfile.logo} 
                alt="Logo" 
                className={`${isA5 ? 'w-8 h-8' : 'w-10 h-10'} object-contain rounded-lg border border-slate-200 p-0.5 bg-white`} 
              />
            ) : (
              <div className={`${isA5 ? 'w-8 h-8' : 'w-10 h-10'} rounded-xl bg-gradient-to-br from-blue-700 to-indigo-800 flex items-center justify-center text-white shrink-0`}>
                <Building2 className={`${isA5 ? 'w-4 h-4' : 'w-5 h-5'}`} />
              </div>
            )}
            <div>
              <h2 className={`${isA5 ? 'text-xs' : 'text-sm'} font-black text-slate-900 tracking-tight`}>
                {companyProfile.name}
              </h2>
              <p className="text-[8px] text-slate-500 font-medium">{companyProfile.activity}</p>
            </div>
          </div>

          <div className="text-left bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl px-3 py-1 shadow-2xs">
            <h1 className={`${isA5 ? 'text-[11px]' : 'text-xs'} font-black text-slate-900`}>
              كارتة الحضور والانصراف التفصيلية
            </h1>
            <p className="text-[9px] font-bold text-blue-700 font-mono">
              {periodLabel}
            </p>
          </div>
        </div>

        {/* Employee Info Bar */}
        <div className={`grid grid-cols-4 gap-2 bg-slate-50 border border-slate-200 rounded-xl ${isA5 ? 'py-1 px-2 mb-1.5 text-[8px]' : 'py-1.5 px-3 mb-2 text-[9px]'}`}>
          <div>
            <span className="text-slate-500 font-medium">الموظف: </span>
            <span className="font-bold text-slate-900">{empInfo.employee_name || empInfo.name || '-'}</span>
          </div>
          <div>
            <span className="text-slate-500 font-medium">الكود: </span>
            <span className="font-mono font-black text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded">
              #{empInfo.employee_code || empCode}
            </span>
          </div>
          <div>
            <span className="text-slate-500 font-medium">القسم: </span>
            <span className="font-bold text-slate-800">{empInfo.department || '-'}</span>
          </div>
          <div className="text-left">
            <span className="text-slate-500 font-medium">الطباعة: </span>
            <span className="font-mono font-medium text-slate-600">
              {new Date().toISOString().split('T')[0]}
            </span>
          </div>
        </div>

        {/* Colorful Summary KPI Badges (Single Row) */}
        <div className={`grid grid-cols-7 gap-1.5 ${isA5 ? 'mb-1.5 text-[7.5px]' : 'mb-2 text-[8.5px]'} text-center`}>
          {/* Total Paid Days (30 days - absent) */}
          <div className="bg-indigo-50 border-2 border-indigo-400 rounded-lg p-1 shadow-2xs">
            <span className="block font-black text-indigo-950">حضور مدفوع</span>
            <span className={`${isA5 ? 'text-xs' : 'text-sm'} font-black text-indigo-800 font-mono block`}>{totalPaidDays}</span>
            <span className="text-[7.5px] font-bold text-indigo-600 block">(30 - غياب)</span>
          </div>

          {/* Actual Punches */}
          <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-1 shadow-2xs">
            <span className="block font-bold text-emerald-900">حضور بالبصمة</span>
            <span className={`${isA5 ? 'text-xs' : 'text-sm'} font-black text-emerald-700 font-mono block`}>{actualPunches}</span>
            <span className="text-[7.5px] font-semibold text-emerald-600 block">يوم</span>
          </div>

          {/* Weekend */}
          <div className="bg-sky-50 border border-sky-300 rounded-lg p-1 shadow-2xs">
            <span className="block font-bold text-sky-900">عطلات أسبوعية</span>
            <span className={`${isA5 ? 'text-xs' : 'text-sm'} font-black text-sky-700 font-mono block`}>{weekendDays}</span>
            <span className="text-[7.5px] font-semibold text-sky-600 block">مدفوعة</span>
          </div>

          {/* Holiday */}
          <div className="bg-purple-50 border border-purple-300 rounded-lg p-1 shadow-2xs">
            <span className="block font-bold text-purple-900">إجازات رسمية</span>
            <span className={`${isA5 ? 'text-xs' : 'text-sm'} font-black text-purple-700 font-mono block`}>{holidayDays}</span>
            <span className="text-[7.5px] font-semibold text-purple-600 block">مدفوعة</span>
          </div>

          {/* Annual Leave */}
          <div className="bg-teal-50 border border-teal-300 rounded-lg p-1 shadow-2xs">
            <span className="block font-bold text-teal-900">إجازات سنوية</span>
            <span className={`${isA5 ? 'text-xs' : 'text-sm'} font-black text-teal-700 font-mono block`}>{leaveDays}</span>
            <span className="text-[7.5px] font-semibold text-teal-600 block">مدفوعة</span>
          </div>

          {/* Overtime */}
          <div className="bg-blue-50 border border-blue-300 rounded-lg p-1 shadow-2xs">
            <span className="block font-bold text-blue-900">إضافي (يوم)</span>
            <span className={`${isA5 ? 'text-xs' : 'text-sm'} font-black text-blue-700 font-mono block`}>{overtimeDays}</span>
            <span className="text-[7.5px] font-semibold text-blue-600 block">يوم مستحق</span>
          </div>

          {/* Absence */}
          <div className="bg-rose-50 border-2 border-rose-300 rounded-lg p-1 shadow-2xs">
            <span className="block font-bold text-rose-900">أيام الغياب</span>
            <span className={`${isA5 ? 'text-xs' : 'text-sm'} font-black text-rose-700 font-mono block`}>{absentDays}</span>
            <span className="text-[7.5px] font-bold text-rose-600 block">يوم مستقطع</span>
          </div>
        </div>

        {/* Detailed Color-Coded Table (Fitted to 1 page) */}
        <div className="border border-slate-300 rounded-xl overflow-hidden mb-1.5 flex-1 shadow-2xs">
          <table className="w-full text-right">
            <thead>
              <tr className={`bg-slate-800 text-white font-bold ${isA5 ? 'text-[7.5px]' : 'text-[8.5px]'}`}>
                <th className="py-1 px-1 text-center w-6">م</th>
                <th className="py-1 px-1 text-center">التاريخ</th>
                <th className="py-1 px-1 text-center">اليوم</th>
                <th className="py-1 px-1 text-center">حضور</th>
                <th className="py-1 px-1 text-center">انصراف</th>
                <th className="py-1 px-1 text-center">ساعات</th>
                <th className="py-1 px-1 text-center">إضافي</th>
                <th className="py-1 px-1 text-center">غياب</th>
                <th className="py-1 px-1.5 text-center">الحالة</th>
                <th className="py-1 px-1.5">الملاحظات</th>
              </tr>
            </thead>
            <tbody className={`divide-y divide-slate-200 font-mono ${isA5 ? 'text-[7px]' : 'text-[8px]'}`}>
              {empRecords.map((r, idx) => {
                const hasIn = !!r.check_in && r.check_in.trim() !== '' && r.check_in !== '-';
                const hasOut = !!r.check_out && r.check_out.trim() !== '' && r.check_out !== '-';
                const hasPunch = hasIn || hasOut;
                const isHol = r.is_holiday === 1 || !!r.holiday_name || (r.status && r.status.includes('رسمية'));
                const isWknd = (r.status && r.status.includes('أسبوعية')) || (!r.is_absent && (!r.absence_days || r.absence_days === 0) && (r.is_weekend === 1 || r.day_name === 'الجمعة' || r.day_name === 'الأحد'));
                const isAnn = r.has_approved_leave || r.is_annual_leave === 1 || (r.status && r.status.includes('سنوية'));
                
                // Parse absence value
                const absVal = getAbsenceValue(r);
                const workHours = calculateWorkHours(r.check_in, r.check_out);

                let rowBg = 'bg-white';
                let statusBadge = (
                  <span className="px-1.5 py-0.2 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    حاضر
                  </span>
                );

                if (isHol) {
                  rowBg = 'bg-purple-50/70 border-r-2 border-r-purple-600 font-medium';
                  statusBadge = (
                    <span className="px-1.5 py-0.2 rounded-full font-bold bg-purple-100 text-purple-900 border border-purple-300">
                      {r.holiday_name ? `إجازة رسمية (${r.holiday_name})` : 'إجازة رسمية (مدفوعة)'}
                    </span>
                  );
                } else if (isWknd) {
                  rowBg = 'bg-sky-50/70 border-r-2 border-r-sky-500 font-medium';
                  statusBadge = (
                    <span className="px-1.5 py-0.2 rounded-full font-bold bg-sky-100 text-sky-900 border border-sky-300">
                      عطلة أسبوعية (مدفوعة)
                    </span>
                  );
                } else if (isAnn) {
                  rowBg = 'bg-teal-50/70 border-r-2 border-r-teal-500 font-medium';
                  statusBadge = (
                    <span className="px-1.5 py-0.2 rounded-full font-bold bg-teal-100 text-teal-900 border border-teal-300">
                      إجازة سنوية (مدفوعة)
                    </span>
                  );
                } else if (absVal === 0.5) {
                  // Half day absence modification
                  rowBg = 'bg-amber-50/80 border-r-2 border-r-amber-500 font-medium';
                  statusBadge = (
                    <span className="px-1.5 py-0.2 rounded-full font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      {hasPunch ? 'حاضر (خصم 0.5)' : 'غياب نصف يوم (0.5)'}
                    </span>
                  );
                } else if (absVal >= 1.0) {
                  // Full day absence
                  rowBg = 'bg-rose-50/80 border-r-2 border-r-rose-500 font-medium';
                  statusBadge = (
                    <span className="px-1.5 py-0.2 rounded-full font-bold bg-rose-100 text-rose-900 border border-rose-300">
                      {r.status || 'غياب مستقطع'}
                    </span>
                  );
                } else if (!hasPunch) {
                  rowBg = 'bg-amber-50/50 font-medium';
                  statusBadge = (
                    <span className="px-1.5 py-0.2 rounded-full font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      بدون بصمة
                    </span>
                  );
                }

                return (
                  <tr key={`${empCode}_${r.date}`} className={`${rowBg}`}>
                    <td className="py-[1px] px-1 text-center text-slate-400 font-mono">
                      {idx + 1}
                    </td>
                    <td className="py-[1px] px-1 text-center font-bold text-slate-700 whitespace-nowrap">
                      {r.date}
                    </td>
                    <td className="py-[1px] px-1 text-center font-semibold text-slate-800 font-sans whitespace-nowrap">
                      {r.day_name}
                    </td>
                    <td className="py-[1px] px-1 text-center font-bold text-emerald-700">
                      {r.check_in || '-'}
                    </td>
                    <td className="py-[1px] px-1 text-center font-bold text-blue-700">
                      {r.check_out || '-'}
                    </td>
                    <td className="py-[1px] px-1 text-center text-slate-600 font-sans whitespace-nowrap">
                      {workHours}
                    </td>
                    <td className="py-[1px] px-1 text-center font-bold text-blue-700">
                      {r.overtime_days > 0 ? `${r.overtime_days}ي` : '-'}
                    </td>
                    <td className="py-[1px] px-1 text-center font-bold text-rose-700">
                      {absVal > 0 ? `${absVal}ي` : '-'}
                    </td>
                    <td className="py-[1px] px-1.5 text-center font-sans whitespace-nowrap">
                      {statusBadge}
                    </td>
                    <td className="py-[1px] px-1.5 text-slate-600 font-sans text-[7.5px] truncate max-w-[120px]">
                      {r.holiday_name ? `إجازة: ${r.holiday_name}` : r.notes || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legal Disclaimer & Paid Status Note */}
        <div className={`bg-slate-50 border border-slate-200 rounded-lg p-1 mb-1.5 font-sans flex items-center gap-1.5 ${isA5 ? 'text-[7px]' : 'text-[7.5px]'} text-slate-600`}>
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>
            <strong>نظام الاحتساب:</strong> يُحسب الشهر <strong>30 يوماً</strong>. العطلات الأسبوعية والإجازات الرسمية <strong>مدفوعة الأجر بالكامل</strong>، والحضور المحتسب = <strong>(30 يوم - أيام الغياب إن وجدت)</strong>.
          </span>
        </div>

        {/* Signatures & Approvals Section (Compact Single Row) */}
        <div className={`grid grid-cols-4 gap-2 pt-1 border-t border-slate-300 text-center font-sans ${isA5 ? 'text-[7.5px]' : 'text-[8.5px]'}`}>
          <div className="border border-slate-200 rounded-lg p-1 bg-slate-50/50">
            <span className="block font-bold text-slate-700 mb-2">توقيع الموظف بالعلم</span>
            <span className="block border-b border-dashed border-slate-400 mx-2"></span>
          </div>

          <div className="border border-slate-200 rounded-lg p-1 bg-slate-50/50">
            <span className="block font-bold text-slate-700 mb-2">مسؤول الحضور والانصراف</span>
            <span className="block border-b border-dashed border-slate-400 mx-2"></span>
          </div>

          <div className="border border-slate-200 rounded-lg p-1 bg-slate-50/50">
            <span className="block font-bold text-slate-700 mb-2">مدير الموارد البشرية</span>
            <span className="block border-b border-dashed border-slate-400 mx-2"></span>
          </div>

          <div className="border border-slate-200 rounded-lg p-1 bg-slate-50/50">
            <span className="block font-bold text-slate-700 mb-2">اعتماد المدير العام / الختم</span>
            <span className="block border-b border-dashed border-slate-400 mx-2"></span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/75 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      {/* Dynamic Print Style Block ensuring 1-page fit */}
      <style>{`
        @page {
          size: ${paperSize === 'A5' ? 'A5' : 'A4'} portrait;
          margin: ${paperSize === 'A5' ? '3mm 4mm' : '4mm 5mm'};
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: 100% !important;
          }
          .attendance-card-print-page {
            width: 100% !important;
            height: 98vh !important;
            max-height: 98vh !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            padding: ${paperSize === 'A5' ? '2mm' : '3mm'} !important;
          }
        }
      `}</style>

      <div 
        className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[96vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header Toolbar (Hidden during Print) */}
        <div className="no-print sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 bg-slate-50/95 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-xl shadow-xs">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-black text-slate-800">
                كارتة الحضور والانصراف (PDF ملون - ورقة واحدة)
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                تصدير وطباعة بطاقة الحضور الرسمية على ورقة واحدة بحجم A4 أو A5
              </p>
            </div>
          </div>

          {/* Controls: Paper Size, Employee Selector, Print */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Paper Size Selector */}
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setPaperSize('A4')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  paperSize === 'A4' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                مقاس A4 (ورقة واحدة)
              </button>
              <button
                onClick={() => setPaperSize('A5')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  paperSize === 'A5' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                مقاس A5 (مدمج ورقة واحدة)
              </button>
            </div>

            {/* Scope: Single vs All */}
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setPrintAll(false)}
                className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  !printAll ? 'bg-white text-emerald-800 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الموظف الحالي
              </button>
              <button
                onClick={() => setPrintAll(true)}
                className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  printAll ? 'bg-white text-emerald-800 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                كروت الجميع ({employeeList.length})
              </button>
            </div>

            {/* Employee Selector for single card */}
            {!printAll && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrev}
                  disabled={currentIndex <= 0}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
                  title="الموظف السابق"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <select
                  value={selectedCode}
                  onChange={(e) => setSelectedCode(e.target.value)}
                  className="text-xs font-bold px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 max-w-[180px]"
                >
                  {employeeList.map(e => (
                    <option key={e.employee_code} value={e.employee_code}>
                      {e.employee_code} - {e.employee_name || e.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleNext}
                  disabled={currentIndex >= employeeList.length - 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
                  title="الموظف التالي"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white text-xs font-black rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة / حفظ PDF ({paperSize})</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Container */}
        <div className="overflow-y-auto p-3 md:p-6 bg-slate-100/60 print:bg-white print:p-0">
          {printAll ? (
            <div className="space-y-6 print:space-y-0">
              {employeeList.map(emp => renderCard(emp.employee_code))}
            </div>
          ) : (
            renderCard(selectedCode)
          )}
        </div>
      </div>
    </div>
  );
}
