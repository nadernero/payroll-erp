import ExcelJS from 'exceljs';
import db from './db.js';
import { formatExcelTime } from './routes/attendance.js';

const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/**
 * Generate a beautifully styled, colored Excel Attendance Card workbook.
 * Supports single employee or multiple employees.
 *
 * @param {Object} options
 * @param {number} [options.year]
 * @param {number} [options.month]
 * @param {string} [options.startDate]
 * @param {string} [options.endDate]
 * @param {string[]|string} [options.employeeCodes] - Array of codes or 'all'
 * @param {string} [options.department] - 'all' or specific department name
 * @returns {Promise<ExcelJS.Workbook>}
 */
export async function generateAttendanceCardsWorkbook({
  year,
  month,
  startDate,
  endDate,
  employeeCodes = 'all',
  department = 'all'
}) {
  // 1. Resolve date range
  let startD = startDate;
  let endD = endDate;

  if (!startD && !endD) {
    const cur = new Date();
    const y = year || cur.getFullYear();
    const m = month || cur.getMonth() + 1;
    const mStr = String(m).padStart(2, '0');
    startD = `${y}-${mStr}-01`;
    const daysInMonth = new Date(Number(y), Number(m), 0).getDate();
    endD = `${y}-${mStr}-${String(daysInMonth).padStart(2, '0')}`;
  } else if (!startD && year && month) {
    const mStr = String(month).padStart(2, '0');
    startD = `${year}-${mStr}-01`;
  } else if (!endD && year && month) {
    const mStr = String(month).padStart(2, '0');
    const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
    endD = `${year}-${mStr}-${String(daysInMonth).padStart(2, '0')}`;
  }

  // 2. Build list of calendar days in range
  const dateList = [];
  const [sy, sm, sd] = startD.split('-').map(Number);
  const [ey, em, ed] = endD.split('-').map(Number);
  const curDate = new Date(sy, sm - 1, sd, 12, 0, 0);
  const stopDate = new Date(ey, em - 1, ed, 12, 0, 0);
  while (curDate <= stopDate) {
    const yr = curDate.getFullYear();
    const mo = String(curDate.getMonth() + 1).padStart(2, '0');
    const da = String(curDate.getDate()).padStart(2, '0');
    dateList.push(`${yr}-${mo}-${da}`);
    curDate.setDate(curDate.getDate() + 1);
  }

  // 3. Fetch official holidays in range
  const holidays = db.prepare(`
    SELECT holiday_date, name, notes 
    FROM official_holidays 
    WHERE holiday_date BETWEEN ? AND ?
  `).all(startD, endD);
  const holidayMap = new Map();
  holidays.forEach(h => holidayMap.set(h.holiday_date, h.name));

  // 4. Fetch target employees
  let empQuery = "SELECT * FROM employees WHERE status = 'active'";
  const empParams = [];
  if (Array.isArray(employeeCodes) && employeeCodes.length > 0) {
    const placeholders = employeeCodes.map(() => '?').join(',');
    empQuery += ` AND code IN (${placeholders})`;
    empParams.push(...employeeCodes.map(c => String(c).trim()));
  } else if (employeeCodes && employeeCodes !== 'all') {
    empQuery += " AND code = ?";
    empParams.push(String(employeeCodes).trim());
  }

  if (department && department !== 'all') {
    empQuery += " AND department = ?";
    empParams.push(department);
  }

  empQuery += " ORDER BY seq ASC, CAST(code AS INTEGER) ASC";
  const employees = db.prepare(empQuery).all(...empParams);

  if (employees.length === 0) {
    throw new Error('لم يتم العثور على موظفين مطابقين لخيارات التصدير المحددة.');
  }

  // 5. Fetch approved leaves in range
  const leaves = db.prepare(`
    SELECT employee_id, start_date, end_date, leave_type, status, days_count 
    FROM leaves 
    WHERE status = 'approved' 
      AND ((start_date BETWEEN ? AND ?) OR (end_date BETWEEN ? AND ?))
  `).all(startD, endD, startD, endD);

  // 6. Fetch existing attendance records for target employees in range
  const empCodes = employees.map(e => e.code);
  const codePlaceholders = empCodes.map(() => '?').join(',');
  const attRows = db.prepare(`
    SELECT * 
    FROM attendance 
    WHERE employee_code IN (${codePlaceholders})
      AND date BETWEEN ? AND ?
  `).all(...empCodes, startD, endD);

  const attMap = new Map();
  attRows.forEach(a => {
    attMap.set(`${String(a.employee_code).trim()}_${a.date}`, a);
  });

  // 7. Initialize Workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Payroll ERP';
  workbook.created = new Date();

  // Color Constants (ARGB format for ExcelJS)
  const COLORS = {
    NAVY_DARK: 'FF0F172A',      // Slate 900
    NAVY_PRIMARY: 'FF1E3A8A',   // Blue 900
    BLUE_HEADER: 'FF1E40AF',    // Blue 800
    BLUE_LIGHT: 'FFDBEAFE',     // Blue 100
    BLUE_TEXT: 'FF1D4ED8',      // Blue 700

    GREEN_HEADER: 'FF065F46',   // Emerald 800
    GREEN_LIGHT: 'FFDCFCE7',    // Emerald 100
    GREEN_ROW: 'FFF0FDF4',      // Emerald 50
    GREEN_TEXT: 'FF166534',     // Emerald 800

    PURPLE_HEADER: 'FF581C87',  // Purple 900
    PURPLE_LIGHT: 'FFF3E8FF',   // Purple 100
    PURPLE_ROW: 'FFFAF5FF',     // Purple 50
    PURPLE_TEXT: 'FF6B21A8',    // Purple 700

    RED_HEADER: 'FF991B1B',     // Red 800
    RED_LIGHT: 'FFFEE2E2',      // Red 100
    RED_ROW: 'FFFEF2F2',        // Red 50
    RED_TEXT: 'FFB91C1C',       // Red 700

    AMBER_HEADER: 'FF92400E',   // Amber 800
    AMBER_LIGHT: 'FFFEF3C7',    // Amber 100
    AMBER_ROW: 'FFFEFCE8',      // Amber 50
    AMBER_TEXT: 'FFB45309',     // Amber 700

    ORANGE_LIGHT: 'FFFFEDD5',   // Orange 100
    ORANGE_TEXT: 'FFC2410C',    // Orange 700

    GRAY_HEADER: 'FF334155',    // Slate 700
    GRAY_LIGHT: 'FFF1F5F9',     // Slate 100
    GRAY_BORDER: 'FFCBD5E1',    // Slate 300
    WHITE: 'FFFFFFFF',
    TEXT_DARK: 'FF0F172A'
  };

  const thinBorder = {
    top: { style: 'thin', color: { argb: COLORS.GRAY_BORDER } },
    left: { style: 'thin', color: { argb: COLORS.GRAY_BORDER } },
    bottom: { style: 'thin', color: { argb: COLORS.GRAY_BORDER } },
    right: { style: 'thin', color: { argb: COLORS.GRAY_BORDER } }
  };

  const headerBorder = {
    top: { style: 'medium', color: { argb: COLORS.NAVY_DARK } },
    left: { style: 'thin', color: { argb: COLORS.GRAY_BORDER } },
    bottom: { style: 'medium', color: { argb: COLORS.NAVY_DARK } },
    right: { style: 'thin', color: { argb: COLORS.GRAY_BORDER } }
  };

  // Helper to format cells
  const styleCell = (cell, {
    bgColor = null,
    textColor = COLORS.TEXT_DARK,
    bold = false,
    fontSize = 10,
    align = 'center',
    border = thinBorder
  }) => {
    if (bgColor) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgColor }
      };
    }
    cell.font = {
      name: 'Arial',
      size: fontSize,
      bold,
      color: { argb: textColor }
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: align,
      wrapText: true
    };
    if (border) {
      cell.border = border;
    }
  };

  // Data structure to hold employee calculated monthly stats for the summary sheet
  const employeeSummaries = [];

  // Create Summary Sheet FIRST so it appears as the first tab in Excel
  let summarySheet = null;
  if (employees.length > 1) {
    summarySheet = workbook.addWorksheet('ملخص الحضور العام', {
      views: [{ rightToLeft: true }]
    });
  }

  // -------------------------------------------------------------
  // Loop through each employee to build their Attendance Card Sheet
  // -------------------------------------------------------------
  for (const emp of employees) {
    const empCodeStr = String(emp.code).trim();
    // Sheet name max length 31 chars in Excel
    const rawSheetName = `${emp.code} - ${emp.name}`;
    const safeSheetName = rawSheetName.substring(0, 31).replace(/[*?:/\\\[\]]/g, '_');

    const sheet = workbook.addWorksheet(safeSheetName, {
      views: [{ rightToLeft: true }]
    });

    // Column Definitions
    sheet.columns = [
      { key: 'idx', width: 6 },       // A: م
      { key: 'day', width: 14 },      // B: اليوم
      { key: 'date', width: 14 },     // C: التاريخ
      { key: 'checkIn', width: 12 },  // D: وقت الحضور
      { key: 'checkOut', width: 12 }, // E: وقت الانصراف
      { key: 'status', width: 28 },   // F: الحالة
      { key: 'delay', width: 13 },    // G: تأخير (دقيقة)
      { key: 'overtime', width: 13 }, // H: إضافي (يوم)
      { key: 'absence', width: 13 },  // I: غياب (يوم)
      { key: 'notes', width: 26 }     // J: ملاحظات
    ];

    // 1. Title Banner (Rows 1-2)
    sheet.mergeCells('A1:J2');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `📋 كارت تسجيل الحضور والانصراف التفصيلي - ${emp.name}`;
    styleCell(titleCell, {
      bgColor: COLORS.NAVY_PRIMARY,
      textColor: COLORS.WHITE,
      bold: true,
      fontSize: 14,
      align: 'center'
    });

    // 2. Employee Info Header Box (Rows 3-5)
    // Row 3
    sheet.mergeCells('A3:B3');
    sheet.getCell('A3').value = 'كود الموظف:';
    styleCell(sheet.getCell('A3'), { bgColor: COLORS.GRAY_LIGHT, bold: true, align: 'right' });
    sheet.mergeCells('C3:D3');
    sheet.getCell('C3').value = emp.code;
    styleCell(sheet.getCell('C3'), { bold: true, textColor: COLORS.BLUE_TEXT, fontSize: 11, align: 'center' });

    sheet.mergeCells('E3:F3');
    sheet.getCell('E3').value = 'اسم الموظف:';
    styleCell(sheet.getCell('E3'), { bgColor: COLORS.GRAY_LIGHT, bold: true, align: 'right' });
    sheet.mergeCells('G3:J3');
    sheet.getCell('G3').value = emp.name;
    styleCell(sheet.getCell('G3'), { bold: true, fontSize: 11, align: 'right' });

    // Row 4
    sheet.mergeCells('A4:B4');
    sheet.getCell('A4').value = 'القسم / الإدارة:';
    styleCell(sheet.getCell('A4'), { bgColor: COLORS.GRAY_LIGHT, bold: true, align: 'right' });
    sheet.mergeCells('C4:D4');
    sheet.getCell('C4').value = emp.department || 'عام';
    styleCell(sheet.getCell('C4'), { align: 'center' });

    sheet.mergeCells('E4:F4');
    sheet.getCell('E4').value = 'الوظيفة:';
    styleCell(sheet.getCell('E4'), { bgColor: COLORS.GRAY_LIGHT, bold: true, align: 'right' });
    sheet.mergeCells('G4:J4');
    sheet.getCell('G4').value = emp.job_title || 'موظف';
    styleCell(sheet.getCell('G4'), { align: 'right' });

    // Row 5
    sheet.mergeCells('A5:B5');
    sheet.getCell('A5').value = 'الفترة الزمنية:';
    styleCell(sheet.getCell('A5'), { bgColor: COLORS.GRAY_LIGHT, bold: true, align: 'right' });
    sheet.mergeCells('C5:D5');
    sheet.getCell('C5').value = `${startD}  إلى  ${endD}`;
    styleCell(sheet.getCell('C5'), { bold: true, align: 'center' });

    sheet.mergeCells('E5:F5');
    sheet.getCell('E5').value = 'تاريخ الاستخراج:';
    styleCell(sheet.getCell('E5'), { bgColor: COLORS.GRAY_LIGHT, bold: true, align: 'right' });
    sheet.mergeCells('G5:J5');
    sheet.getCell('G5').value = new Date().toLocaleDateString('ar-EG', { dateStyle: 'full' });
    styleCell(sheet.getCell('G5'), { align: 'right' });

    // Track statistics for this employee
    let actualPresentDays = 0;
    let weekendDays = 0;
    let officialHolidayDays = 0;
    let annualLeaveDays = 0;
    let absentDays = 0;
    let totalOvertimeDays = 0;
    let totalLateMinutes = 0;

    // Process daily entries
    const dailyRowsData = [];

    let dayIndex = 1;
    for (const dStr of dateList) {
      const d = new Date(dStr);
      const dayName = arabicDays[d.getDay()] || '';
      const isWeekend = (dayName === 'الجمعة'); // Weekly off
      const holidayName = holidayMap.get(dStr);

      const matchingLeave = leaves.find(l =>
        l.employee_id === emp.id &&
        dStr >= l.start_date &&
        dStr <= l.end_date
      );

      const existing = attMap.get(`${empCodeStr}_${dStr}`);

      let status = '';
      let checkIn = '';
      let checkOut = '';
      let lateMinutes = 0;
      let overtimeDays = 0;
      let absenceDayVal = 0;
      let notes = '';

      let rowType = 'regular'; // 'present', 'weekend', 'holiday', 'annual_leave', 'absent', 'missing'

      if (existing) {
        checkIn = formatExcelTime(existing.check_in);
        checkOut = formatExcelTime(existing.check_out);
        lateMinutes = Number(existing.late_minutes) || 0;
        overtimeDays = Number(existing.overtime_days) || (existing.overtime_hours > 0 ? Math.round((existing.overtime_hours / 8.0) * 10) / 10 : 0);
        notes = existing.notes || '';

        const hasPunch = !!checkIn || !!checkOut || (existing.status && existing.status.includes('حاضر'));
        const isAbsent = !hasPunch && (existing.is_absent === 1 || (existing.status && existing.status.includes('غياب')));
        const isAnnual = existing.is_annual_leave === 1 || (existing.status && existing.status.includes('سنوي'));
        const isHol = existing.is_holiday === 1 || (existing.status && existing.status.includes('رسمية')) || !!holidayName;

        if (isAbsent) {
          absenceDayVal = existing.absence_days || 1.0;
          status = existing.status || 'غياب';
          rowType = 'absent';
          absentDays += absenceDayVal;
        } else if (hasPunch || existing.status === 'حاضر') {
          status = existing.status || 'حاضر';
          rowType = 'present';
          actualPresentDays += 1;
        } else if (matchingLeave) {
          status = `إجازة ${matchingLeave.leave_type}`;
          rowType = matchingLeave.leave_type === 'سنوية' ? 'annual_leave' : 'holiday';
          if (matchingLeave.leave_type === 'سنوية') annualLeaveDays += 1;
        } else if (isHol) {
          status = `إجازة رسمية (${holidayName || existing.status || 'رسمية'}) - مدفوعة`;
          rowType = 'holiday';
          officialHolidayDays += 1;
        } else if (isWeekend || (existing.status && existing.status.includes('أسبوعية'))) {
          status = `عطلة أسبوعية (${dayName}) - مدفوعة`;
          rowType = 'weekend';
          weekendDays += 1;
        } else if (isAnnual) {
          status = 'إجازة سنوية معتمدة';
          rowType = 'annual_leave';
          annualLeaveDays += 1;
        } else {
          status = 'بدون بصمة (غير مسجل)';
          rowType = 'missing';
        }
      } else {
        // Missing attendance row: compute based on calendar status
        if (matchingLeave) {
          status = `إجازة ${matchingLeave.leave_type}`;
          rowType = matchingLeave.leave_type === 'سنوية' ? 'annual_leave' : 'holiday';
          if (matchingLeave.leave_type === 'سنوية') annualLeaveDays += 1;
        } else if (holidayName) {
          status = `إجازة رسمية (${holidayName}) - مدفوعة`;
          rowType = 'holiday';
          officialHolidayDays += 1;
        } else if (isWeekend) {
          status = `عطلة أسبوعية (${dayName}) - مدفوعة`;
          rowType = 'weekend';
          weekendDays += 1;
        } else {
          status = 'بدون بصمة (غير مسجل)';
          rowType = 'missing';
        }
      }

      totalOvertimeDays += overtimeDays;
      totalLateMinutes += lateMinutes;

      dailyRowsData.push({
        idx: dayIndex++,
        day: dayName,
        date: dStr,
        checkIn,
        checkOut,
        status,
        delay: lateMinutes > 0 ? lateMinutes : '',
        overtime: overtimeDays > 0 ? overtimeDays : '',
        absence: absenceDayVal > 0 ? absenceDayVal : '',
        notes,
        rowType
      });
    }

    // Total Paid Attendance Days
    const totalPaidAttendanceDays = actualPresentDays + weekendDays + officialHolidayDays + annualLeaveDays;

    // Save summary for master sheet
    employeeSummaries.push({
      employee_id: emp.id,
      code: emp.code,
      name: emp.name,
      department: emp.department || 'عام',
      job_title: emp.job_title || 'موظف',
      paid_days: totalPaidAttendanceDays,
      actual_present: actualPresentDays,
      weekends: weekendDays,
      official_holidays: officialHolidayDays,
      annual_leaves: annualLeaveDays,
      absent_days: absentDays,
      overtime_days: totalOvertimeDays,
      late_minutes: totalLateMinutes,
      annual_balance: emp.annual_leave_balance || 21
    });

    // 3. Mini Dashboard Cards (Rows 7-8)
    // Card 1: إجمالي الحضور المحتسب (المدفوع)
    sheet.mergeCells('A7:B7');
    sheet.getCell('A7').value = 'إجمالي الحضور المحتسب (مدفوع)';
    styleCell(sheet.getCell('A7'), { bgColor: COLORS.GREEN_LIGHT, textColor: COLORS.GREEN_TEXT, bold: true, fontSize: 9 });
    sheet.mergeCells('A8:B8');
    sheet.getCell('A8').value = `${totalPaidAttendanceDays} يوم`;
    styleCell(sheet.getCell('A8'), { bgColor: COLORS.GREEN_LIGHT, textColor: COLORS.GREEN_TEXT, bold: true, fontSize: 13 });

    // Card 2: حضور فعلي بالبصمة
    sheet.mergeCells('C7:D7');
    sheet.getCell('C7').value = 'حضور فعلي بالبصمة';
    styleCell(sheet.getCell('C7'), { bgColor: COLORS.BLUE_LIGHT, textColor: COLORS.BLUE_TEXT, bold: true, fontSize: 9 });
    sheet.mergeCells('C8:D8');
    sheet.getCell('C8').value = `${actualPresentDays} يوم`;
    styleCell(sheet.getCell('C8'), { bgColor: COLORS.BLUE_LIGHT, textColor: COLORS.BLUE_TEXT, bold: true, fontSize: 13 });

    // Card 3: عطلات أسبوعية ورسمية (مدفوعة)
    sheet.mergeCells('E7:F7');
    sheet.getCell('E7').value = 'عطلات ورسمية (مدفوعة)';
    styleCell(sheet.getCell('E7'), { bgColor: COLORS.PURPLE_LIGHT, textColor: COLORS.PURPLE_TEXT, bold: true, fontSize: 9 });
    sheet.mergeCells('E8:F8');
    sheet.getCell('E8').value = `${weekendDays + officialHolidayDays} يوم`;
    styleCell(sheet.getCell('E8'), { bgColor: COLORS.PURPLE_LIGHT, textColor: COLORS.PURPLE_TEXT, bold: true, fontSize: 13 });

    // Card 4: أيام الغياب
    sheet.mergeCells('G7:H7');
    sheet.getCell('G7').value = 'أيام الغياب والخصم';
    styleCell(sheet.getCell('G7'), { bgColor: COLORS.RED_LIGHT, textColor: COLORS.RED_TEXT, bold: true, fontSize: 9 });
    sheet.mergeCells('G8:H8');
    sheet.getCell('G8').value = `${absentDays} يوم`;
    styleCell(sheet.getCell('G8'), { bgColor: COLORS.RED_LIGHT, textColor: COLORS.RED_TEXT, bold: true, fontSize: 13 });

    // Card 5: أيام الإضافي
    sheet.mergeCells('I7:J7');
    sheet.getCell('I7').value = 'إجمالي الإضافي';
    styleCell(sheet.getCell('I7'), { bgColor: COLORS.BLUE_LIGHT, textColor: COLORS.BLUE_PRIMARY, bold: true, fontSize: 9 });
    sheet.mergeCells('I8:J8');
    sheet.getCell('I8').value = `${totalOvertimeDays} يوم`;
    styleCell(sheet.getCell('I8'), { bgColor: COLORS.BLUE_LIGHT, textColor: COLORS.BLUE_PRIMARY, bold: true, fontSize: 13 });

    // 4. Detailed Table Header (Row 10)
    const tableHeaderRow = sheet.getRow(10);
    tableHeaderRow.height = 28;
    const headers = [
      { col: 'A', text: 'م' },
      { col: 'B', text: 'اليوم' },
      { col: 'C', text: 'التاريخ' },
      { col: 'D', text: 'وقت الحضور' },
      { col: 'E', text: 'وقت الانصراف' },
      { col: 'F', text: 'الحالة والبيان' },
      { col: 'G', text: 'تأخير (دقيقة)' },
      { col: 'H', text: 'إضافي (يوم)' },
      { col: 'I', text: 'غياب (يوم)' },
      { col: 'J', text: 'ملاحظات' }
    ];

    headers.forEach(h => {
      const cell = tableHeaderRow.getCell(h.col);
      cell.value = h.text;
      styleCell(cell, {
        bgColor: COLORS.NAVY_DARK,
        textColor: COLORS.WHITE,
        bold: true,
        fontSize: 10,
        border: headerBorder
      });
    });

    // 5. Populate Daily Rows with Color Logic
    let curRowIdx = 11;
    for (const item of dailyRowsData) {
      const row = sheet.getRow(curRowIdx);
      row.height = 22;

      let rowBg = null;
      let statusTextColor = COLORS.TEXT_DARK;
      let statusBold = false;

      if (item.rowType === 'present') {
        rowBg = COLORS.GREEN_ROW;
        statusTextColor = COLORS.GREEN_TEXT;
        statusBold = true;
      } else if (item.rowType === 'weekend') {
        rowBg = COLORS.PURPLE_ROW;
        statusTextColor = COLORS.PURPLE_TEXT;
        statusBold = true;
      } else if (item.rowType === 'holiday') {
        rowBg = COLORS.PURPLE_LIGHT;
        statusTextColor = COLORS.PURPLE_HEADER;
        statusBold = true;
      } else if (item.rowType === 'annual_leave') {
        rowBg = COLORS.AMBER_LIGHT;
        statusTextColor = COLORS.AMBER_HEADER;
        statusBold = true;
      } else if (item.rowType === 'absent') {
        rowBg = COLORS.RED_ROW;
        statusTextColor = COLORS.RED_TEXT;
        statusBold = true;
      } else if (item.rowType === 'missing') {
        rowBg = COLORS.ORANGE_LIGHT;
        statusTextColor = COLORS.ORANGE_TEXT;
      }

      // Col A: م
      const cellA = row.getCell('A');
      cellA.value = item.idx;
      styleCell(cellA, { bgColor: rowBg, fontSize: 9, bold: false });

      // Col B: اليوم
      const cellB = row.getCell('B');
      cellB.value = item.day;
      styleCell(cellB, { bgColor: rowBg, bold: item.rowType === 'weekend', textColor: item.rowType === 'weekend' ? COLORS.PURPLE_TEXT : COLORS.TEXT_DARK });

      // Col C: التاريخ
      const cellC = row.getCell('C');
      cellC.value = item.date;
      styleCell(cellC, { bgColor: rowBg, fontSize: 9 });

      // Col D: وقت الحضور
      const cellD = row.getCell('D');
      cellD.value = item.checkIn || '-';
      styleCell(cellD, { bgColor: rowBg, bold: !!item.checkIn, textColor: item.checkIn ? COLORS.GREEN_TEXT : COLORS.TEXT_DARK });

      // Col E: وقت الانصراف
      const cellE = row.getCell('E');
      cellE.value = item.checkOut || '-';
      styleCell(cellE, { bgColor: rowBg, bold: !!item.checkOut, textColor: item.checkOut ? COLORS.GREEN_TEXT : COLORS.TEXT_DARK });

      // Col F: الحالة
      const cellF = row.getCell('F');
      cellF.value = item.status;
      styleCell(cellF, { bgColor: rowBg, textColor: statusTextColor, bold: statusBold, align: 'right' });

      // Col G: تأخير
      const cellG = row.getCell('G');
      cellG.value = item.delay;
      styleCell(cellG, {
        bgColor: item.delay ? COLORS.ORANGE_LIGHT : rowBg,
        textColor: item.delay ? COLORS.ORANGE_TEXT : COLORS.TEXT_DARK,
        bold: !!item.delay
      });

      // Col H: إضافي
      const cellH = row.getCell('H');
      cellH.value = item.overtime;
      styleCell(cellH, {
        bgColor: item.overtime ? COLORS.BLUE_LIGHT : rowBg,
        textColor: item.overtime ? COLORS.BLUE_TEXT : COLORS.TEXT_DARK,
        bold: !!item.overtime
      });

      // Col I: غياب
      const cellI = row.getCell('I');
      cellI.value = item.absence;
      styleCell(cellI, {
        bgColor: item.absence ? COLORS.RED_LIGHT : rowBg,
        textColor: item.absence ? COLORS.RED_TEXT : COLORS.TEXT_DARK,
        bold: !!item.absence
      });

      // Col J: ملاحظات
      const cellJ = row.getCell('J');
      cellJ.value = item.notes;
      styleCell(cellJ, { bgColor: rowBg, align: 'right', fontSize: 9 });

      curRowIdx++;
    }

    // 6. Summary Footer Row (Row curRowIdx)
    const summaryRow = sheet.getRow(curRowIdx);
    summaryRow.height = 26;
    sheet.mergeCells(`A${curRowIdx}:F${curRowIdx}`);
    const sumTitle = summaryRow.getCell('A');
    sumTitle.value = 'الإجماليات الشهرية:';
    styleCell(sumTitle, { bgColor: COLORS.GRAY_LIGHT, bold: true, align: 'right', fontSize: 11 });

    const sumDelay = summaryRow.getCell('G');
    sumDelay.value = totalLateMinutes > 0 ? totalLateMinutes : 0;
    styleCell(sumDelay, { bgColor: COLORS.GRAY_LIGHT, bold: true });

    const sumOt = summaryRow.getCell('H');
    sumOt.value = totalOvertimeDays > 0 ? totalOvertimeDays : 0;
    styleCell(sumOt, { bgColor: COLORS.BLUE_LIGHT, textColor: COLORS.BLUE_TEXT, bold: true });

    const sumAbs = summaryRow.getCell('I');
    sumAbs.value = absentDays > 0 ? absentDays : 0;
    styleCell(sumAbs, { bgColor: COLORS.RED_LIGHT, textColor: COLORS.RED_TEXT, bold: true });

    const sumNotes = summaryRow.getCell('J');
    sumNotes.value = `حضور مدفوع: ${totalPaidAttendanceDays} يوم`;
    styleCell(sumNotes, { bgColor: COLORS.GREEN_LIGHT, textColor: COLORS.GREEN_TEXT, bold: true });

    curRowIdx += 2;

    // 7. Official Signatures Section
    const signRow = sheet.getRow(curRowIdx);
    signRow.height = 30;
    sheet.mergeCells(`A${curRowIdx}:C${curRowIdx}`);
    sheet.getCell(`A${curRowIdx}`).value = 'إعداد الموارد البشرية (HR)\n..........................';
    styleCell(sheet.getCell(`A${curRowIdx}`), { bold: true, fontSize: 9, border: null });

    sheet.mergeCells(`E${curRowIdx}:G${curRowIdx}`);
    sheet.getCell(`E${curRowIdx}`).value = 'مراجعة الحسابات\n..........................';
    styleCell(sheet.getCell(`E${curRowIdx}`), { bold: true, fontSize: 9, border: null });

    sheet.mergeCells(`I${curRowIdx}:J${curRowIdx}`);
    sheet.getCell(`I${curRowIdx}`).value = 'اعتماد الإدارة\n..........................';
    styleCell(sheet.getCell(`I${curRowIdx}`), { bold: true, fontSize: 9, border: null });
  }

  // -------------------------------------------------------------
  // If multiple employees, populate the "ملخص الحضور العام" (Tab 1)
  // -------------------------------------------------------------
  if (summarySheet && employeeSummaries.length > 0) {
    summarySheet.columns = [
      { key: 'seq', width: 6 },            // A
      { key: 'code', width: 10 },          // B
      { key: 'name', width: 26 },          // C
      { key: 'dept', width: 18 },          // D
      { key: 'job', width: 18 },           // E
      { key: 'paid', width: 16 },          // F
      { key: 'actual', width: 14 },        // G
      { key: 'off', width: 14 },           // H
      { key: 'annual', width: 12 },        // I
      { key: 'absent', width: 12 },        // J
      { key: 'overtime', width: 12 },      // K
      { key: 'late', width: 12 },          // L
      { key: 'annual_bal', width: 14 }     // M
    ];

    // Title
    summarySheet.mergeCells('A1:M2');
    const mTitle = summarySheet.getCell('A1');
    mTitle.value = `📊 كشف ملخص حضور وانصراف الموظفين - عن الفترة من ${startD} إلى ${endD}`;
    styleCell(mTitle, {
      bgColor: COLORS.NAVY_PRIMARY,
      textColor: COLORS.WHITE,
      bold: true,
      fontSize: 14,
      align: 'center'
    });

    // Subtitle Note
    summarySheet.mergeCells('A3:M3');
    const mSub = summarySheet.getCell('A3');
    mSub.value = '💡 تنبيه: أيام العطلة الأسبوعية والإجازات الرسمية محتسبة ضمن إجمالي أيام الحضور لأنها إجازات مدفوعة الأجر بالكامل.';
    styleCell(mSub, {
      bgColor: COLORS.PURPLE_LIGHT,
      textColor: COLORS.PURPLE_TEXT,
      bold: true,
      fontSize: 10,
      align: 'center'
    });

    // Header Row (Row 5)
    const mHeaderRow = summarySheet.getRow(5);
    mHeaderRow.height = 30;
    const mHeaders = [
      { col: 'A', text: 'م' },
      { col: 'B', text: 'الكود' },
      { col: 'C', text: 'اسم الموظف' },
      { col: 'D', text: 'القسم' },
      { col: 'E', text: 'الوظيفة' },
      { col: 'F', text: 'إجمالي الحضور المحتسب' },
      { col: 'G', text: 'حضور بالبصمة' },
      { col: 'H', text: 'عطلات ورسمية' },
      { col: 'I', text: 'إجازات سنوية' },
      { col: 'J', text: 'أيام الغياب' },
      { col: 'K', text: 'أيام الإضافي' },
      { col: 'L', text: 'تأخير (دقيقة)' },
      { col: 'M', text: 'رصيد السنوي' }
    ];

    mHeaders.forEach(h => {
      const cell = mHeaderRow.getCell(h.col);
      cell.value = h.text;
      let bg = COLORS.NAVY_DARK;
      if (h.col === 'F') bg = COLORS.GREEN_HEADER;
      if (h.col === 'G') bg = COLORS.BLUE_HEADER;
      if (h.col === 'H') bg = COLORS.PURPLE_HEADER;
      if (h.col === 'J') bg = COLORS.RED_HEADER;
      if (h.col === 'K') bg = COLORS.BLUE_TEXT;

      styleCell(cell, {
        bgColor: bg,
        textColor: COLORS.WHITE,
        bold: true,
        fontSize: 10,
        border: headerBorder
      });
    });

    // Data Rows
    let rIdx = 6;
    let sIdx = 1;
    let totPaid = 0;
    let totActual = 0;
    let totOff = 0;
    let totAnnual = 0;
    let totAbs = 0;
    let totOt = 0;

    for (const s of employeeSummaries) {
      const row = summarySheet.getRow(rIdx);
      row.height = 22;
      const isZebra = rIdx % 2 === 0;
      const baseBg = isZebra ? COLORS.GRAY_LIGHT : COLORS.WHITE;

      totPaid += s.paid_days;
      totActual += s.actual_present;
      totOff += (s.weekends + s.official_holidays);
      totAnnual += s.annual_leaves;
      totAbs += s.absent_days;
      totOt += s.overtime_days;

      // Col A: م
      styleCell(row.getCell('A'), { bgColor: baseBg, value: sIdx });
      row.getCell('A').value = sIdx++;

      // Col B: الكود
      styleCell(row.getCell('B'), { bgColor: baseBg, bold: true, textColor: COLORS.BLUE_TEXT });
      row.getCell('B').value = s.code;

      // Col C: اسم الموظف
      styleCell(row.getCell('C'), { bgColor: baseBg, bold: true, align: 'right' });
      row.getCell('C').value = s.name;

      // Col D: القسم
      styleCell(row.getCell('D'), { bgColor: baseBg, align: 'right' });
      row.getCell('D').value = s.department;

      // Col E: الوظيفة
      styleCell(row.getCell('E'), { bgColor: baseBg, align: 'right' });
      row.getCell('E').value = s.job_title;

      // Col F: إجمالي الحضور المحتسب
      styleCell(row.getCell('F'), { bgColor: COLORS.GREEN_LIGHT, textColor: COLORS.GREEN_TEXT, bold: true });
      row.getCell('F').value = `${s.paid_days} يوم`;

      // Col G: حضور بالبصمة
      styleCell(row.getCell('G'), { bgColor: COLORS.BLUE_LIGHT, textColor: COLORS.BLUE_TEXT, bold: true });
      row.getCell('G').value = `${s.actual_present} يوم`;

      // Col H: عطلات ورسمية
      styleCell(row.getCell('H'), { bgColor: COLORS.PURPLE_LIGHT, textColor: COLORS.PURPLE_TEXT, bold: true });
      row.getCell('H').value = `${s.weekends + s.official_holidays} يوم`;

      // Col I: إجازات سنوية
      styleCell(row.getCell('I'), { bgColor: s.annual_leaves > 0 ? COLORS.AMBER_LIGHT : baseBg, bold: s.annual_leaves > 0 });
      row.getCell('I').value = `${s.annual_leaves} يوم`;

      // Col J: أيام الغياب
      styleCell(row.getCell('J'), {
        bgColor: s.absent_days > 0 ? COLORS.RED_LIGHT : baseBg,
        textColor: s.absent_days > 0 ? COLORS.RED_TEXT : COLORS.TEXT_DARK,
        bold: s.absent_days > 0
      });
      row.getCell('J').value = `${s.absent_days} يوم`;

      // Col K: أيام الإضافي
      styleCell(row.getCell('K'), {
        bgColor: s.overtime_days > 0 ? COLORS.BLUE_LIGHT : baseBg,
        textColor: s.overtime_days > 0 ? COLORS.BLUE_TEXT : COLORS.TEXT_DARK,
        bold: s.overtime_days > 0
      });
      row.getCell('K').value = `${s.overtime_days} يوم`;

      // Col L: تأخير
      styleCell(row.getCell('L'), { bgColor: baseBg });
      row.getCell('L').value = s.late_minutes > 0 ? s.late_minutes : 0;

      // Col M: رصيد سنوي
      styleCell(row.getCell('M'), { bgColor: baseBg });
      row.getCell('M').value = `${s.annual_balance} يوم`;

      rIdx++;
    }

    // Totals Footer Row
    const totRow = summarySheet.getRow(rIdx);
    totRow.height = 26;
    summarySheet.mergeCells(`A${rIdx}:E${rIdx}`);
    const totLabel = totRow.getCell('A');
    totLabel.value = `الإجمالي العام (${employeeSummaries.length} موظف):`;
    styleCell(totLabel, { bgColor: COLORS.GRAY_HEADER, textColor: COLORS.WHITE, bold: true, align: 'right' });

    styleCell(totRow.getCell('F'), { bgColor: COLORS.GREEN_HEADER, textColor: COLORS.WHITE, bold: true });
    totRow.getCell('F').value = `${totPaid} يوم`;

    styleCell(totRow.getCell('G'), { bgColor: COLORS.BLUE_HEADER, textColor: COLORS.WHITE, bold: true });
    totRow.getCell('G').value = `${totActual} يوم`;

    styleCell(totRow.getCell('H'), { bgColor: COLORS.PURPLE_HEADER, textColor: COLORS.WHITE, bold: true });
    totRow.getCell('H').value = `${totOff} يوم`;

    styleCell(totRow.getCell('I'), { bgColor: COLORS.AMBER_HEADER, textColor: COLORS.WHITE, bold: true });
    totRow.getCell('I').value = `${totAnnual} يوم`;

    styleCell(totRow.getCell('J'), { bgColor: COLORS.RED_HEADER, textColor: COLORS.WHITE, bold: true });
    totRow.getCell('J').value = `${totAbs} يوم`;

    styleCell(totRow.getCell('K'), { bgColor: COLORS.BLUE_TEXT, textColor: COLORS.WHITE, bold: true });
    totRow.getCell('K').value = `${totOt} يوم`;

    styleCell(totRow.getCell('L'), { bgColor: COLORS.GRAY_HEADER, textColor: COLORS.WHITE, bold: true });
    totRow.getCell('L').value = '-';

    styleCell(totRow.getCell('M'), { bgColor: COLORS.GRAY_HEADER, textColor: COLORS.WHITE, bold: true });
    totRow.getCell('M').value = '-';
  }

  return workbook;
}
