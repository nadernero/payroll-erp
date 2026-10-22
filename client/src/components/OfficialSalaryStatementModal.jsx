import React, { useRef, useState, useEffect } from 'react';
import { 
  X, Printer, ShieldCheck, Building2, UserCheck, Calendar, 
  Download, Edit3, Check, Upload, Image as ImageIcon
} from 'lucide-react';

export default function OfficialSalaryStatementModal({ statement, onClose }) {
  const printRef = useRef(null);

  // Company Profile Settings (persisted in localStorage)
  const [companyProfile, setCompanyProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('company_profile');
      return saved ? JSON.parse(saved) : {
        name: 'اسم شركتنا الموقرة',
        activity: 'إدارة الموارد البشرية والشئون الإدارية والمالية',
        cr: 'س.ت: 123456',
        tax_card: 'ب.ض: 100-200-300',
        logo: '' // URL or base64 image
      };
    } catch {
      return {
        name: 'اسم شركتنا الموقرة',
        activity: 'إدارة الموارد البشرية والشئون الإدارية والمالية',
        cr: 'س.ت: 123456',
        tax_card: 'ب.ض: 100-200-300',
        logo: ''
      };
    }
  });

  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [editForm, setEditForm] = useState(companyProfile);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!statement) return null;

  const { employee, earnings, deductions, net_salary, statement_date } = statement;

  const handlePrint = () => {
    window.print();
  };

  const handleSaveCompany = (e) => {
    e.preventDefault();
    setCompanyProfile(editForm);
    localStorage.setItem('company_profile', JSON.stringify(editForm));
    setIsEditingCompany(false);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setEditForm(prev => ({ ...prev, logo: event.target.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/70 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[96vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header Toolbar (Sticky & Hidden on Print) */}
        <div className="no-print sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/95 backdrop-blur-md">
          <div className="flex items-center gap-2.5 text-slate-800 font-bold">
            <div className="p-1.5 bg-blue-100 text-blue-700 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-black">شهادة مفردات مرتب رسمية معتمدة</h3>
              <p className="text-[11px] text-slate-500 font-normal">نموذج خطاب موجه للجهات الرسمية والبنوك</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditingCompany(!isEditingCompany)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              title="تعديل اسم الشركة واللوجو"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>تعديل بيانات الشركة واللوجو</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
              title="طباعة أو حفظ كـ PDF"
            >
              <Download className="w-4 h-4" />
              <span>حفظ كـ PDF / طباعة</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
              title="إغلاق (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Company Profile Quick Editor Panel */}
        {isEditingCompany && (
          <div className="no-print p-4 bg-amber-50 border-b border-amber-200 text-xs">
            <form onSubmit={handleSaveCompany} className="space-y-3">
              <div className="flex items-center justify-between font-bold text-amber-900 mb-1">
                <span>تعديل اسم شركتكم واللوجو والبيانات الرسمية:</span>
                <span className="text-[11px] text-amber-700 font-normal">(يتم حفظها تلقائياً لكافة الشهادات)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">اسم الشركة الرسمي:</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">الإدارة / النشاط الفرعي:</label>
                  <input
                    type="text"
                    value={editForm.activity}
                    onChange={(e) => setEditForm({ ...editForm, activity: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">السجل التجاري والبطاقة الضريبية:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="س.ت: ...."
                      value={editForm.cr}
                      onChange={(e) => setEditForm({ ...editForm, cr: e.target.value })}
                      className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                    />
                    <input
                      type="text"
                      placeholder="ب.ض: ...."
                      value={editForm.tax_card}
                      onChange={(e) => setEditForm({ ...editForm, tax_card: e.target.value })}
                      className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">لوجو الشركة:</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="text-xs file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {editForm.logo && (
                      <button
                        type="button"
                        onClick={() => setEditForm({ ...editForm, logo: '' })}
                        className="text-rose-600 hover:underline text-[10px]"
                      >
                        إزالة اللوجو
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditingCompany(false)}
                  className="px-3 py-1 text-slate-600 hover:bg-slate-200 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-xs"
                >
                  حفظ بيانات الشركة
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Printable Official Document Body */}
        <div ref={printRef} className="p-6 md:p-10 font-['Cairo',sans-serif] text-slate-800 bg-white overflow-y-auto flex-1" dir="rtl">
          
          {/* Formal Letterhead */}
          <div className="border-b-2 border-slate-900 pb-5 mb-6 flex justify-between items-start gap-4">
            <div className="flex items-center gap-4">
              {companyProfile.logo ? (
                <img 
                  src={companyProfile.logo} 
                  alt="لوجو الشركة" 
                  className="w-16 h-16 md:w-20 md:h-20 object-contain rounded-xl border border-slate-200 p-1"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-300 flex flex-col items-center justify-center text-slate-400">
                  <Building2 className="w-8 h-8 text-slate-500" />
                  <span className="text-[9px] mt-0.5">لوجو الشركة</span>
                </div>
              )}
              <div>
                <h1 className="text-xl md:text-2xl font-black text-slate-950 tracking-wide">{companyProfile.name}</h1>
                <p className="text-xs text-slate-600 font-medium mt-0.5">{companyProfile.activity}</p>
                <p className="text-[11px] text-slate-500 mt-1 font-mono">{companyProfile.cr} | {companyProfile.tax_card}</p>
              </div>
            </div>

            <div className="text-left font-mono text-xs text-slate-600 shrink-0">
              <p className="font-bold text-slate-900">التاريخ: {statement_date || new Date().toISOString().split('T')[0]}</p>
              <p className="text-slate-500 text-[11px]">الرقم المرجعي: SAL-{employee.code}-{new Date().getFullYear()}</p>
              <span className="inline-block px-2.5 py-0.5 mt-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded">
                شهادة معتمدة
              </span>
            </div>
          </div>

          {/* Title */}
          <div className="text-center my-6">
            <h2 className="text-xl font-black text-slate-900 underline decoration-2 decoration-blue-600 underline-offset-8">
              بيان مفردات مرتب رسمي
            </h2>
            <p className="text-xs text-slate-500 mt-2 font-medium">
              (بيان بالأجر الثابت والتعاقدي لتقديمه لمن يهمه الأمر)
            </p>
          </div>

          {/* Acknowledgement statement */}
          <div className="bg-slate-50 p-4 md:p-5 rounded-2xl border border-slate-200 text-xs md:text-sm leading-relaxed text-slate-700 mb-6">
            تشهد إدارة الشركة بأن السيد / 
            <span className="font-bold text-slate-950 text-base mx-1.5 underline underline-offset-4">{employee.name}</span>
            المعين بالشركة ويعمل بوظيفة: 
            <span className="font-bold text-slate-900 mx-1">{employee.job_title}</span>
            بقسم: <span className="font-bold text-slate-900 mx-1">{employee.department}</span>،
            ويحمل بطاقة رقم قومي: <span className="font-bold font-mono text-slate-900 mx-1">{employee.national_id || '---'}</span>،
            ورقم تأميني: <span className="font-bold font-mono text-slate-900 mx-1">{employee.insurance_no || '---'}</span>،
            يتقاضى راتباً شهرياً تعاقدياً ثابتاً طبقاً للبيان الآتي:
          </div>

          {/* Detailed Figures Table */}
          <div className="border border-slate-300 rounded-2xl overflow-hidden mb-6 shadow-xs">
            <table className="w-full text-xs md:text-sm text-right border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-bold">
                  <th className="p-3.5 border-l border-slate-700 w-1/2">بيان الاستحقاقات الثابتة (شهرياً)</th>
                  <th className="p-3.5 w-1/2">بيان الاستقطاعات القانونية الثابتة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr className="divide-x divide-x-reverse divide-slate-200">
                  <td className="p-4 space-y-2">
                    <div className="flex justify-between py-1">
                      <span className="text-slate-600">المرتب الأساسي:</span>
                      <span className="font-bold font-mono text-slate-900">{earnings.basic_salary.toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-600">بدلات خاضعة للضريبة:</span>
                      <span className="font-bold font-mono text-slate-900">{earnings.taxable_allowances.toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-600">بدلات غير خاضعة للضريبة:</span>
                      <span className="font-bold font-mono text-slate-900">{earnings.non_taxable_allowances.toLocaleString()} ج.م</span>
                    </div>
                  </td>
                  <td className="p-4 space-y-2 bg-slate-50/50">
                    <div className="flex justify-between py-1">
                      <span className="text-slate-600">تأمينات اجتماعية (حصة العامل 11%):</span>
                      <span className="font-bold font-mono text-rose-700">{deductions.social_insurance.toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-600">ضريبة كسب العمل المصرية:</span>
                      <span className="font-bold font-mono text-rose-700">{deductions.income_tax.toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between py-1 text-slate-400 text-xs">
                      <span>إعفاء شخصي شهري مطبق:</span>
                      <span className="font-mono">1,666.67 ج.م</span>
                    </div>
                  </td>
                </tr>
                <tr className="divide-x divide-x-reverse divide-slate-200 bg-slate-100 font-bold">
                  <td className="p-3.5">
                    <div className="flex justify-between text-slate-900">
                      <span>إجمالي الأجر الشامل الثابت:</span>
                      <span className="font-mono text-blue-700">{earnings.total_gross.toLocaleString()} ج.م</span>
                    </div>
                  </td>
                  <td className="p-3.5">
                    <div className="flex justify-between text-slate-900">
                      <span>إجمالي الاستقطاعات القانونية:</span>
                      <span className="font-mono text-rose-700">{deductions.total_deductions.toLocaleString()} ج.م</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Net Salary Highlight Card */}
          <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-4 md:p-5 flex items-center justify-between mb-8 shadow-xs">
            <div>
              <span className="text-xs md:text-sm font-bold text-emerald-900 block">صافي المرتب الثابت الشهري المستحق:</span>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                (فقط لا غير الراتب الثابت بعد خصم التأمينات والضرائب، بدون أي مكافآت أو أجر إضافي متغير)
              </p>
            </div>
            <div className="text-left font-mono">
              <span className="text-2xl md:text-3xl font-black text-emerald-950">{net_salary.toLocaleString()}</span>
              <span className="text-xs text-emerald-800 font-bold mr-1.5">جنيه مصري</span>
            </div>
          </div>

          {/* Legal Note */}
          <p className="text-[11px] text-slate-500 leading-relaxed mb-10 text-justify">
            * أُعطي هذا البيان بناءً على طلب الموظف لتقديمه إلى الجهات المختصة دون أدنى مسئولية مالية أو قانونية على الشركة تجاه حقوق الغير. تم استبعاد أي حوافز أو أجور إضافية أو مكافآت متغيرة طبقاً للأصول المحاسبية المتبعة في إصدار شهادات الرواتب الرسمية.
          </p>

          {/* Signatures & Stamp */}
          <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-300 text-center text-xs">
            <div>
              <p className="font-bold text-slate-800">إعداد الموارد البشرية</p>
              <div className="h-14 flex items-end justify-center">
                <span className="text-slate-400 font-serif italic text-sm">شؤون العاملين</span>
              </div>
              <p className="text-[10px] text-slate-400">التوقيع: .....................</p>
            </div>

            <div>
              <p className="font-bold text-slate-800">اعتماد الإدارة المالية</p>
              <div className="h-14 flex items-end justify-center">
                <span className="text-slate-400 font-serif italic text-sm">المدير المالي</span>
              </div>
              <p className="text-[10px] text-slate-400">التوقيع: .....................</p>
            </div>

            <div className="flex flex-col items-center justify-between">
              <p className="font-bold text-slate-800">خاتم المنشأة الرسمي</p>
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400 rotate-[-12deg]">
                خاتم الشركة
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Actions Bar (Hidden on Print) */}
        <div className="no-print p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            لحفظ الشهادة PDF: اضغط على الزر ثم اختر <strong>Save as PDF</strong> من الطابعة
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>حفظ كـ PDF / طباعة</span>
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-300 hover:bg-slate-400 text-slate-800 text-xs font-bold rounded-xl transition-colors"
            >
              إغلاق النافذة
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}