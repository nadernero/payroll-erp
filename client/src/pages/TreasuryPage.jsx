import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Wallet, Plus, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight,
  RefreshCw, Building, ChevronDown, ChevronUp, Trash2, Edit2,
  Phone, MessageCircle, Calculator, TrendingUp, TrendingDown,
  BarChart2, X, Check, AlertCircle, Eye, DollarSign, Archive,
  FileText, UserCheck, ShieldCheck, CheckCircle2, AlertTriangle, Coins,
  CreditCard, Calendar, Users, HelpCircle, CheckSquare, Square,
  Briefcase, Wrench, Printer, Sparkles, Filter, Search, Tag, ExternalLink, Package,
  Camera, Upload, Share2, Copy, Truck, Sprout, Image, CheckCheck, Cloud
} from 'lucide-react';
import { fetchJson } from '../utils/api';

const fmt = (n) => Number(n || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().split('T')[0];

export function tafqeetArabic(number) {
  if (number === null || number === undefined || number === '' || isNaN(number)) return '';
  const num = parseFloat(number);
  if (num === 0) return 'صفر جنيه مصري لا غير';

  const integerPart = Math.floor(Math.abs(num));
  const decimalPart = Math.round((Math.abs(num) - integerPart) * 100);

  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

  function convertGroup(n) {
    let res = '';
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (h > 0) res += hundreds[h];
    if (t === 1) {
      if (res !== '') res += ' و';
      res += teens[u];
    } else {
      if (u > 0) {
        if (res !== '') res += ' و';
        res += ones[u];
      }
      if (t > 1) {
        if (res !== '') res += ' و';
        res += tens[t];
      }
    }
    return res;
  }

  function getGroup(n, type) {
    if (n === 0) return '';
    const words = convertGroup(n);
    if (type === 0) return words;
    if (type === 1) {
      if (n === 1) return 'ألف';
      if (n === 2) return 'ألفان';
      if (n >= 3 && n <= 10) return `${words} آلاف`;
      return `${words} ألفاً`;
    }
    if (type === 2) {
      if (n === 1) return 'مليون';
      if (n === 2) return 'مليونان';
      if (n >= 3 && n <= 10) return `${words} ملايين`;
      return `${words} مليوناً`;
    }
    return words;
  }

  let parts = [];
  let temp = integerPart;
  let groupIdx = 0;

  while (temp > 0) {
    const grp = temp % 1000;
    if (grp > 0) parts.unshift(getGroup(grp, groupIdx));
    temp = Math.floor(temp / 1000);
    groupIdx++;
  }

  let finalWords = parts.join(' و');
  let result = 'فقط ' + (finalWords || 'صفر') + ' جنيهاً مصرياً';

  if (decimalPart > 0) {
    result += ' و' + convertGroup(decimalPart) + ' قرشاً';
  }

  result += ' لا غير';
  return result;
}

const TX_TYPES = {
  custody_receive: { label: 'استلام عهدة من الشركة', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: '📥', dir: 'in' },
  custody_return:  { label: 'رد عهدة للخزينة الرئيسية', color: 'text-sky-700 bg-sky-50 border-sky-200', icon: '📤', dir: 'out' },
  expense:         { label: 'صرف مصروفات / مشتريات', color: 'text-rose-700 bg-rose-50 border-rose-200', icon: '💸', dir: 'out' },
  income:          { label: 'إيراد / استرداد نقدي', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: '💰', dir: 'in' },
  sub_replenish:   { label: 'تغذية خزينة فرعية من الرئيسية', color: 'text-amber-700 bg-amber-50 border-amber-200', icon: '🔄', dir: 'out' },
  transfer_out:    { label: 'تحويل نقدي صادر', color: 'text-orange-700 bg-orange-50 border-orange-200', icon: '↗️', dir: 'out' },
  transfer_in:     { label: 'تحويل نقدي وارد', color: 'text-blue-700 bg-blue-50 border-blue-200', icon: '↙️', dir: 'in' },
  salary_payment:  { label: 'صرف رواتب / سلف نقدية', color: 'text-purple-700 bg-purple-50 border-purple-200', icon: '👷', dir: 'out' },
  farm_sale:       { label: 'توريد بيع محصول مزرعة', color: 'text-amber-800 bg-amber-50 border-amber-300', icon: '🌾', dir: 'in' },
  denomination_adjustment: { label: 'تسوية فروق جرد', color: 'text-slate-700 bg-slate-100 border-slate-200', icon: '⚖️', dir: 'adj' },
};

const BANKNOTE_DENOMS = [
  { key: '200', value: 200, label: 'فئة 200 جنيه', packValue: 20000, color: 'text-emerald-800 bg-emerald-50/80 border-emerald-300' },
  { key: '100', value: 100, label: 'فئة 100 جنيه', packValue: 10000, color: 'text-blue-800 bg-blue-50/80 border-blue-300' },
  { key: '50',  value: 50,  label: 'فئة 50 جنيه',  packValue: 5000,  color: 'text-purple-800 bg-purple-50/80 border-purple-300' },
  { key: '20',  value: 20,  label: 'فئة 20 جنيه',  packValue: 2000,  color: 'text-amber-800 bg-amber-50/80 border-amber-300' },
  { key: '10',  value: 10,  label: 'فئة 10 جنيه',  packValue: 1000,  color: 'text-orange-800 bg-orange-50/80 border-orange-300' },
  { key: '5',   value: 5,   label: 'فئة 5 جنيه',   packValue: 500,   color: 'text-teal-800 bg-teal-50/80 border-teal-300' },
];

const DENOM_FIELDS = [
  { key: 'count_200',  label: 'فئة 200 جنيه', value: 200 },
  { key: 'count_100',  label: 'فئة 100 جنيه', value: 100 },
  { key: 'count_50',   label: 'فئة 50 جنيه',  value: 50 },
  { key: 'count_20',   label: 'فئة 20 جنيه',  value: 20 },
  { key: 'count_10',   label: 'فئة 10 جنيه',  value: 10 },
  { key: 'count_5',    label: 'فئة 5 جنيه',   value: 5 },
];

const emptyDenom = () => ({
  packs_200: '', loose_200: '',
  packs_100: '', loose_100: '',
  packs_50: '',  loose_50: '',
  packs_20: '',  loose_20: '',
  packs_10: '',  loose_10: '',
  packs_5: '',   loose_5: '',
  count_200: '', count_100: '', count_50: '', count_20: '', count_10: '', count_5: '',
});

function calcDenomTotal(d) {
  if (!d) return 0;
  let total = 0;
  BANKNOTE_DENOMS.forEach(b => {
    const p = parseInt(d[`packs_${b.key}`] || 0, 10);
    const l = parseInt(d[`loose_${b.key}`] !== undefined && d[`loose_${b.key}`] !== '' ? d[`loose_${b.key}`] : (d[`count_${b.key}`] || 0), 10);
    total += (p * 100 + l) * b.value;
  });
  return total;
}

function DenominationInputs({ data, onChange, currentBookBalance, targetAmount, title = "أوراق النقد بالخزينة الرئيسية (تقسيم بالباكو 100 ورقة والفكة):" }) {
  const totalPhysical = calcDenomTotal(data);
  const target = targetAmount !== undefined ? targetAmount : currentBookBalance;
  const diff = target !== undefined ? (totalPhysical - target) : 0;
  const isExact = target !== undefined && Math.abs(diff) < 0.01;
  const isOver = target !== undefined && diff > 0.001;

  return (
    <div className="space-y-4">
      {/* Banknotes: Bundles + Loose */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
            <Package className="w-4 h-4 text-emerald-600" />
            {title}
          </span>
          <span className="text-[10px] text-slate-400">1 باكو = 100 ورقة نقدية</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {BANKNOTE_DENOMS.map(b => {
            const p = parseInt(data[`packs_${b.key}`] || 0, 10);
            const l = parseInt(data[`loose_${b.key}`] !== undefined && data[`loose_${b.key}`] !== '' ? data[`loose_${b.key}`] : (data[`count_${b.key}`] || 0), 10);
            const noteTotal = (p * 100 + l) * b.value;

            return (
              <div key={b.key} className={`p-2.5 rounded-2xl border ${b.color} space-y-2`}>
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs">{b.label}</span>
                  <span className="font-black font-mono text-xs">{fmt(noteTotal)} ج</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">عدد البواكي (100)</label>
                    <input
                      type="number"
                      min="0"
                      value={data[`packs_${b.key}`] || ''}
                      onChange={e => onChange({ ...data, [`packs_${b.key}`]: e.target.value })}
                      placeholder="0 باكو"
                      className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1 text-center font-bold font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">فكة أوراق</label>
                    <input
                      type="number"
                      min="0"
                      value={data[`loose_${b.key}`] !== undefined ? data[`loose_${b.key}`] : (data[`count_${b.key}`] || '')}
                      onChange={e => onChange({ ...data, [`loose_${b.key}`]: e.target.value, [`count_${b.key}`]: e.target.value })}
                      placeholder="0 ورقة"
                      className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1 text-center font-bold font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Physical Total (Main Cash Drawer Only) */}
      <div className="p-3.5 bg-gradient-to-l from-emerald-50 to-teal-50 border border-emerald-300 rounded-2xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-emerald-600" />
            إجمالي فئات النقدية المحسوبة بالدرج:
          </span>
          <span className="font-black text-xl text-emerald-900 font-mono">
            {fmt(totalPhysical)} <span className="text-xs font-normal">ج.م</span>
          </span>
        </div>

        {target !== undefined && target > 0 && (
          <div className="pt-2 border-t border-emerald-200 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">
              المبلغ المطلوب: <strong>{fmt(target)} ج.م</strong>
            </span>
            <span className={`font-black font-mono text-xs px-2.5 py-1 rounded-lg ${
              isExact ? 'bg-emerald-100 text-emerald-800' : isOver ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {isExact ? '✓ مطابق تماماً 100%' : isOver ? `زيادة +${fmt(diff)} ج.م` : `عجز / متبقي ${fmt(Math.abs(diff))} ج.م`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

async function uploadReceiptFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result;
        const res = await fetchJson('/treasury/upload-receipt', {
          method: 'POST',
          body: JSON.stringify({ image: base64Data, filename: file.name })
        });
        resolve(res.url);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

function ReceiptAttachmentInput({ imageUrl, onUpload, onRemove, label = "إرفاق صورة الفاتورة أو الإيصال (اختياري 📷)" }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 15 ميجابايت');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadReceiptFile(file);
      onUpload(url);
    } catch (err) {
      alert('فشل رفع الصورة: ' + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Camera className="w-4 h-4 text-blue-600" />
          {label}
        </label>
        <span className="text-[10px] text-slate-400">كاميرا / استوديو / مستند</span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {imageUrl ? (
        <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-blue-200">
          <div className="flex items-center gap-2.5">
            <img src={imageUrl} alt="Receipt preview" className="w-12 h-12 object-cover rounded-lg border border-slate-200" />
            <div>
              <span className="text-xs font-bold text-blue-900 block">تم إرفاق صورة المستند بنجاح ✓</span>
              <a href={imageUrl} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 hover:underline">
                معاينة بالحجم الكامل 🔍
              </a>
            </div>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
            title="حذف الصورة"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-2.5 px-3 border border-dashed border-slate-300 hover:border-blue-400 bg-white hover:bg-blue-50/50 rounded-xl text-xs font-semibold text-slate-600 hover:text-blue-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Upload className="w-4 h-4 text-slate-400" />
          {uploading ? 'جاري رفع وحفظ الصورة...' : 'اختر صورة من الجهاز أو التقط بالكاميرا (اختياري)'}
        </button>
      )}
    </div>
  );
}

function buildWhatsAppMessage({ amount, date, safeName, custodianName, courierName, refNo, description }) {
  let msg = `السلام عليكم ورحمة الله وبركاته،\n`;
  msg += `تم بحمد الله استلام عهدة نقدية:\n`;
  msg += `💵 المبلغ المستلم: ${fmt(amount)} ج.م\n`;
  msg += `📅 التاريخ: ${date}\n`;
  if (safeName) msg += `🏦 إلى خزينة: ${safeName}\n`;
  if (courierName) msg += `🚗 بواسطة الموظف / السائق: ${courierName}\n`;
  if (refNo) msg += `📄 رقم الإيصال / السند: ${refNo}\n`;
  if (description) msg += `📝 البيان: ${description}\n`;
  msg += `مع تحيات إدارة شؤون العاملين والحسابات.`;
  return msg;
}

export default function TreasuryPage() {
  const [activeTab, setActiveTab] = useState('safes');
  const [safes, setSafes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [denominations, setDenominations] = useState([]);
  const [summary, setSummary] = useState([]);
  const [summaryTotals, setSummaryTotals] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterSafe, setFilterSafe] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterType, setFilterType] = useState('');

  // Modals
  const [showNewSafeModal, setShowNewSafeModal] = useState(false);
  const [showTxModal, setShowTxModal] = useState(false);
  const [showDenomModal, setShowDenomModal] = useState(false);
  const [showMonthEndModal, setShowMonthEndModal] = useState(false);
  const [showMidMonthModal, setShowMidMonthModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [editSafe, setEditSafe] = useState(null);

  // Sub-safe Replenishment State
  const [showSubReplenishModal, setShowSubReplenishModal] = useState(false);
  const [subReplenishForm, setSubReplenishForm] = useState({
    main_safe_id: '',
    sub_safe_id: '',
    amount: '',
    date: today(),
    notes: '',
    custodian_name: ''
  });

  // Trusts / Temporary Custodies State (الأمانات والعهد ومواعيد الرد)
  const [trusts, setTrusts] = useState([]);
  const [trustsLoading, setTrustsLoading] = useState(false);
  const [trustFilter, setTrustFilter] = useState('all'); // 'all', 'active', 'overdue', 'returned'
  const [trustSearch, setTrustSearch] = useState('');
  const [showNewTrustModal, setShowNewTrustModal] = useState(false);
  const [showReturnTrustModal, setShowReturnTrustModal] = useState(false);
  const [selectedTrustForReturn, setSelectedTrustForReturn] = useState(null);

  const [newTrustForm, setNewTrustForm] = useState({
    safe_id: '',
    person_type: 'employee',
    employee_id: '',
    person_name: '',
    person_phone: '',
    person_national_id: '',
    amount: '',
    given_date: today(),
    due_date: '',
    purpose: '',
    notes: ''
  });

  const [returnTrustForm, setReturnTrustForm] = useState({
    return_safe_id: '',
    amount: '',
    return_date: today(),
    notes: ''
  });

  // General Forms
  const [safeForm, setSafeForm] = useState({
    name: '',
    type: 'main',
    parent_safe_id: '',
    custodian_name: '',
    custodian_phone: '',
    custodian_employee_id: '',
    notes: '',
    is_trust: 0
  });

  const [txForm, setTxForm] = useState({
    safe_id: '',
    type: 'custody_receive',
    recipient_type: 'employee', // 'employee' or 'party'
    party_id: '',
    party_name: '',
    category: 'أحبار وطابعات',
    invoice_no: '',
    amount: '',
    description: '',
    reference_no: '',
    related_employee_id: '',
    related_employee_name: '',
    related_safe_id: '',
    sender_phone: '',
    transaction_date: today(),
    notes: '',
    withDenom: false
  });

  const [denomForm, setDenomForm] = useState({
    safe_id: '',
    snapshot_date: today(),
    notes: '',
    ...emptyDenom()
  });

  const [monthEndForm, setMonthEndForm] = useState({
    sub_safe_id: '',
    transaction_date: today(),
    notes: ''
  });

  // Parties (External Vendors / Entities / Technicians) State
  const [parties, setParties] = useState([]);
  const [showNewPartyModal, setShowNewPartyModal] = useState(false);
  const [editParty, setEditParty] = useState(null);
  const [partyForm, setPartyForm] = useState({
    name: '',
    party_type: 'company',
    category: 'أحبار وطابعات',
    contact_person: '',
    phone: '',
    tax_no: '',
    address: '',
    notes: ''
  });
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [statementData, setStatementData] = useState(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [partySearchTerm, setPartySearchTerm] = useState('');
  const [partyCategoryFilter, setPartyCategoryFilter] = useState('all');

  // Supabase Cloud Live Sync State
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState(null);
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  const [supabaseSyncing, setSupabaseSyncing] = useState(false);

  const checkSupabaseStatus = async () => {
    setSupabaseLoading(true);
    setShowSupabaseModal(true);
    try {
      const res = await fetchJson('/treasury/supabase-status');
      setSupabaseStatus(res);
    } catch (err) {
      alert('خطأ أثناء فحص سوبابيز: ' + err.message);
    } finally {
      setSupabaseLoading(false);
    }
  };

  const handleForceSupabaseSync = async () => {
    setSupabaseSyncing(true);
    try {
      await fetchJson('/treasury/supabase-sync-now', { method: 'POST' });
      const res = await fetchJson('/treasury/supabase-status');
      setSupabaseStatus(res);
      alert('تمت المزامنة اللحظية الشاملة مع Supabase بنجاح ✓');
    } catch (err) {
      alert('خطأ أثناء المزامنة: ' + err.message);
    } finally {
      setSupabaseSyncing(false);
    }
  };

  // Sub-Safe Dedicated Workspace & Ledger State
  const [selectedSubSafe, setSelectedSubSafe] = useState(null);
  const [subSafeTransactions, setSubSafeTransactions] = useState([]);
  const [subSafeTxLoading, setSubSafeTxLoading] = useState(false);
  const [showSubSafeExpenseModal, setShowSubSafeExpenseModal] = useState(false);
  const [subSafeExpenseForm, setSubSafeExpenseForm] = useState({
    amount: '',
    category: 'كارتات طريق ورسوم بوابات وموازين',
    courier_name: '',
    description: '',
    reference_no: '',
    notes: '',
    withDenom: false,
    receipt_image: ''
  });

  // Mid-Month Expenses Disbursement State
  const [midMonthForm, setMidMonthForm] = useState({
    safe_id: '',
    year: 2026,
    month: 10,
    day: 10,
    transaction_date: today(),
    courier_name: '',
    sender_phone: '',
    notes: '',
    withDenom: false
  });
  const [midMonthItems, setMidMonthItems] = useState([]);
  const [midMonthSearch, setMidMonthSearch] = useState('');
  const [midMonthLoading, setMidMonthLoading] = useState(false);

  // Loan Disbursement State
  const [loanForm, setLoanForm] = useState({
    safe_id: '',
    employee_id: '',
    total_amount: '',
    months_count: 12,
    start_date: '2026-11',
    transaction_date: today(),
    courier_name: '',
    sender_phone: '',
    notes: '',
    withDenom: false
  });

  const [denomData, setDenomData] = useState(emptyDenom());
  const [lastTxReceipt, setLastTxReceipt] = useState(null);

  // Dedicated Employee Disbursement Window (Day 10/20 & Loans) State
  const [showEmployeeDisburseModal, setShowEmployeeDisburseModal] = useState(false);
  const [empDisburseForm, setEmpDisburseForm] = useState({
    safe_id: '',
    employee_id: '',
    disbursement_type: 'day_10',
    amount: '',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    months_count: 6,
    start_date: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    courier_name: '',
    sender_phone: '',
    notes: '',
    receipt_image: ''
  });
  const [empDenomData, setEmpDenomData] = useState(emptyDenom());

  // Dedicated External Party (Vendor/Company/Technician) Disbursement Window State
  const [showPartyDisburseModal, setShowPartyDisburseModal] = useState(false);
  const [partyDisburseForm, setPartyDisburseForm] = useState({
    safe_id: '',
    party_id: '',
    party_name: '',
    category: 'أحبار وطابعات',
    invoice_no: '',
    amount: '',
    description: '',
    courier_name: '',
    sender_phone: '',
    notes: '',
    isNewPartyInline: false,
    newPartyName: '',
    newPartyCategory: 'أحبار وطابعات',
    newPartyPhone: '',
    receipt_image: '',
    isFarmExpense: false
  });
  const [partyDenomData, setPartyDenomData] = useState(emptyDenom());

  // Dedicated Custody Receive Window State
  const [showCustodyReceiveModal, setShowCustodyReceiveModal] = useState(false);
  const [custodyReceiveForm, setCustodyReceiveForm] = useState({
    safe_id: '',
    amount: '',
    description: 'استلام عهدة نقدية من أمين خزينة الشركة',
    reference_no: '',
    sender_phone: '',
    courier_name: '',
    transaction_date: today(),
    notes: ''
  });
  const [custodyDenomData, setCustodyDenomData] = useState(emptyDenom());

  // Sub Safes Browser Modal State
  const [showSubSafesBrowserModal, setShowSubSafesBrowserModal] = useState(false);

  // Receipt Image Lightbox Modal State
  const [viewReceiptImage, setViewReceiptImage] = useState(null);

  // CFO WhatsApp Drawer Share Modal State
  const [showCfoShareModal, setShowCfoShareModal] = useState(false);
  const [cfoPhone, setCfoPhone] = useState(() => {
    try {
      return localStorage.getItem('treasury_cfo_phone') || '';
    } catch {
      return '';
    }
  });
  const [cfoCopied, setCfoCopied] = useState(false);

  // Farm Crop Sale Modal State
  const [showFarmSaleModal, setShowFarmSaleModal] = useState(false);
  const [farmSaleForm, setFarmSaleForm] = useState({
    safe_id: '',
    amount: '',
    crop_type: 'محصول مانجو',
    buyer_name: '',
    reference_no: 'M1-001',
    description: 'توريد قيمة بيع محصول مانجو',
    transaction_date: today(),
    receipt_image: '',
    notes: ''
  });

  // Drivers Expense Report State
  const [driverReportData, setDriverReportData] = useState({
    summary: [],
    details: [],
    driversList: [],
    totalOverall: 0,
    totalReceipts: 0
  });
  const [driverFilterSafe, setDriverFilterSafe] = useState('');
  const [driverFilterName, setDriverFilterName] = useState('all');
  const [driverFilterFrom, setDriverFilterFrom] = useState('');
  const [driverFilterTo, setDriverFilterTo] = useState('');
  const [driverLoading, setDriverLoading] = useState(false);

  // Farm Revenue & Expenses Report State
  const [farmReportData, setFarmReportData] = useState({
    transactions: [],
    farmSafe: null,
    metrics: {
      totalCropSales: 0,
      mangoSales: 0,
      dateSales: 0,
      otherSales: 0,
      mainExpenses: 0,
      subExpenses: 0,
      totalExpenses: 0,
      netProfit: 0
    }
  });
  const [farmFilterFrom, setFarmFilterFrom] = useState('');
  const [farmFilterTo, setFarmFilterTo] = useState('');
  const [farmLoading, setFarmLoading] = useState(false);

  // Load basic data
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, eRes, smRes, pRes, trRes] = await Promise.all([
        fetchJson('/treasury/safes'),
        fetchJson('/employees?status=active&limit=300').catch(() => []),
        fetchJson('/treasury/summary').catch(() => ({ data: [], totals: null })),
        fetchJson('/treasury/parties').catch(() => ({ data: [] })),
        fetchJson('/treasury/trusts').catch(() => ({ data: [] }))
      ]);
      setSafes(sRes.data || []);
      setEmployees(Array.isArray(eRes) ? eRes : (eRes.data || []));
      setSummary(smRes.data || []);
      setSummaryTotals(smRes.totals || null);
      setParties(pRes.data || []);
      setTrusts(trRes.data || []);
    } catch (err) {
      console.error('Failed to load treasury data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTrusts = useCallback(async () => {
    setTrustsLoading(true);
    try {
      const res = await fetchJson('/treasury/trusts');
      setTrusts(res.data || []);
    } catch (err) {
      console.error('Failed to load trusts:', err);
    } finally {
      setTrustsLoading(false);
    }
  }, []);

  const loadParties = useCallback(async () => {
    try {
      const res = await fetchJson('/treasury/parties');
      setParties(res.data || []);
    } catch (err) {
      console.error('Failed to load parties:', err);
    }
  }, []);

  const loadSubSafeTransactions = useCallback(async (safeId) => {
    if (!safeId) return;
    setSubSafeTxLoading(true);
    try {
      const res = await fetchJson(`/treasury/transactions?safe_id=${safeId}&limit=300`);
      setSubSafeTransactions(res.data || []);
    } catch (err) {
      console.error('Failed to load sub-safe transactions:', err);
    } finally {
      setSubSafeTxLoading(false);
    }
  }, []);

  const handleOpenStatement = async (party) => {
    setStatementLoading(true);
    setShowStatementModal(true);
    try {
      const res = await fetchJson(`/treasury/parties/${party.id}/statement`);
      setStatementData(res);
    } catch (err) {
      alert('خطأ أثناء جلب كشف الحساب: ' + err.message);
    } finally {
      setStatementLoading(false);
    }
  };

  const handleSaveParty = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editParty) {
        await fetchJson(`/treasury/parties/${editParty.id}`, { method: 'PUT', body: JSON.stringify(partyForm) });
      } else {
        await fetchJson('/treasury/parties', { method: 'POST', body: JSON.stringify(partyForm) });
      }
      setShowNewPartyModal(false);
      setEditParty(null);
      setPartyForm({ name: '', party_type: 'company', category: 'أحبار وطابعات', contact_person: '', phone: '', tax_no: '', address: '', notes: '' });
      await loadParties();
      alert('تم حفظ بيانات الجهة / الشركة بنجاح');
    } catch (err) {
      alert('خطأ أثناء حفظ بيانات الجهة: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteParty = async (partyId) => {
    if (!window.confirm('هل أنت متأكد من حذف أو تعطيل هذه الجهة؟')) return;
    try {
      const res = await fetchJson(`/treasury/parties/${partyId}`, { method: 'DELETE' });
      alert(res.message);
      await loadParties();
    } catch (err) {
      alert('خطأ أثناء الحذف: ' + err.message);
    }
  };

  const handleSubSafeDisburse = async (e) => {
    e.preventDefault();
    if (!selectedSubSafe) return;
    const amt = parseFloat(subSafeExpenseForm.amount);
    if (isNaN(amt) || amt <= 0) {
      alert('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }
    if (amt > selectedSubSafe.current_balance) {
      alert(`رصيد الخزينة الفرعية (${fmt(selectedSubSafe.current_balance)} ج.م) لا يكفي لصرف هذا المبلغ (${fmt(amt)} ج.م)`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        safe_id: String(selectedSubSafe.id),
        type: 'expense',
        amount: amt,
        description: subSafeExpenseForm.description || `صرف ${subSafeExpenseForm.category}`,
        category: subSafeExpenseForm.category,
        related_employee_name: subSafeExpenseForm.courier_name,
        reference_no: subSafeExpenseForm.reference_no,
        transaction_date: today(),
        notes: subSafeExpenseForm.notes,
        recipient_type: 'employee',
        receipt_image: subSafeExpenseForm.receipt_image || null
      };
      await fetchJson('/treasury/transactions', { method: 'POST', body: JSON.stringify(payload) });

      alert(`تم صرف المصروف وقيده على الخزينة الفرعية بنجاح (إيصال: ${subSafeExpenseForm.reference_no})`);
      setShowSubSafeExpenseModal(false);
      setSubSafeExpenseForm({
        amount: '',
        category: 'كارتات طريق ورسوم بوابات وموازين',
        courier_name: '',
        description: '',
        reference_no: '',
        notes: '',
        withDenom: false,
        receipt_image: ''
      });

      await loadAll();
      loadSubSafeTransactions(selectedSubSafe.id);
      setSelectedSubSafe(prev => prev ? { ...prev, current_balance: prev.current_balance - amt } : null);
    } catch (err) {
      alert('خطأ أثناء صرف المصروف: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openSubSafeExpenseModal = async (subSafe, defaultCategory = '') => {
    setSelectedSubSafe(subSafe);
    let nextNo = 'J1-001';
    try {
      const res = await fetchJson('/treasury/next-receipt-no?prefix=J1');
      if (res?.nextReceiptNo) nextNo = res.nextReceiptNo;
    } catch (e) {
      console.error(e);
    }
    setSubSafeExpenseForm({
      amount: '',
      category: defaultCategory || 'كارتات طريق ورسوم بوابات وموازين',
      courier_name: '',
      description: '',
      reference_no: nextNo,
      notes: '',
      withDenom: false,
      receipt_image: ''
    });
    setShowSubSafeExpenseModal(true);
  };

  const openCustodyReceiveModal = (safe = null) => {
    const s = safe || mainSafes[0] || safes[0];
    setCustodyReceiveForm({
      safe_id: s?.id ? String(s.id) : '',
      amount: '',
      description: 'استلام عهدة نقدية من أمين خزينة الشركة',
      reference_no: '',
      sender_phone: s?.custodian_phone || '',
      courier_name: '',
      transaction_date: today(),
      notes: ''
    });
    setCustodyDenomData(emptyDenom());
    setShowCustodyReceiveModal(true);
  };

  const handleSaveCustodyReceive = async (e) => {
    e.preventDefault();
    const amt = parseFloat(custodyReceiveForm.amount);
    if (isNaN(amt) || amt <= 0) {
      alert('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }
    const denomTot = calcDenomTotal(custodyDenomData);
    if (Math.abs(denomTot - amt) > 0.01) {
      alert(`❌ لا يمكن الحفظ: إجمالي فئات النقدية المستلمة (${fmt(denomTot)} ج.م) لا يطابق مبلغ العهدة (${fmt(amt)} ج.م)`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        safe_id: custodyReceiveForm.safe_id,
        type: 'custody_receive',
        amount: amt,
        description: custodyReceiveForm.description,
        reference_no: custodyReceiveForm.reference_no,
        sender_phone: custodyReceiveForm.sender_phone,
        related_employee_name: custodyReceiveForm.courier_name,
        transaction_date: custodyReceiveForm.transaction_date || today(),
        notes: custodyReceiveForm.notes,
        denomination: {
          ...custodyDenomData,
          tafqeet_text: tafqeetArabic(amt)
        }
      };

      const res = await fetchJson('/treasury/transactions', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const safeObj = safes.find(s => String(s.id) === String(custodyReceiveForm.safe_id));
      const receiptData = {
        ...payload,
        id: res?.data?.id,
        safeName: safeObj?.name || 'الخزينة الرئيسية',
        custodianName: safeObj?.custodian_name || '',
        date: custodyReceiveForm.transaction_date || today()
      };
      setLastTxReceipt(receiptData);

      alert('تم استلام العهدة بنجاح وإيداع الفئات بالدرج وتحديث الرصيد');
      setShowCustodyReceiveModal(false);
      await loadAll();
      if (activeTab === 'transactions') loadTransactions();
      if (activeTab === 'denominations') loadDenominations();
    } catch (err) {
      alert('خطأ أثناء استلام العهدة: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEmployeeDisburseModal = (safe = null, defaultType = 'day_10') => {
    const sId = safe?.id ? String(safe.id) : (mainSafes[0]?.id ? String(mainSafes[0].id) : (safes[0]?.id ? String(safes[0].id) : ''));
    setEmpDisburseForm({
      safe_id: sId,
      employee_id: '',
      disbursement_type: defaultType,
      amount: '',
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      months_count: 6,
      start_date: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
      courier_name: '',
      sender_phone: '',
      notes: '',
      receipt_image: ''
    });
    setEmpDenomData(emptyDenom());
    setShowEmployeeDisburseModal(true);
  };

  const handleSaveEmployeeDisbursement = async (e) => {
    e.preventDefault();
    const amt = parseFloat(empDisburseForm.amount);
    if (isNaN(amt) || amt <= 0) {
      alert('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }
    const denomTot = calcDenomTotal(empDenomData);
    if (Math.abs(denomTot - amt) > 0.01) {
      alert(`❌ لا يمكن الحفظ: إجمالي فئات النقدية المنصرفة (${fmt(denomTot)} ج.م) لا يطابق مبلغ الصرف (${fmt(amt)} ج.م)`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        safe_id: empDisburseForm.safe_id,
        employee_id: empDisburseForm.employee_id,
        disbursement_type: empDisburseForm.disbursement_type,
        amount: amt,
        year: empDisburseForm.year,
        month: empDisburseForm.month,
        months_count: empDisburseForm.months_count,
        start_date: empDisburseForm.start_date,
        courier_name: empDisburseForm.courier_name,
        sender_phone: empDisburseForm.sender_phone,
        notes: empDisburseForm.notes,
        receipt_image: empDisburseForm.receipt_image || null,
        denomination: {
          ...empDenomData,
          tafqeet_text: tafqeetArabic(amt)
        }
      };

      const res = await fetchJson('/treasury/disburse-employee', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      alert(res.message || 'تم تسجيل الصرف للموظف وخصمه من الخزينة والدرج بنجاح');
      setShowEmployeeDisburseModal(false);
      await loadAll();
      if (activeTab === 'transactions') loadTransactions();
      if (activeTab === 'denominations') loadDenominations();
    } catch (err) {
      alert('خطأ أثناء تسجيل الصرف للموظف: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openPartyDisburseModal = (safe = null) => {
    const sId = safe?.id ? String(safe.id) : (mainSafes[0]?.id ? String(mainSafes[0].id) : (safes[0]?.id ? String(safes[0].id) : ''));
    setPartyDisburseForm({
      safe_id: sId,
      party_id: parties[0]?.id ? String(parties[0].id) : '',
      party_name: parties[0]?.name || '',
      category: parties[0]?.category || 'أحبار وطابعات',
      invoice_no: '',
      amount: '',
      description: '',
      courier_name: '',
      sender_phone: '',
      notes: '',
      isNewPartyInline: false,
      newPartyName: '',
      newPartyCategory: 'أحبار وطابعات',
      newPartyPhone: '',
      receipt_image: '',
      isFarmExpense: false
    });
    setPartyDenomData(emptyDenom());
    setShowPartyDisburseModal(true);
  };

  const handleSavePartyDisbursement = async (e) => {
    e.preventDefault();
    const amt = parseFloat(partyDisburseForm.amount);
    if (isNaN(amt) || amt <= 0) {
      alert('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }
    const denomTot = calcDenomTotal(partyDenomData);
    if (Math.abs(denomTot - amt) > 0.01) {
      alert(`❌ لا يمكن الحفظ: إجمالي فئات النقدية المنصرفة (${fmt(denomTot)} ج.م) لا يطابق مبلغ الفاتورة (${fmt(amt)} ج.م)`);
      return;
    }

    setSaving(true);
    try {
      let finalPartyId = partyDisburseForm.party_id;
      let finalPartyName = partyDisburseForm.party_name;
      let finalCategory = partyDisburseForm.category;

      if (partyDisburseForm.isNewPartyInline && partyDisburseForm.newPartyName.trim()) {
        const createRes = await fetchJson('/treasury/parties', {
          method: 'POST',
          body: JSON.stringify({
            name: partyDisburseForm.newPartyName.trim(),
            category: partyDisburseForm.newPartyCategory,
            phone: partyDisburseForm.newPartyPhone
          })
        });
        if (createRes?.data?.id) {
          finalPartyId = createRes.data.id;
          finalPartyName = createRes.data.name;
          finalCategory = createRes.data.category;
        }
      }

      const payload = {
        safe_id: partyDisburseForm.safe_id,
        type: 'expense',
        amount: amt,
        recipient_type: 'external_party',
        party_id: finalPartyId,
        party_name: finalPartyName,
        category: partyDisburseForm.isFarmExpense ? `مزرعة - ${finalCategory}` : finalCategory,
        invoice_no: partyDisburseForm.invoice_no,
        description: partyDisburseForm.description,
        transaction_date: today(),
        notes: partyDisburseForm.notes,
        receipt_image: partyDisburseForm.receipt_image || null,
        cost_center: partyDisburseForm.isFarmExpense ? 'farm' : null,
        denomination: {
          ...partyDenomData,
          tafqeet_text: tafqeetArabic(amt)
        }
      };

      await fetchJson('/treasury/transactions', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      alert('تم تسجيل صرف الفاتورة للجهة وإنقاص الدرج بنجاح');
      setShowPartyDisburseModal(false);
      await loadAll();
      if (activeTab === 'transactions') loadTransactions();
      if (activeTab === 'denominations') loadDenominations();
      if (activeTab === 'farm') loadFarmReport();
    } catch (err) {
      alert('خطأ أثناء صرف الفاتورة للجهة: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const loadTransactions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterSafe) params.set('safe_id', filterSafe);
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo)   params.set('to', filterTo);
      if (filterType) params.set('type', filterType);
      params.set('limit', '400');
      const res = await fetchJson(`/treasury/transactions?${params.toString()}`);
      setTransactions(res.data || []);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    }
  }, [filterSafe, filterFrom, filterTo, filterType]);

  const loadDenominations = useCallback(async () => {
    try {
      const params = filterSafe ? `?safe_id=${filterSafe}&limit=100` : '?limit=100';
      const res = await fetchJson(`/treasury/denominations${params}`);
      setDenominations(res.data || []);
    } catch (err) {
      console.error('Failed to load denominations:', err);
    }
  }, [filterSafe]);

  const loadDriverReport = useCallback(async () => {
    setDriverLoading(true);
    try {
      const params = new URLSearchParams();
      if (driverFilterSafe) params.set('safe_id', driverFilterSafe);
      if (driverFilterFrom) params.set('from', driverFilterFrom);
      if (driverFilterTo) params.set('to', driverFilterTo);
      if (driverFilterName && driverFilterName !== 'all') params.set('driver_name', driverFilterName);
      const res = await fetchJson(`/treasury/reports/drivers?${params.toString()}`);
      setDriverReportData(res.data || { summary: [], details: [], driversList: [], totalOverall: 0, totalReceipts: 0 });
    } catch (err) {
      console.error('Failed to load driver report:', err);
    } finally {
      setDriverLoading(false);
    }
  }, [driverFilterSafe, driverFilterFrom, driverFilterTo, driverFilterName]);

  const loadFarmReport = useCallback(async () => {
    setFarmLoading(true);
    try {
      const params = new URLSearchParams();
      if (farmFilterFrom) params.set('from', farmFilterFrom);
      if (farmFilterTo) params.set('to', farmFilterTo);
      const res = await fetchJson(`/treasury/reports/farm?${params.toString()}`);
      setFarmReportData(res.data || { transactions: [], farmSafe: null, metrics: { totalCropSales: 0, mangoSales: 0, dateSales: 0, otherSales: 0, mainExpenses: 0, subExpenses: 0, totalExpenses: 0, netProfit: 0 } });
    } catch (err) {
      console.error('Failed to load farm report:', err);
    } finally {
      setFarmLoading(false);
    }
  }, [farmFilterFrom, farmFilterTo]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { if (activeTab === 'transactions') loadTransactions(); }, [activeTab, loadTransactions]);
  useEffect(() => { if (activeTab === 'denominations') loadDenominations(); }, [activeTab, loadDenominations]);
  useEffect(() => { if (activeTab === 'drivers') loadDriverReport(); }, [activeTab, loadDriverReport]);
  useEffect(() => { if (activeTab === 'farm') loadFarmReport(); }, [activeTab, loadFarmReport]);

  const openFarmSaleModal = async () => {
    const farmS = safes.find(s => s.name.includes('مزرعة')) || subSafes[0] || safes[0];
    let nextNo = 'M1-001';
    try {
      const res = await fetchJson('/treasury/next-receipt-no?prefix=M1');
      if (res?.nextReceiptNo) nextNo = res.nextReceiptNo;
    } catch (e) {
      console.error(e);
    }
    setFarmSaleForm({
      safe_id: farmS?.id ? String(farmS.id) : '',
      amount: '',
      crop_type: 'محصول مانجو',
      buyer_name: '',
      reference_no: nextNo,
      description: 'توريد قيمة بيع محصول مانجو',
      transaction_date: today(),
      receipt_image: '',
      notes: ''
    });
    setShowFarmSaleModal(true);
  };

  const handleSaveFarmSale = async (e) => {
    e.preventDefault();
    const amt = parseFloat(farmSaleForm.amount);
    if (isNaN(amt) || amt <= 0) {
      alert('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }
    if (!farmSaleForm.safe_id) {
      alert('يرجى اختيار الخزينة المراد إيداع مبيعات المحصول بها');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        safe_id: String(farmSaleForm.safe_id),
        type: 'farm_sale',
        amount: amt,
        description: farmSaleForm.description || `توريد مبيعات ${farmSaleForm.crop_type}`,
        category: `مبيعات زراعية - ${farmSaleForm.crop_type}`,
        related_employee_name: farmSaleForm.buyer_name,
        reference_no: farmSaleForm.reference_no,
        transaction_date: farmSaleForm.transaction_date,
        notes: farmSaleForm.notes,
        cost_center: 'farm',
        crop_type: farmSaleForm.crop_type,
        receipt_image: farmSaleForm.receipt_image || null
      };

      await fetchJson('/treasury/transactions', { method: 'POST', body: JSON.stringify(payload) });

      alert(`تم تسجيل توريد بيع المحصول (${fmt(amt)} ج.م) وإيداعه بالخزينة بنجاح (سند: ${farmSaleForm.reference_no})`);
      setShowFarmSaleModal(false);
      await loadAll();
      if (activeTab === 'farm') loadFarmReport();
      if (activeTab === 'transactions') loadTransactions();
    } catch (err) {
      alert('خطأ أثناء توريد بيع المحصول: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateFarmSafe = async () => {
    try {
      const mainS = mainSafes[0] || safes[0];
      const payload = {
        name: 'خزينة المزرعة',
        type: 'sub',
        parent_safe_id: mainS?.id || null,
        custodian_name: 'مسؤول المزرعة',
        notes: 'خزينة فرعية خاصة بإيرادات بيع المحاصيل ومصروفات المزرعة'
      };
      await fetchJson('/treasury/safes', { method: 'POST', body: JSON.stringify(payload) });
      alert('تم إنشاء خزينة فرعية للمزرعة بنجاح!');
      await loadAll();
      if (activeTab === 'farm') loadFarmReport();
    } catch (err) {
      alert('خطأ أثناء إنشاء خزينة المزرعة: ' + err.message);
    }
  };

  const handleRecalculateBalances = async () => {
    try {
      setLoading(true);
      const res = await fetchJson('/treasury/recalculate-all', { method: 'POST' });
      alert(res.message || 'تم تدقيق وإعادة مطابقة كافة الأرصدة بنجاح مع الدفاتر');
      await loadAll();
    } catch (err) {
      alert('خطأ أثناء إعادة احتساب الأرصدة: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Derived Values - Strictly Separating Main Safe from Sub Safes
  const mainSafes = safes.filter(s => s.type === 'main');
  const subSafes  = safes.filter(s => s.type === 'sub');
  const mainBalance = summaryTotals?.main_book_balance ?? mainSafes.reduce((sum, s) => sum + (s.current_balance || 0), 0);
  const subBalance  = summaryTotals?.sub_book_balance ?? subSafes.reduce((sum, s) => sum + (s.current_balance || 0), 0);

  // Main Safe Cash Drawer & Variance (Physical cash drawer belongs STRICTLY to the Main Safe)
  const mainPhysicalDrawer = summaryTotals?.main_physical_drawer ?? (
    denominations.find(d => {
      const sf = safes.find(s => s.id === d.safe_id);
      return !sf || sf.type === 'main';
    })?.total_physical ?? mainBalance
  );
  const mainVariance = summaryTotals?.main_difference ?? (mainPhysicalDrawer - mainBalance);
  const isExactDrawer = Math.abs(mainVariance) < 0.01;
  const isDeficit = !isExactDrawer && mainVariance < 0;
  const isSurplus = !isExactDrawer && mainVariance > 0;

  const generateCfoWhatsAppMessage = () => {
    const curTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const curDate = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const mainS = mainSafes[0] || safes[0];

    let text = `السلام عليكم ورحمة الله وبركاته أستاذنا المدير المالي المحترم،\n`;
    text += `📊 *تقرير جرد ومطابقة الخزينة المركزية اليومي:*\n`;
    text += `📅 *التاريخ:* ${curDate} (الساعة ${curTime})\n`;
    text += `🏦 *الخزينة:* ${mainS?.name || 'الخزينة الرئيسية'} (المسؤول: ${mainS?.custodian_name || 'أمين الخزينة'})\n`;
    text += `📖 *الرصيد الدفتري العام:* ${fmt(mainBalance)} ج.م\n`;
    text += `💵 *النقدية الفعلية بالدرج:* ${fmt(mainPhysicalDrawer)} ج.م\n`;
    if (isExactDrawer) {
      text += `⚖️ *حالة المطابقة:* ✅ مطابق 100% تماماً (الفارق صفر - لا يوجد عجز أو زيادة)\n`;
    } else if (mainVariance < 0) {
      text += `⚖️ *حالة المطابقة:* ⚠️ عجز نقدي بالدرج بقيمة ${fmt(Math.abs(mainVariance))} ج.م عن الدفتري\n`;
    } else {
      text += `⚖️ *حالة المطابقة:* ℹ️ زيادة نقدية بالدرج بقيمة ${fmt(mainVariance)} ج.م عن الدفتري\n`;
    }

    const latestDenom = denominations.find(d => {
      const sf = safes.find(s => s.id === d.safe_id);
      return !sf || sf.type === 'main';
    });

    if (latestDenom) {
      text += `\n📦 *تفصيل فئات أوراق النقد المحسوبة بالدرج:*\n`;
      BANKNOTE_DENOMS.forEach(b => {
        const p = latestDenom[`packs_${b.key}`] || 0;
        const l = latestDenom[`loose_${b.key}`] !== undefined ? latestDenom[`loose_${b.key}`] : (latestDenom[`count_${b.key}`] || 0);
        const subTot = (p * 100 + l) * b.value;
        if (p > 0 || l > 0) {
          text += `• ${b.label}: ${p} باكو + ${l} ورقة = ${fmt(subTot)} ج.م\n`;
        }
      });
    }

    text += `\nتم الجرد الفعلي والاعتماد بمعرفة أمين الخزينة الرئيسي وإدارة الحسابات.`;
    return text;
  };

  const selectedSafeObj = safes.find(s => String(s.id) === String(txForm.safe_id));
  const denomModalSafeObj = safes.find(s => String(s.id) === String(denomForm.safe_id));
  const txDenomTotal = calcDenomTotal(denomData);
  const modalDenomTotal = calcDenomTotal(denomForm);

  const filteredParties = useMemo(() => {
    return parties.filter(p => {
      if (partySearchTerm) {
        const matchName = (p.name || '').includes(partySearchTerm);
        const matchContact = (p.contact_person || '').includes(partySearchTerm);
        const matchPhone = (p.phone || '').includes(partySearchTerm);
        const matchCat = (p.category || '').includes(partySearchTerm);
        if (!matchName && !matchContact && !matchPhone && !matchCat) return false;
      }
      if (partyCategoryFilter !== 'all' && p.category !== partyCategoryFilter) {
        return false;
      }
      return true;
    });
  }, [parties, partySearchTerm, partyCategoryFilter]);

  // Load Mid-Month Expenses for selected Month/Year/Day
  const loadMidMonthData = async (y, m, d, safeId) => {
    setMidMonthLoading(true);
    try {
      const data = await fetchJson(`/expenses?year=${y}&month=${m}`);
      const raw = data.items || [];
      const field = d === 10 ? 'amount_day_10' : 'amount_day_20';
      const itemsList = raw.map(emp => {
        const val = Number(emp[field]) || 0;
        return {
          employee_id: emp.employee_id,
          employee_code: emp.employee_code,
          employee_name: emp.employee_name,
          department: emp.department,
          amount: val,
          notes: emp.notes || '',
          selected: val > 0
        };
      });
      setMidMonthItems(itemsList);
    } catch (err) {
      alert('خطأ في تحميل بيانات المصروفات: ' + err.message);
    } finally {
      setMidMonthLoading(false);
    }
  };

  const handleOpenMidMonthModal = (day = 10) => {
    const sId = mainSafes[0]?.id ? String(mainSafes[0].id) : (safes[0]?.id ? String(safes[0].id) : '');
    setMidMonthForm(f => ({
      ...f,
      safe_id: sId,
      day: day,
      year: 2026,
      month: 10,
      courier_name: '',
      sender_phone: mainSafes[0]?.custodian_phone || '',
      notes: `صرف مصروفات يوم ${day} لشهر 10/2026`,
      withDenom: false
    }));
    setDenomData(emptyDenom());
    loadMidMonthData(2026, 10, day, sId);
    setShowMidMonthModal(true);
  };

  const handleOpenLoanModal = (empId = '') => {
    const sId = mainSafes[0]?.id ? String(mainSafes[0].id) : (safes[0]?.id ? String(safes[0].id) : '');
    const emp = employees.find(e => String(e.id) === String(empId));
    setLoanForm({
      safe_id: sId,
      employee_id: empId,
      total_amount: '',
      months_count: 12,
      start_date: '2026-11',
      transaction_date: today(),
      courier_name: emp ? emp.name : '',
      sender_phone: '',
      notes: '',
      withDenom: false
    });
    setDenomData(emptyDenom());
    setShowLoanModal(true);
  };

  // Execute Mid-Month Disbursement
  const handleDisburseMidMonth = async (e) => {
    e.preventDefault();
    if (!midMonthForm.safe_id) {
      alert('يرجى اختيار الخزينة المراد الصرف منها');
      return;
    }

    const selectedList = midMonthItems.filter(it => it.selected && parseFloat(it.amount || 0) > 0);
    if (selectedList.length === 0) {
      alert('يرجى اختيار موظف واحد على الأقل وتحديد مبلغ أكبر من الصفر');
      return;
    }

    const totalToPay = selectedList.reduce((sum, it) => sum + parseFloat(it.amount || 0), 0);
    const safeObj = safes.find(s => String(s.id) === String(midMonthForm.safe_id));
    if (safeObj && totalToPay > safeObj.current_balance) {
      alert(`رصيد الخزينة (${fmt(safeObj.current_balance)} ج.م) لا يكفي لصرف إجمالي المصروفات (${fmt(totalToPay)} ج.م)`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        safe_id: midMonthForm.safe_id,
        year: midMonthForm.year,
        month: midMonthForm.month,
        day: midMonthForm.day,
        transaction_date: midMonthForm.transaction_date,
        courier_name: midMonthForm.courier_name,
        sender_phone: midMonthForm.sender_phone,
        notes: midMonthForm.notes,
        items: selectedList.map(it => ({
          employee_id: it.employee_id,
          amount: parseFloat(it.amount),
          notes: it.notes
        }))
      };

      if (midMonthForm.withDenom) {
        payload.denomination = denomData;
      }

      const res = await fetchJson('/treasury/disburse-mid-month', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      alert(res.message);
      setShowMidMonthModal(false);
      setDenomData(emptyDenom());
      await loadAll();
      if (activeTab === 'transactions') loadTransactions();
      if (activeTab === 'denominations') loadDenominations();
    } catch (err) {
      alert('خطأ أثناء صرف المصروفات: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Execute Loan Disbursement
  const handleDisburseLoan = async (e) => {
    e.preventDefault();
    if (!loanForm.safe_id) {
      alert('يرجى اختيار الخزينة المراد الصرف منها');
      return;
    }
    if (!loanForm.employee_id) {
      alert('يرجى اختيار الموظف المستلم للسلفة');
      return;
    }
    const amt = parseFloat(loanForm.total_amount);
    if (isNaN(amt) || amt <= 0) {
      alert('يرجى إدخال مبلغ سلفة صحيح أكبر من الصفر');
      return;
    }

    const safeObj = safes.find(s => String(s.id) === String(loanForm.safe_id));
    if (safeObj && amt > safeObj.current_balance) {
      alert(`رصيد الخزينة (${fmt(safeObj.current_balance)} ج.م) لا يكفي لصرف السلفة (${fmt(amt)} ج.م)`);
      return;
    }

    setSaving(true);
    try {
      const payload = { ...loanForm };
      if (loanForm.withDenom) {
        payload.denomination = denomData;
      }

      const res = await fetchJson('/treasury/disburse-loan', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const emp = employees.find(e => String(e.id) === String(loanForm.employee_id));
      setLastTxReceipt({
        amount: amt,
        newBalance: res.data?.newBalance,
        safeName: safeObj?.name || '',
        courier_name: emp?.name || '',
        sender_phone: loanForm.sender_phone,
        date: loanForm.transaction_date,
        description: `سلفة نقدية بمبلغ ${fmt(amt)} ج.م مقسطة على ${loanForm.months_count} شهر (قسط شهري ${fmt(res.data?.installment)} ج.م)`,
        refNo: `LOAN-${res.data?.loanId}`,
        type: 'salary_payment'
      });

      alert(res.message);
      setShowLoanModal(false);
      setDenomData(emptyDenom());
      await loadAll();
      if (activeTab === 'transactions') loadTransactions();
      if (activeTab === 'denominations') loadDenominations();
    } catch (err) {
      alert('خطأ أثناء صرف السلفة: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Save Safe
  const handleSaveSafe = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editSafe) {
        await fetchJson(`/treasury/safes/${editSafe.id}`, { method: 'PUT', body: JSON.stringify(safeForm) });
      } else {
        await fetchJson('/treasury/safes', { method: 'POST', body: JSON.stringify(safeForm) });
      }
      setShowNewSafeModal(false);
      setEditSafe(null);
      setSafeForm({ name: '', type: 'main', parent_safe_id: '', custodian_name: '', custodian_phone: '', custodian_employee_id: '', notes: '', is_trust: 0 });
      await loadAll();
    } catch (err) {
      alert('خطأ أثناء حفظ الخزينة: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Open Sub-Safe Replenish Modal
  const openSubReplenishModal = (fromSafe = null, toSubSafe = null) => {
    const main = fromSafe?.type === 'main' ? fromSafe : (mainSafes[0] || safes.find(s => s.type === 'main') || null);
    const sub = toSubSafe || subSafes[0] || null;
    setSubReplenishForm({
      main_safe_id: main ? String(main.id) : '',
      sub_safe_id: sub ? String(sub.id) : '',
      amount: '',
      date: today(),
      notes: sub ? `تغذية عهدة نقدية لخزينة ${sub.name}` : 'تغذية عهدة نقدية لخزينة فرعية',
      custodian_name: sub?.custodian_name || ''
    });
    setShowSubReplenishModal(true);
  };

  const handleSubReplenishSubmit = async (e) => {
    e.preventDefault();
    if (!subReplenishForm.main_safe_id || !subReplenishForm.sub_safe_id) {
      alert('يجب تحديد الخزينة الرئيسية والخزينة الفرعية');
      return;
    }
    const amt = parseFloat(subReplenishForm.amount);
    if (!amt || amt <= 0) {
      alert('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }
    setSaving(true);
    try {
      const res = await fetchJson('/treasury/sub-safes/replenish', {
        method: 'POST',
        body: JSON.stringify(subReplenishForm)
      });
      alert(res.message || 'تمت تغذية الخزينة الفرعية بنجاح ✓');
      setShowSubReplenishModal(false);
      await loadAll();
    } catch (err) {
      alert('خطأ أثناء تغذية الخزينة: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Open New Trust Modal
  const openNewTrustModal = (safe = null) => {
    const sId = safe?.id ? String(safe.id) : (mainSafes[0]?.id ? String(mainSafes[0].id) : (safes[0]?.id ? String(safes[0].id) : ''));
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const defaultDue = d.toISOString().split('T')[0];

    setNewTrustForm({
      safe_id: sId,
      person_type: 'employee',
      employee_id: employees[0]?.id ? String(employees[0].id) : '',
      person_name: employees[0]?.name || '',
      person_phone: employees[0]?.phone || '',
      person_national_id: '',
      amount: '',
      given_date: today(),
      due_date: defaultDue,
      purpose: 'أمانة نقدية / عهدة مؤقتة',
      notes: ''
    });
    setShowNewTrustModal(true);
  };

  const handleCreateTrustSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(newTrustForm.amount);
    if (!amt || amt <= 0) {
      alert('يرجى إدخال مبلغ صالح للأمانة');
      return;
    }
    if (!newTrustForm.person_name || !newTrustForm.person_name.trim()) {
      alert('يرجى تحديد اسم المستلم للأمانة');
      return;
    }
    if (!newTrustForm.due_date) {
      alert('يرجى تحديد موعد الرد المتفق عليه');
      return;
    }

    setSaving(true);
    try {
      const res = await fetchJson('/treasury/trusts', {
        method: 'POST',
        body: JSON.stringify(newTrustForm)
      });
      alert(res.message || 'تم صرف الأمانة بنجاح ✓');
      setShowNewTrustModal(false);
      await loadAll();
      await loadTrusts();
    } catch (err) {
      alert('خطأ أثناء صرف الأمانة: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openReturnTrustModal = (trust) => {
    setSelectedTrustForReturn(trust);
    setReturnTrustForm({
      return_safe_id: String(trust.safe_id),
      amount: String(trust.remaining_amount),
      return_date: today(),
      notes: `رد واسترداد أمانة من طرف: ${trust.person_name}`
    });
    setShowReturnTrustModal(true);
  };

  const handleReturnTrustSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTrustForReturn) return;
    const amt = parseFloat(returnTrustForm.amount);
    if (!amt || amt <= 0) {
      alert('يرجى إدخال مبلغ رد صالح');
      return;
    }
    setSaving(true);
    try {
      const res = await fetchJson(`/treasury/trusts/${selectedTrustForReturn.id}/return`, {
        method: 'POST',
        body: JSON.stringify(returnTrustForm)
      });
      alert(res.message || 'تم إثبات رد الأمانة بنجاح وتصفية المبلغ ✓');
      setShowReturnTrustModal(false);
      setSelectedTrustForReturn(null);
      await loadAll();
      await loadTrusts();
    } catch (err) {
      alert('خطأ أثناء رد الأمانة: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTrust = async (id, name) => {
    if (!window.confirm(`هل أنت متأكد من حذف أو إلغاء سجل أمانة (${name})؟`)) return;
    try {
      await fetchJson(`/treasury/trusts/${id}`, { method: 'DELETE' });
      alert('تم حذف سجل الأمانة بنجاح');
      await loadAll();
      await loadTrusts();
    } catch (err) {
      alert('خطأ: ' + err.message);
    }
  };

  // Save General Transaction
  const handleSaveTx = async (e) => {
    e.preventDefault();
    if (!txForm.safe_id) {
      alert('يرجى اختيار الخزينة');
      return;
    }
    if (!txForm.amount || parseFloat(txForm.amount) <= 0) {
      alert('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }

    setSaving(true);
    try {
      const payload = { ...txForm };
      if (txForm.withDenom) {
        payload.denomination = denomData;
      }
      const res = await fetchJson('/treasury/transactions', { method: 'POST', body: JSON.stringify(payload) });
      
      const safeObj = safes.find(s => String(s.id) === String(txForm.safe_id));
      setLastTxReceipt({
        ...res.data,
        newBalance: res.newBalance,
        safeName: safeObj?.name || '',
        sender_phone: txForm.sender_phone,
        courier_name: txForm.related_employee_name,
        amount: parseFloat(txForm.amount),
        date: txForm.transaction_date,
        description: txForm.description,
        refNo: txForm.reference_no,
        type: txForm.type
      });

      setShowTxModal(false);
      setTxForm({
        safe_id: '',
        type: 'custody_receive',
        amount: '',
        description: '',
        reference_no: '',
        related_employee_id: '',
        related_employee_name: '',
        related_safe_id: '',
        sender_phone: '',
        transaction_date: today(),
        notes: '',
        withDenom: false
      });
      setDenomData(emptyDenom());

      await loadAll();
      if (activeTab === 'transactions') loadTransactions();
      if (activeTab === 'denominations') loadDenominations();
    } catch (err) {
      alert('خطأ أثناء تسجيل الحركة: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Save Manual Denomination Snapshot
  const handleSaveDenom = async (e) => {
    e.preventDefault();
    if (!denomForm.safe_id) {
      alert('يرجى اختيار الخزينة');
      return;
    }
    setSaving(true);
    try {
      await fetchJson('/treasury/denominations', { method: 'POST', body: JSON.stringify(denomForm) });
      setShowDenomModal(false);
      setDenomForm({ safe_id: '', snapshot_date: today(), notes: '', ...emptyDenom() });
      await loadDenominations();
      await loadAll();
      alert('تم حفظ الجرد الفعلي للدرج ومطابقته بنجاح');
    } catch (err) {
      alert('خطأ أثناء حفظ الجرد: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Month End Return
  const handleMonthEnd = async (e) => {
    e.preventDefault();
    if (!monthEndForm.sub_safe_id) {
      alert('يرجى اختيار الخزينة الفرعية');
      return;
    }
    const sub = safes.find(s => String(s.id) === String(monthEndForm.sub_safe_id));
    if (!confirm(`هل أنت متأكد من إقفال ${sub?.name || 'الخزينة الفرعية'} ورد المتبقي (${fmt(sub?.current_balance)} ج.م) للخزينة الرئيسية؟`)) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetchJson('/treasury/month-end-close', { method: 'POST', body: JSON.stringify(monthEndForm) });
      alert(res.message);
      setShowMonthEndModal(false);
      setMonthEndForm({ sub_safe_id: '', transaction_date: today(), notes: '' });
      await loadAll();
      if (activeTab === 'transactions') loadTransactions();
    } catch (err) {
      alert('خطأ أثناء الإقفال الشهري: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete transaction with rollback
  const handleDeleteTx = async (id) => {
    if (!confirm('تحذير: سيتم حذف هذه الحركة وعكس أثرها المالي على رصيد الخزينة بالكامل. هل تريد المتابعة؟')) return;
    try {
      await fetchJson(`/treasury/transactions/${id}`, { method: 'DELETE' });
      await loadTransactions();
      await loadAll();
    } catch (err) {
      alert('خطأ أثناء حذف الحركة: ' + err.message);
    }
  };

  // Loan installment live calculation
  const calculatedLoanInstallment = useMemo(() => {
    const amt = parseFloat(loanForm.total_amount || 0);
    const months = parseInt(loanForm.months_count || 1, 10);
    if (isNaN(amt) || amt <= 0 || isNaN(months) || months < 1) return 0;
    return Math.round((amt / months) * 100) / 100;
  }, [loanForm.total_amount, loanForm.months_count]);

  const calculatedLoanEndDate = useMemo(() => {
    if (!loanForm.start_date) return '';
    const [y, m] = loanForm.start_date.split('-').map(Number);
    const months = parseInt(loanForm.months_count || 1, 10);
    const end = new Date(y, (m - 1) + (months - 1), 1);
    return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`;
  }, [loanForm.start_date, loanForm.months_count]);

  // Mid-month total selected calculation
  const midMonthTotalSelected = useMemo(() => {
    return midMonthItems
      .filter(it => it.selected)
      .reduce((sum, it) => sum + (parseFloat(it.amount) || 0), 0);
  }, [midMonthItems]);

  const filteredMidMonthItems = useMemo(() => {
    if (!midMonthSearch) return midMonthItems;
    const q = midMonthSearch.trim().toLowerCase();
    return midMonthItems.filter(it => 
      it.employee_name.toLowerCase().includes(q) || 
      it.employee_code.includes(q) ||
      (it.department && it.department.toLowerCase().includes(q))
    );
  }, [midMonthItems, midMonthSearch]);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header & Professional Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-2xl shadow-inner">
              <Wallet className="w-7 h-7" />
            </div>
            نظام الخزينة الاحترافي والعهد النقدية
          </h1>
          <p className="text-slate-500 text-xs font-semibold mt-1 flex items-center gap-2">
            <span>إدارة الخزائن</span>
            <span>•</span>
            <span className="text-blue-700 font-bold">ربط مصروفات 10 و 20 بالراتب</span>
            <span>•</span>
            <span className="text-purple-700 font-bold">صرف السلف وتقسيطها على الشهور</span>
            <span>•</span>
            <span className="text-amber-700 font-bold">جرد فئات الدرج الفعلي ومطابقة الفروق</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadAll}
            className="p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-2xl transition-colors cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Custody Receive Button */}
          <button
            onClick={() => openCustodyReceiveModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <ArrowDownCircle className="w-4 h-4" />
            + استلام عهدة من الشركة
          </button>

          {/* Sub Safe Feeding Button (Top Bar) */}
          <button
            onClick={() => openSubReplenishModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold rounded-2xl text-xs shadow-sm hover:shadow transition-all cursor-pointer"
            title="تغذية خزينة فرعية وتحويل عهدة نقدية من الخزينة الرئيسية"
          >
            <ArrowRightLeft className="w-4 h-4 text-amber-200" />
            🔄 تغذية خزينة فرعية
          </button>

          {/* New Trust / Custody Button (Top Bar) */}
          <button
            onClick={() => openNewTrustModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-700 hover:from-teal-700 hover:to-cyan-800 text-white font-bold rounded-2xl text-xs shadow-sm hover:shadow transition-all cursor-pointer"
            title="صرف أمانة أو عهدة مؤقتة لشخص أو موظف مع تحديد موعد الرد"
          >
            <Coins className="w-4 h-4 text-teal-200" />
            🤝 صرف أمانة / عهدة
          </button>

          {/* Dedicated Employee Disbursement Window */}
          <button
            onClick={() => openEmployeeDisburseModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white font-bold rounded-2xl text-xs shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <Users className="w-4 h-4 text-purple-200" />
            صرف موظفين (مصروف 10 و 20 والسلف)
          </button>

          {/* Dedicated External Party / Company Disbursement Button */}
          <button
            onClick={() => openPartyDisburseModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-2xl text-xs shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <Building className="w-4 h-4 text-blue-200" />
            صرف للأشخاص والشركات (موردين / صيانة)
          </button>

          {/* Sub Safes Browser Button */}
          <button
            onClick={() => setShowSubSafesBrowserModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-2xl text-xs shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <Wallet className="w-4 h-4 text-amber-200" />
            استعراض الخزائن الفرعية ({subSafes.length})
          </button>

          {/* Month End Close */}
          <button
            onClick={() => {
              setMonthEndForm({ sub_safe_id: subSafes[0]?.id ? String(subSafes[0].id) : '', transaction_date: today(), notes: '' });
              setShowMonthEndModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-2xl text-xs shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <Archive className="w-4 h-4 text-amber-400" />
            مراجعة وإقفال الشهر
          </button>

          {/* Audit / Recalculate Safe Balances Button */}
          <button
            onClick={handleRecalculateBalances}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs border border-slate-300 transition-all cursor-pointer shadow-2xs"
            title="تدقيق ومطابقة أرصدة الخزائن من واقع دفتر العمليات الفعلي"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            تدقيق الأرصدة 🔄
          </button>

          {/* Supabase Cloud Live Status */}
          <button
            onClick={checkSupabaseStatus}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold rounded-2xl text-xs shadow-sm hover:shadow transition-all cursor-pointer"
            title="فحص حالة المزامنة اللحظية مع قاعدة بيانات Supabase السحابية"
          >
            <Cloud className="w-4 h-4 text-emerald-200" />
            سوبابيز السحابي ☁️
          </button>

          {/* Add Safe */}
          <button
            onClick={() => {
              setEditSafe(null);
              setSafeForm({ name: '', type: 'sub', parent_safe_id: mainSafes[0]?.id || '', custodian_name: '', custodian_phone: '', custodian_employee_id: '', notes: '' });
              setShowNewSafeModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            خزينة جديدة
          </button>
        </div>
      </div>

      {/* ══════════════════ HERO KPI CARDS (فصل الخزينة الرئيسية عن الخزائن الفرعية) ══════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Main Safe Book Balance */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-4 sm:p-5 text-white shadow-md relative overflow-hidden border border-slate-700/50">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-xs font-bold text-slate-300 block">رصيد الخزينة الرئيسية (الدفتري)</span>
              <span className="text-[10px] text-slate-400">مسؤولية أمين الخزينة الرئيسي</span>
            </div>
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs shrink-0">
              <Building className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black tracking-tight font-mono break-all">{fmt(mainBalance)} <span className="text-xs font-normal">ج.م</span></p>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <span>الخزائن الرئيسية: ({mainSafes.length})</span>
            <span className="text-blue-300 font-bold">جاهز للصرف المركزي</span>
          </div>
        </div>

        {/* 2. Main Safe Physical Cash Drawer */}
        <div className="bg-gradient-to-br from-emerald-700 via-teal-700 to-emerald-800 rounded-3xl p-4 sm:p-5 text-white shadow-md relative overflow-hidden border border-emerald-500/30">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-xs font-bold text-emerald-100 flex items-center gap-1">
                <Coins className="w-4 h-4 text-amber-300 shrink-0" />
                درج الخزينة الرئيسية (الفعلي)
              </span>
              <span className="text-[10px] text-emerald-200/80">خاص بالخزينة الرئيسية فقط</span>
            </div>
            <button
              onClick={() => {
                const mainS = mainSafes[0] || safes[0];
                setDenomForm({
                  safe_id: mainS?.id ? String(mainS.id) : '',
                  snapshot_date: today(),
                  ...emptyDenom(),
                  notes: ''
                });
                setShowDenomModal(true);
              }}
              className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer shrink-0"
            >
              عدّ الدرج
            </button>
          </div>
          <p className="text-xl sm:text-2xl font-black tracking-tight font-mono text-amber-200 break-all">
            {fmt(mainPhysicalDrawer)} <span className="text-xs font-normal text-white">ج.م</span>
          </p>
          <p className="text-[10px] sm:text-[11px] text-emerald-100 mt-2 flex items-center gap-1 truncate">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            إجمالي فئات النقدية (200 إلى 5 جنيه) بالدرج
          </p>
        </div>

        {/* 3. Main Safe Drawer Matching & Variance */}
        <div className={`col-span-1 rounded-3xl p-4 sm:p-5 text-white shadow-md relative overflow-hidden border transition-all ${
          isExactDrawer
            ? 'bg-gradient-to-br from-emerald-600 to-green-700 border-emerald-400/40'
            : isDeficit
            ? 'bg-gradient-to-br from-rose-700 via-red-700 to-rose-800 border-rose-400 shadow-rose-900/30 ring-2 ring-rose-400/50'
            : 'bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 border-blue-400/40'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
            <span className="text-xs font-black tracking-wide flex items-center gap-1.5">
              {isExactDrawer ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
                  مطابقة درج الخزينة الرئيسية
                </>
              ) : isDeficit ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-200 animate-bounce shrink-0" />
                  عجز في درج الخزينة!
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-cyan-200 shrink-0" />
                  زيادة في درج الخزينة
                </>
              )}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setShowCfoShareModal(true)}
                className="px-2 py-1 bg-white/25 hover:bg-white/35 text-white font-bold rounded-xl text-[10px] backdrop-blur-xs transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                title="إرسال تقرير مطابقة الدرج عبر واتساب للمدير المالي"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-300" />
                <span className="hidden sm:inline">واتساب للمدير</span>
              </button>
              <button
                onClick={() => {
                  const mainS = mainSafes[0] || safes[0];
                  setDenomForm({
                    safe_id: mainS?.id ? String(mainS.id) : '',
                    snapshot_date: today(),
                    ...emptyDenom(),
                    notes: ''
                  });
                  setShowDenomModal(true);
                }}
                className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl text-[10px] backdrop-blur-xs transition-colors cursor-pointer"
              >
                تحديث
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xl sm:text-2xl font-black tracking-tight font-mono break-all">
              {isExactDrawer ? (
                <span className="text-white">مطابق 100%</span>
              ) : (
                <span>
                  {mainVariance > 0 ? `+${fmt(mainVariance)}` : fmt(mainVariance)} <span className="text-xs font-normal">ج.م</span>
                </span>
              )}
            </p>
            <p className="text-[10px] sm:text-[11px] text-white/90 font-medium leading-tight">
              {isExactDrawer
                ? 'الفارق صفر • الفعلي بالدرج يطابق الدفتري تماماً'
                : isDeficit
                ? `الفعلي بالدرج أقل من الدفتري بمبلغ ${fmt(Math.abs(mainVariance))} ج.م`
                : `الفعلي بالدرج يزيد عن الدفتري بمبلغ ${fmt(mainVariance)} ج.م`}
            </p>
          </div>
        </div>

        {/* 4. Sub Safes Independent Custodies */}
        <div className="bg-gradient-to-br from-amber-500 via-orange-600 to-amber-600 rounded-3xl p-4 sm:p-5 text-white shadow-md relative overflow-hidden border border-amber-300/30">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-xs font-bold text-amber-100 block">الخزائن الفرعية والعهد المستقلة</span>
              <span className="text-[10px] text-amber-200">عهدة منفصلة بذمة مسؤولي الفروع</span>
            </div>
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs shrink-0">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black tracking-tight font-mono break-all">{fmt(subBalance)} <span className="text-xs font-normal">ج.م</span></p>
          <div className="mt-2 text-[11px] text-amber-100 flex items-center justify-between">
            <span>عدد ({subSafes.length}) خزائن فرعية</span>
            <button
              onClick={() => setShowSubSafesBrowserModal(true)}
              className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1 shrink-0"
            >
              <Eye className="w-3.5 h-3.5" />
              استعراض ({subSafes.length})
            </button>
          </div>
        </div>
      </div>

      {/* WhatsApp Quick Notification Pill (After successful transaction) */}
      {lastTxReceipt && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-3xl p-5 shadow-sm animate-fadeIn">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 bg-emerald-500 text-white rounded-2xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-emerald-950 text-base">تم تسجيل الحركة وتحديث الخزينة والرواتب بنجاح ✓</h3>
                <p className="text-xs text-emerald-800">
                  المبلغ: <strong className="text-emerald-950 font-black text-sm">{fmt(lastTxReceipt.amount)} ج.م</strong> • 
                  الخزينة: <strong>{lastTxReceipt.safeName}</strong> • 
                  الرصيد بعد الحركة: <strong className="text-emerald-950 font-black">{fmt(lastTxReceipt.newBalance)} ج.م</strong>
                </p>
                {lastTxReceipt.courier_name && (
                  <p className="text-xs text-emerald-700">
                    الموظف / المستلم: <strong>{lastTxReceipt.courier_name}</strong>
                  </p>
                )}
                <p className="text-[11px] text-emerald-600 font-medium">
                  {lastTxReceipt.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {lastTxReceipt.sender_phone && (
                <a
                  href={`https://wa.me/${lastTxReceipt.sender_phone.replace(/[^0-9]/g, '').replace(/^0/, '20')}?text=${encodeURIComponent(
                    buildWhatsAppMessage({
                      amount: lastTxReceipt.amount,
                      date: lastTxReceipt.date,
                      safeName: lastTxReceipt.safeName,
                      courierName: lastTxReceipt.courier_name,
                      refNo: lastTxReceipt.refNo,
                      description: lastTxReceipt.description
                    })
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  إرسال رسالة واتساب ({lastTxReceipt.sender_phone})
                </a>
              )}

              <button
                onClick={() => setLastTxReceipt(null)}
                className="p-2 text-emerald-700 hover:bg-emerald-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Selector */}
      <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-2xl w-full md:w-auto overflow-x-auto">
        {[
          { id: 'safes', label: '🏦 كروت الخزائن والأرصدة' },
          { id: 'trusts', label: `🤝 الأمانات والعهد ومواعيد الرد (${trusts.filter(t => t.remaining_amount > 0).length})` },
          { id: 'transactions', label: '📋 دفتر حركات الخزينة' },
          { id: 'parties', label: '🏢 جهات وشركات التعامل (موردين / صيانة)' },
          { id: 'denominations', label: '🪙 درج الخزينة الرئيسية (الجرد)' },
          { id: 'drivers', label: '🚗 تقرير مصروفات السائقين (الفرعية)' },
          { id: 'farm', label: '🌾 حساب ومزرعة الشركة (إيرادات ومصروفات)' },
          { id: 'month-end', label: '📅 مراجعة وإقفال الشهر' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? 'bg-white shadow-xs text-emerald-800'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════ TAB 1: SAFES ══════════════════ */}
      {activeTab === 'safes' && (
        <div className="space-y-5">
          {loading ? (
            <div className="p-12 text-center text-slate-400 font-bold">جاري تحميل بيانات الخزائن...</div>
          ) : (
            <>
              {mainSafes.map(safe => (
                <div key={safe.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="p-4 sm:p-6 space-y-4 bg-gradient-to-l from-slate-50/50 to-white">
                    {/* Row 1: Safe Info & Balance Card (Clean, Responsive, Never Squished!) */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-200 shrink-0">
                          <Building className="w-6 h-6 sm:w-7 sm:h-7" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-black text-slate-800 text-base sm:text-lg">{safe.name}</h3>
                            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px] sm:text-[11px] font-black border border-blue-200">
                              خزينة رئيسية
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-500 mt-1">
                            {safe.custodian_name && (
                              <span className="flex items-center gap-1 font-semibold text-slate-700">
                                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                                أمين الخزينة: {safe.custodian_name}
                              </span>
                            )}
                            {safe.custodian_phone && (
                              <span className="flex items-center gap-1 text-emerald-600 font-mono font-bold" dir="ltr">
                                <Phone className="w-3.5 h-3.5" />
                                {safe.custodian_phone}
                              </span>
                            )}
                            {safe.notes && <span className="text-slate-400">({safe.notes})</span>}
                          </div>
                        </div>
                      </div>

                      {/* Balance Pill - Always wide and prominent, no vertical text breaking! */}
                      <div className="bg-emerald-50/80 border border-emerald-200/80 px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl flex items-center justify-between sm:block sm:text-left shrink-0">
                        <p className="text-[11px] font-bold text-emerald-700">الرصيد الدفتري الحالي</p>
                        <p className="text-xl sm:text-2xl font-black text-emerald-800 font-mono break-all mt-0.5 sm:mt-1">
                          {fmt(safe.current_balance)} <span className="text-xs font-semibold">ج.م</span>
                        </p>
                      </div>
                    </div>

                    {/* Row 2: Action Buttons Bar - wraps cleanly and never overflows! */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                      {/* 1. Custody Receive Button */}
                      <button
                        onClick={() => openCustodyReceiveModal(safe)}
                        className="flex-1 min-w-[115px] sm:flex-none px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                        title="استلام عهدة نقدية بالخزينة وإثبات الفئات بالدرج"
                      >
                        <ArrowDownCircle className="w-3.5 h-3.5" />
                        + استلام عهدة
                      </button>

                      {/* 2. Sub-Safe Replenish Button (Feed Sub Safe!) */}
                      <button
                        onClick={() => openSubReplenishModal(safe)}
                        className="flex-1 min-w-[135px] sm:flex-none px-3.5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                        title="تغذية خزينة فرعية وتحويل عهدة نقدية من الخزينة الرئيسية"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5 text-amber-200" />
                        🔄 تغذية خزينة فرعية
                      </button>

                      {/* 3. Disburse Trust / Custody */}
                      <button
                        onClick={() => openNewTrustModal(safe)}
                        className="flex-1 min-w-[135px] sm:flex-none px-3.5 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-700 hover:from-teal-700 hover:to-cyan-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                        title="صرف أمانة أو عهدة مؤقتة لشخص أو موظف مع تحديد موعد الرد"
                      >
                        <Coins className="w-3.5 h-3.5 text-teal-200" />
                        🤝 صرف أمانة / عهدة
                      </button>

                      {/* 4. Employee Disbursement */}
                      <button
                        onClick={() => openEmployeeDisburseModal(safe)}
                        className="flex-1 min-w-[130px] sm:flex-none px-3.5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                        title="نافذة موحدة لصرف مصروف يوم 10 أو 20 أو سلف الموظفين"
                      >
                        <Users className="w-3.5 h-3.5 text-purple-200" />
                        💵 صرف موظفين
                      </button>

                      {/* 5. Non-Employee Disbursement */}
                      <button
                        onClick={() => openPartyDisburseModal(safe)}
                        className="flex-1 min-w-[125px] sm:flex-none px-3.5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                        title="صرف لجهة أو شركة أو مورد أو فني مع رقم الفاتورة والإنقاص من الدرج"
                      >
                        <Building className="w-3.5 h-3.5 text-blue-200" />
                        🏢 صرف لجهات
                      </button>

                      {/* Edit Safe */}
                      <button
                        onClick={() => {
                          setEditSafe(safe);
                          setSafeForm({
                            name: safe.name,
                            type: safe.type,
                            parent_safe_id: '',
                            custodian_name: safe.custodian_name || '',
                            custodian_phone: safe.custodian_phone || '',
                            custodian_employee_id: safe.custodian_employee_id || '',
                            notes: safe.notes || '',
                            is_trust: safe.is_trust || 0
                          });
                          setShowNewSafeModal(true);
                        }}
                        className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer mr-auto sm:mr-0 shrink-0"
                        title="تعديل بيانات الخزينة"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Sub Safes Under This Main Safe */}
                  <div className="border-t border-slate-100 bg-slate-50/60 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5 text-amber-600" />
                        الخزائن الفرعية التابعة لهذه الخزينة:
                      </p>
                      <button
                        onClick={() => openSubReplenishModal(safe)}
                        className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        + تغذية خزينة فرعية
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {subSafes.filter(s => String(s.parent_safe_id) === String(safe.id)).map(sub => (
                        <div key={sub.id} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-3">
                          {/* Sub-Safe Header: Info & Balance (Never Overflows!) */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black text-slate-800 text-sm truncate">{sub.name}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                  sub.is_trust
                                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                    : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {sub.is_trust ? 'خزينة أمانات' : 'فرعية مستقلة'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 truncate">
                                المسؤول: {sub.custodian_name || 'غير محدد'} 
                                {sub.custodian_phone && <span className="mr-1.5 text-emerald-600 font-mono text-[11px]" dir="ltr">({sub.custodian_phone})</span>}
                              </p>
                            </div>

                            {/* Safe Balance Pill */}
                            <div className="text-left bg-amber-50/80 border border-amber-200/60 px-3 py-1.5 rounded-xl shrink-0">
                              <p className="text-[10px] text-amber-800 font-bold">رصيد العهدة</p>
                              <p className="font-black text-base sm:text-lg text-amber-900 font-mono">
                                {fmt(sub.current_balance)} <span className="text-[10px] font-sans font-normal">ج.م</span>
                              </p>
                            </div>
                          </div>

                          {/* Sub-Safe Action Bar: Responsive, wraps cleanly on mobile! */}
                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                            <button
                              onClick={() => {
                                setSelectedSubSafe(sub);
                                loadSubSafeTransactions(sub.id);
                              }}
                              className="flex-1 min-w-[105px] flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all hover:shadow"
                              title="الدخول ومراجعة دفتر حركات الخزينة الفرعية والصرف منها"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>دخول ومراجعة</span>
                            </button>

                            <button
                              onClick={() => openSubSafeExpenseModal(sub)}
                              className="flex-1 min-w-[95px] flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all hover:shadow"
                              title="صرف مصروف من الخزينة الفرعية برقم إيصال J1"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>صرف (J1)</span>
                            </button>

                            <button
                              onClick={() => openSubReplenishModal(safe, sub)}
                              className="flex-1 min-w-[105px] flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all hover:shadow"
                              title="تغذية الخزينة الفرعية بعهدة من الخزينة الرئيسية"
                            >
                              <ArrowDownCircle className="w-3.5 h-3.5" />
                              <span>+ تغذية العهدة</span>
                            </button>

                            <button
                              onClick={() => {
                                setEditSafe(sub);
                                setSafeForm({
                                  name: sub.name,
                                  type: sub.type,
                                  parent_safe_id: String(sub.parent_safe_id || safe.id),
                                  custodian_name: sub.custodian_name || '',
                                  custodian_phone: sub.custodian_phone || '',
                                  custodian_employee_id: sub.custodian_employee_id || '',
                                  notes: sub.notes || '',
                                  is_trust: sub.is_trust || 0
                                });
                                setShowNewSafeModal(true);
                              }}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors shrink-0"
                              title="تعديل بيانات الخزينة"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {subSafes.filter(s => String(s.parent_safe_id) === String(safe.id)).length === 0 && (
                        <div className="col-span-2 text-center py-4 bg-white rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400">
                          لا توجد خزائن فرعية مضافة حتى الآن. اضغط "خزينة جديدة" لإضافة خزينة فرعية لمخزن عرابي أو قسم آخر.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ══════════════════ TAB 2: TRANSACTIONS ══════════════════ */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">الخزينة</label>
              <select
                value={filterSafe}
                onChange={e => setFilterSafe(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-xs min-w-[170px]"
              >
                <option value="">كل الخزائن</option>
                {safes.map(s => <option key={s.id} value={s.id}>{s.name} ({s.type === 'main' ? 'رئيسية' : 'فرعية'})</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">نوع الحركة</label>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-xs min-w-[170px]"
              >
                <option value="">كل أنواع الحركات</option>
                {Object.entries(TX_TYPES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">من تاريخ</label>
              <input
                type="date"
                value={filterFrom}
                onChange={e => setFilterFrom(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">إلى تاريخ</label>
              <input
                type="date"
                value={filterTo}
                onChange={e => setFilterTo(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-xs"
              />
            </div>

            <button
              onClick={loadTransactions}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              تطبيق الفلتر
            </button>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs" dir="rtl">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="py-3 px-4 text-right font-bold text-slate-600">التاريخ</th>
                    <th className="py-3 px-4 text-right font-bold text-slate-600">الخزينة</th>
                    <th className="py-3 px-4 text-right font-bold text-slate-600">نوع الحركة</th>
                    <th className="py-3 px-4 text-right font-bold text-slate-600">البيان والوصف</th>
                    <th className="py-3 px-4 text-right font-bold text-slate-600">الموظف / السائق / المستلم</th>
                    <th className="py-3 px-4 text-center font-bold text-emerald-700 bg-emerald-50/50">وارد (+)</th>
                    <th className="py-3 px-4 text-center font-bold text-rose-700 bg-rose-50/50">صادر (-)</th>
                    <th className="py-3 px-4 text-center font-bold text-slate-800">الرصيد بعد</th>
                    <th className="py-3 px-4 text-center font-bold text-slate-600">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 font-semibold">
                        لا توجد حركات مسجلة تطابق خيارات الفلترة المحددة
                      </td>
                    </tr>
                  ) : transactions.map(tx => {
                    const txInfo = TX_TYPES[tx.type] || { label: tx.type, color: 'text-slate-600 bg-slate-50', dir: 'adj', icon: '📄' };
                    const isIn = txInfo.dir === 'in';
                    const isOut = txInfo.dir === 'out';

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-700 whitespace-nowrap">{tx.transaction_date}</td>
                        <td className="py-3 px-4 font-bold text-slate-800">{tx.safe_name}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${txInfo.color}`}>
                            <span>{txInfo.icon}</span>
                            <span>{txInfo.label}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 max-w-[260px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(tx.cost_center === 'farm' || tx.crop_type || tx.category?.includes('مزرعة')) && (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded-md font-bold text-[10px] border border-amber-300">
                                🌾 المزرعة
                              </span>
                            )}
                            <p className="font-medium truncate">{tx.description}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {tx.reference_no && (
                              <span className="text-[10px] text-slate-400 font-mono">إيصال: #{tx.reference_no}</span>
                            )}
                            {tx.receipt_image && (
                              <button
                                onClick={() => setViewReceiptImage(tx.receipt_image)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded font-bold text-[10px] cursor-pointer transition-colors"
                                title="معاينة صورة الفاتورة أو الإيصال"
                              >
                                <Camera className="w-3 h-3 text-blue-600" />
                                صورة المستند
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {tx.related_employee_name ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                              👤 {tx.related_employee_name}
                            </span>
                          ) : tx.related_safe_name ? (
                            <span className="text-blue-700 font-semibold">
                              ↔ {tx.related_safe_name}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-black text-emerald-700 bg-emerald-50/30 text-sm">
                          {isIn ? fmt(tx.amount) : '—'}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-black text-rose-700 bg-rose-50/30 text-sm">
                          {isOut ? fmt(tx.amount) : '—'}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-800 text-xs">
                          {fmt(tx.balance_after)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {tx.sender_phone && (
                              <a
                                href={`https://wa.me/${tx.sender_phone.replace(/[^0-9]/g, '').replace(/^0/, '20')}?text=${encodeURIComponent(
                                  buildWhatsAppMessage({
                                    amount: tx.amount,
                                    date: tx.transaction_date,
                                    safeName: tx.safe_name,
                                    courierName: tx.related_employee_name,
                                    refNo: tx.reference_no,
                                    description: tx.description
                                  })
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                title="إرسال رسالة واتساب"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button
                              onClick={() => handleDeleteTx(tx.id)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="حذف الحركة وعكس الرصيد"
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
          </div>
        </div>
      )}

      {/* ══════════════════ TAB: PARTIES (جهات وشركات التعامل الخارجي) ══════════════════ */}
      {activeTab === 'parties' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="بحث باسم الشركة أو النشاط أو المسؤول..."
                  value={partySearchTerm}
                  onChange={e => setPartySearchTerm(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <select
                  value={partyCategoryFilter}
                  onChange={e => setPartyCategoryFilter(e.target.value)}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white font-semibold"
                >
                  <option value="all">كل التصنيفات والأنشطة</option>
                  <option value="أحبار وطابعات">أحبار وطابعات ومستلزمات كمبيوتر</option>
                  <option value="كاميرات ومراقبة">كاميرات مراقبة وشبكات</option>
                  <option value="صيانة سيارات وكاوتش">صيانة سيارات وكاوتش وبنشر</option>
                  <option value="مهمات تشغيل ونظافة">مهمات تشغيل ونظافة وبوفيه</option>
                  <option value="أجهزة ومعدات">أجهزة ومعدات كهربائية</option>
                  <option value="صيانة عامة">صيانة عامة ومقاولات</option>
                  <option value="أخرى">أخرى ونثريات</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadParties}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                title="تحديث قائمة الجهات"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setEditParty(null);
                  setPartyForm({ name: '', party_type: 'company', category: 'أحبار وطابعات', contact_person: '', phone: '', tax_no: '', address: '', notes: '' });
                  setShowNewPartyModal(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                تكويد جهة / شركة جديدة
              </button>
            </div>
          </div>

          {/* Parties List / Table */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs" dir="rtl">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="py-3.5 px-4 text-right font-bold text-slate-700">الجهة / اسم الشركة</th>
                    <th className="py-3.5 px-4 text-right font-bold text-slate-700">التصنيف والنشاط</th>
                    <th className="py-3.5 px-4 text-right font-bold text-slate-700">المسؤول والتواصل</th>
                    <th className="py-3.5 px-4 text-center font-bold text-purple-700 bg-purple-50/50">إجمالي المسحوبات المنصرفة</th>
                    <th className="py-3.5 px-4 text-center font-bold text-slate-700">عدد العمليات</th>
                    <th className="py-3.5 px-4 text-center font-bold text-slate-700">آخر تعامل</th>
                    <th className="py-3.5 px-4 text-center font-bold text-slate-700">الإجراءات وكشف الحساب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredParties.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-semibold">
                        لا توجد جهات أو شركات مسجلة تطابق البحث. اضغط "تكويد جهة / شركة جديدة" للبدء.
                      </td>
                    </tr>
                  ) : filteredParties.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shrink-0">
                            🏢
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{p.name}</p>
                            {p.notes && <p className="text-[10px] text-slate-400">{p.notes}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <Tag className="w-3 h-3 text-purple-600" />
                          {p.category || 'عام'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {p.contact_person && <p className="font-semibold text-slate-800">{p.contact_person}</p>}
                        {p.phone && <p className="font-mono text-emerald-600 font-bold text-[11px]" dir="ltr">{p.phone}</p>}
                        {!p.contact_person && !p.phone && <span className="text-slate-400">—</span>}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-black text-purple-800 bg-purple-50/30 text-sm">
                        {fmt(p.total_spent)} ج.م
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700 font-mono">
                        {p.tx_count || 0}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-slate-500 whitespace-nowrap">
                        {p.last_transaction_date || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenStatement(p)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl text-xs shadow-2xs transition-all cursor-pointer"
                            title="مراجعة كشف الحساب التفصيلي"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            كشف الحساب والمراجعة
                          </button>
                          <button
                            onClick={() => {
                              setEditParty(p);
                              setPartyForm({
                                name: p.name,
                                party_type: p.party_type || 'company',
                                category: p.category || 'أحبار وطابعات',
                                contact_person: p.contact_person || '',
                                phone: p.phone || '',
                                tax_no: p.tax_no || '',
                                address: p.address || '',
                                notes: p.notes || ''
                              });
                              setShowNewPartyModal(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="تعديل بيانات الجهة"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteParty(p.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="حذف الجهة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ TAB 3: DENOMINATIONS (DRAWER) ══════════════════ */}
      {activeTab === 'denominations' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">الخزينة المحددة للجرد</label>
                <select
                  value={filterSafe}
                  onChange={e => setFilterSafe(e.target.value)}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-xs min-w-[180px]"
                >
                  <option value="">كل الخزائن</option>
                  {safes.map(s => <option key={s.id} value={s.id}>{s.name} (رصيد دفتري: {fmt(s.current_balance)})</option>)}
                </select>
              </div>
              <button
                onClick={loadDenominations}
                className="mt-5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> تحديث
              </button>
            </div>

            <button
              onClick={() => {
                setDenomForm({
                  safe_id: filterSafe || (safes[0]?.id ? String(safes[0].id) : ''),
                  snapshot_date: today(),
                  notes: 'جرد فعلي دوري للدرج',
                  ...emptyDenom()
                });
                setShowDenomModal(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow-sm cursor-pointer"
            >
              <Coins className="w-4 h-4 text-amber-300" />
              تسجيل جرد فعلي جديد للدرج
            </button>
          </div>

          {/* Denominations History Table */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs" dir="rtl">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-center font-bold text-slate-600">
                    <th className="py-3 px-3 text-right">التاريخ</th>
                    <th className="py-3 px-3 text-right">الخزينة</th>
                    <th className="py-3 px-2">200 ج</th>
                    <th className="py-3 px-2">100 ج</th>
                    <th className="py-3 px-2">50 ج</th>
                    <th className="py-3 px-2">20 ج</th>
                    <th className="py-3 px-2">10 ج</th>
                    <th className="py-3 px-2">5 ج</th>
                    <th className="py-3 px-3 bg-emerald-50 text-emerald-800">إجمالي الفعلي (الدرج)</th>
                    <th className="py-3 px-3 bg-blue-50 text-blue-800">الرصيد الدفتري</th>
                    <th className="py-3 px-3 bg-slate-100 text-slate-800">مطابقة الفارق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {denominations.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400 font-semibold">
                        لا توجد سجلات جرد فعلي مسجلة حتى الآن. اضغط "تسجيل جرد فعلي جديد" لإدخال فئات الدرج ومطابقتها.
                      </td>
                    </tr>
                  ) : denominations.map(d => {
                    const diff = Number(d.difference || 0);
                    const isExact = Math.abs(diff) < 0.01;

                    return (
                      <tr key={d.id} className={`hover:bg-slate-50/80 transition-colors ${!isExact ? 'bg-amber-50/40' : ''}`}>
                        <td className="py-3 px-3 font-mono font-bold text-slate-700 whitespace-nowrap text-right">{d.snapshot_date}</td>
                        <td className="py-3 px-3 font-bold text-slate-800 text-right">{d.safe_name}</td>
                        <td className="py-3 px-2 text-center font-mono font-semibold">{d.count_200 || 0}</td>
                        <td className="py-3 px-2 text-center font-mono font-semibold">{d.count_100 || 0}</td>
                        <td className="py-3 px-2 text-center font-mono font-semibold">{d.count_50 || 0}</td>
                        <td className="py-3 px-2 text-center font-mono font-semibold">{d.count_20 || 0}</td>
                        <td className="py-3 px-2 text-center font-mono font-semibold">{d.count_10 || 0}</td>
                        <td className="py-3 px-2 text-center font-mono font-semibold">{d.count_5 || 0}</td>
                        <td className="py-3 px-3 text-center font-mono font-black text-emerald-700 bg-emerald-50/40 text-sm">
                          {fmt(d.total_physical)}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-blue-700 bg-blue-50/40 text-xs">
                          {fmt(d.book_balance)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {isExact ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ مطابق تماماً
                            </span>
                          ) : diff > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300">
                              زيادة +{fmt(diff)} ج
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                              عجز {fmt(diff)} ج
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ TAB: DRIVERS EXPENSES REPORT (تقرير مصروفات السائقين للعهد والفرعية) ══════════════════ */}
      {activeTab === 'drivers' && (
        <div className="space-y-6">
          {/* Header & Filter Card */}
          <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 text-blue-700 rounded-2xl">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base md:text-lg">
                    تقرير مصروفات السائقين للخزائن والعهد الفرعية
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    تتبع مصروفات كارتات الطرق والرسوم والكاوتش والصيانة مصنفة باسم السائق لارتباط كل سائق بسيارة
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  طباعة التقرير
                </button>
                <button
                  onClick={loadDriverReport}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  title="تحديث البيانات"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">الخزينة المصروف منها</label>
                <select
                  value={driverFilterSafe}
                  onChange={e => setDriverFilterSafe(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 font-semibold"
                >
                  <option value="">جميع الخزائن (الرئيسية والفرعية)</option>
                  {safes.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.type === 'main' ? 'رئيسية' : 'فرعية'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">تحديد سائق معين</label>
                <select
                  value={driverFilterName}
                  onChange={e => setDriverFilterName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 font-semibold"
                >
                  <option value="all">جميع السائقين والمندوبين</option>
                  {(driverReportData.driversList || []).map((name, i) => (
                    <option key={i} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">من تاريخ</label>
                <input
                  type="date"
                  value={driverFilterFrom}
                  onChange={e => setDriverFilterFrom(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">إلى تاريخ</label>
                <input
                  type="date"
                  value={driverFilterTo}
                  onChange={e => setDriverFilterTo(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Driver KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 block">إجمالي ما صُرف للسائقين</span>
              <p className="text-xl font-black font-mono text-blue-900 mt-1">
                {fmt(driverReportData.totalOverall)} <span className="text-xs font-normal">ج.م</span>
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 block">عدد إيصالات المصروف</span>
              <p className="text-xl font-black font-mono text-slate-800 mt-1">
                {driverReportData.totalReceipts} <span className="text-xs font-normal">إيصال</span>
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 block">🛣️ كارتات طريق وموازين</span>
              <p className="text-lg font-black font-mono text-emerald-800 mt-1">
                {fmt((driverReportData.summary || []).reduce((acc, d) => acc + (d.toll_amount || 0), 0))} <span className="text-xs font-normal">ج.م</span>
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 block">🚗 كاوتش وبنشر وصيانة</span>
              <p className="text-lg font-black font-mono text-amber-800 mt-1">
                {fmt((driverReportData.summary || []).reduce((acc, d) => acc + (d.maintenance_amount || 0), 0))} <span className="text-xs font-normal">ج.م</span>
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 block">نثريات ومهمات وبوفيه</span>
              <p className="text-lg font-black font-mono text-purple-800 mt-1">
                {fmt((driverReportData.summary || []).reduce((acc, d) => acc + (d.supplies_amount || 0) + (d.tips_amount || 0) + (d.other_amount || 0), 0))} <span className="text-xs font-normal">ج.م</span>
              </p>
            </div>
          </div>

          {/* Drivers Summary Table */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-600" />
                ملخص إجمالي مصروفات السائقين (مرتبة حسب الأعلى صرفاً):
              </h4>
              <span className="text-xs text-slate-400 font-mono">
                {(driverReportData.summary || []).length} سائق / مندوب
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs" dir="rtl">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-3 text-right font-bold text-slate-700">اسم السائق</th>
                    <th className="py-3 px-2 text-center font-bold text-slate-700">عدد الإيصالات</th>
                    <th className="py-3 px-3 text-center font-bold text-emerald-800">كارتات طريق وبوابات</th>
                    <th className="py-3 px-3 text-center font-bold text-amber-800">كاوتش وبنشر وصيانة</th>
                    <th className="py-3 px-3 text-center font-bold text-purple-800">مهمات وبوفيه</th>
                    <th className="py-3 px-3 text-center font-bold text-indigo-800">إكراميات ونثريات</th>
                    <th className="py-3 px-3 text-center font-bold text-slate-700">أخرى</th>
                    <th className="py-3 px-4 text-center font-bold text-blue-900 bg-blue-50/60">إجمالي المنصرف</th>
                    <th className="py-3 px-3 text-center font-bold text-slate-700">تصفية السائق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(driverReportData.summary || []).length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-400 font-semibold">
                        لا توجد مصروفات مسجلة للسائقين تطابق شروط التصفية
                      </td>
                    </tr>
                  ) : (
                    driverReportData.summary.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                              🚗
                            </div>
                            <span className="font-bold text-slate-900 text-sm">{row.driver_name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center font-mono font-bold text-slate-700">{row.receipts_count}</td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700">{fmt(row.toll_amount)} ج</td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-amber-700">{fmt(row.maintenance_amount)} ج</td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-purple-700">{fmt(row.supplies_amount)} ج</td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-indigo-700">{fmt(row.tips_amount)} ج</td>
                        <td className="py-3 px-3 text-center font-mono text-slate-600">{fmt(row.other_amount)} ج</td>
                        <td className="py-3 px-4 text-center font-mono font-black text-blue-900 bg-blue-50/40 text-sm">
                          {fmt(row.total_amount)} ج.م
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => setDriverFilterName(row.driver_name)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-blue-100 hover:text-blue-800 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            عرض الحركات
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
                  <tr>
                    <td colSpan={7} className="py-3 px-4 text-left font-black text-slate-800">
                      إجمالي مصروفات كل السائقين:
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-black text-blue-950 text-sm bg-blue-100/50">
                      {fmt(driverReportData.totalOverall)} ج.م
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Detailed Receipts Table */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-600" />
                سجل إيصالات وتفاصيل مصروفات السائقين ({(driverReportData.details || []).length} إيصال):
              </h4>
              {driverFilterName !== 'all' && (
                <button
                  onClick={() => setDriverFilterName('all')}
                  className="text-xs text-blue-600 hover:underline font-bold"
                >
                  إلغاء التصفية (عرض كل السائقين)
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs" dir="rtl">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-3 text-right font-bold text-slate-700">التاريخ</th>
                    <th className="py-2.5 px-3 text-right font-bold text-slate-700">السائق المستلم</th>
                    <th className="py-2.5 px-3 text-right font-bold text-slate-700">الخزينة المصروف منها</th>
                    <th className="py-2.5 px-3 text-right font-bold text-slate-700">التصنيف والبيان</th>
                    <th className="py-2.5 px-2 text-center font-bold text-slate-700">رقم الإيصال</th>
                    <th className="py-2.5 px-3 text-center font-bold text-slate-700">صورة الإيصال / الكارتة</th>
                    <th className="py-2.5 px-3 text-center font-bold text-rose-800 bg-rose-50/50">المبلغ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(driverReportData.details || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-semibold">
                        لا توجد حركات تفصيلية مسجلة
                      </td>
                    </tr>
                  ) : (
                    driverReportData.details.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700 whitespace-nowrap">{t.transaction_date}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{t.related_employee_name}</td>
                        <td className="py-2.5 px-3 text-slate-700">{t.safe_name}</td>
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-slate-800">{t.description}</p>
                          <span className="text-[10px] text-slate-400 font-bold block">{t.category}</span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-amber-800 bg-amber-50/60 rounded">
                          {t.reference_no || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {t.receipt_image ? (
                            <button
                              onClick={() => setViewReceiptImage(t.receipt_image)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-bold hover:bg-blue-100 cursor-pointer"
                            >
                              <Image className="w-3.5 h-3.5" />
                              معاينة
                            </button>
                          ) : (
                            <span className="text-slate-300 text-[10px]">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-black text-rose-700 bg-rose-50/30 text-sm">
                          {fmt(t.amount)} ج.م
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

      {/* ══════════════════ TAB: FARM P&L & ACCOUNT (سجل وحساب مزرعة الشركة) ══════════════════ */}
      {activeTab === 'farm' && (
        <div className="space-y-6">
          {/* Farm Header Banner */}
          <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 rounded-3xl p-6 text-white shadow-lg space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/10 backdrop-blur-xs rounded-2xl text-emerald-300">
                  <Sprout className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-black text-xl md:text-2xl">
                    حساب ومزرعة الشركة — إيرادات ومصروفات
                  </h3>
                  <p className="text-xs text-emerald-200 mt-1">
                    إدارة شاملة لمبيعات محاصيل المزرعة (مانجو، بلح) وتكاليف الأسمدة والتقليم والشتلات المصروفة من الخزينة الرئيسية أو خزينة المزرعة الفرعية
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={openFarmSaleModal}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-amber-950 font-black rounded-xl text-xs shadow-md transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  توريد بيع محصول جديد 🥭
                </button>

                <button
                  onClick={() => openPartyDisburseModal()}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  <DollarSign className="w-4 h-4" />
                  صرف مستلزمات زراعية 🌿
                </button>

                {!farmReportData.farmSafe && (
                  <button
                    onClick={handleCreateFarmSafe}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
                    title="إنشاء خزينة فرعية مستقلة باسم المزرعة"
                  >
                    + إنشاء خزينة المزرعة
                  </button>
                )}
              </div>
            </div>

            {/* Farm Safe Mini Banner */}
            {farmReportData.farmSafe && (
              <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs border border-white/15">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-emerald-200">الخزينة الفرعية للمزرعة:</span>
                  <span className="font-black text-white">{farmReportData.farmSafe.name}</span>
                  <span className="text-emerald-300">({farmReportData.farmSafe.custodian_name || 'مسؤول المزرعة'})</span>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-emerald-200 ml-1">الرصيد النقدي الحالي بالمزرعة:</span>
                    <strong className="font-mono text-base font-black text-amber-300">{fmt(farmReportData.farmSafe.current_balance)} ج.م</strong>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedSubSafe(farmReportData.farmSafe);
                      openSubSafeExpenseModal(farmReportData.farmSafe, 'مصاريف زراعية وعمالة');
                    }}
                    className="px-3 py-1 bg-white text-emerald-900 rounded-lg font-bold hover:bg-emerald-50 cursor-pointer shadow-xs text-xs"
                  >
                    صرف نقدي من المزرعة (J1)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Farm KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 block">🥭 مبيعات المانجو</span>
              <p className="text-lg font-black font-mono text-amber-700 mt-1">
                {fmt(farmReportData.metrics.mangoSales)} <span className="text-xs font-normal">ج.م</span>
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 block">🌴 مبيعات البلح</span>
              <p className="text-lg font-black font-mono text-amber-800 mt-1">
                {fmt(farmReportData.metrics.dateSales)} <span className="text-xs font-normal">ج.م</span>
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-700 block">🌾 إجمالي إيرادات المحاصيل</span>
              <p className="text-xl font-black font-mono text-emerald-800 mt-1">
                {fmt(farmReportData.metrics.totalCropSales)} <span className="text-xs font-normal">ج.م</span>
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs">
              <span className="text-[11px] font-bold text-purple-700 block">🏢 منصرف من الخزينة الرئيسية</span>
              <p className="text-lg font-black font-mono text-purple-900 mt-1">
                {fmt(farmReportData.metrics.mainExpenses)} <span className="text-xs font-normal">ج.م</span>
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs">
              <span className="text-[11px] font-bold text-rose-700 block">🚜 منصرف من خزينة المزرعة</span>
              <p className="text-lg font-black font-mono text-rose-800 mt-1">
                {fmt(farmReportData.metrics.subExpenses)} <span className="text-xs font-normal">ج.م</span>
              </p>
            </div>

            <div className={`rounded-2xl border p-4 shadow-xs ${farmReportData.metrics.netProfit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
              <span className="text-[11px] font-bold block text-slate-600">
                {farmReportData.metrics.netProfit >= 0 ? '💰 صافي ربح المزرعة' : '⚠️ صافي عجز المزرعة'}
              </span>
              <p className={`text-xl font-black font-mono mt-1 ${farmReportData.metrics.netProfit >= 0 ? 'text-emerald-900' : 'text-rose-900'}`}>
                {fmt(farmReportData.metrics.netProfit)} <span className="text-xs font-normal">ج.م</span>
              </p>
            </div>
          </div>

          {/* Date Filter & Farm Ledger */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">تصفية التاريخ:</span>
                <input
                  type="date"
                  value={farmFilterFrom}
                  onChange={e => setFarmFilterFrom(e.target.value)}
                  className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono"
                />
                <span className="text-xs text-slate-400">إلى</span>
                <input
                  type="date"
                  value={farmFilterTo}
                  onChange={e => setFarmFilterTo(e.target.value)}
                  className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono"
                />
                <button
                  onClick={loadFarmReport}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold cursor-pointer"
                >
                  تحديث
                </button>
              </div>

              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                طباعة تقرير المزرعة
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs" dir="rtl">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 text-right font-bold text-slate-700">التاريخ</th>
                    <th className="py-2.5 px-3 text-right font-bold text-slate-700">نوع الحركة</th>
                    <th className="py-2.5 px-3 text-right font-bold text-slate-700">الخزينة المسؤولة</th>
                    <th className="py-2.5 px-3 text-right font-bold text-slate-700">البيان والتفاصيل</th>
                    <th className="py-2.5 px-3 text-right font-bold text-slate-700">الطرف المعني / التاجر</th>
                    <th className="py-2.5 px-2 text-center font-bold text-slate-700">رقم السند</th>
                    <th className="py-2.5 px-3 text-center font-bold text-slate-700">الصورة / وزنة</th>
                    <th className="py-2.5 px-3 text-center font-bold text-emerald-800 bg-emerald-50/50">إيراد مبيعات (+)</th>
                    <th className="py-2.5 px-3 text-center font-bold text-rose-800 bg-rose-50/50">تكاليف ومنصرف (-)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(farmReportData.transactions || []).length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-400 font-semibold">
                        لا توجد حركات مسجلة لحساب المزرعة حتى الآن. اضغط "توريد بيع محصول جديد" لتسجيل أول حركة.
                      </td>
                    </tr>
                  ) : (
                    farmReportData.transactions.map(t => {
                      const isIncome = t.type === 'farm_sale' || t.type === 'income';

                      return (
                        <tr key={t.id} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-700 whitespace-nowrap">{t.transaction_date}</td>
                          <td className="py-2.5 px-3">
                            {isIncome ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                🌾 {t.crop_type ? `بيع ${t.crop_type}` : 'توريد محصول'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                🚜 مصروف زراعي
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            {t.safe_name}
                            <span className="text-[10px] text-slate-400 block font-normal">
                              {t.safe_type === 'main' ? 'خزينة رئيسية' : 'خزينة فرعية'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-800">
                            <p className="font-semibold">{t.description}</p>
                            {t.category && <span className="text-[10px] text-slate-400 font-bold block">{t.category}</span>}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-700">{t.related_employee_name || '—'}</td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-800 bg-emerald-50/60 rounded">
                            {t.reference_no || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {t.receipt_image ? (
                              <button
                                onClick={() => setViewReceiptImage(t.receipt_image)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-bold hover:bg-blue-100 cursor-pointer"
                              >
                                <Image className="w-3.5 h-3.5" />
                                معاينة
                              </button>
                            ) : (
                              <span className="text-slate-300 text-[10px]">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-black text-emerald-700 bg-emerald-50/30 text-sm">
                            {isIncome ? `${fmt(t.amount)} ج.م` : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-black text-rose-700 bg-rose-50/30 text-sm">
                            {!isIncome ? `${fmt(t.amount)} ج.م` : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
                  <tr>
                    <td colSpan={7} className="py-3 px-4 text-left font-black text-slate-800">
                      إجمالي الإيرادات والمصروفات:
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-black text-emerald-800 bg-emerald-100/50 text-sm">
                      +{fmt(farmReportData.metrics.totalCropSales)} ج.م
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-black text-rose-800 bg-rose-100/50 text-sm">
                      -{fmt(farmReportData.metrics.totalExpenses)} ج.م
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ TAB 4: MONTH END CLOSE ══════════════════ */}
      {activeTab === 'month-end' && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-xs space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="p-3 bg-amber-100 text-amber-800 rounded-2xl">
                <Archive className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-lg">مراجعة الخزائن الفرعية ورد المتبقي للخزينة الرئيسية</h3>
                <p className="text-xs text-slate-500 mt-0.5">في نهاية الشهر أو بداية شهر جديد لتصفية العهدة الدورية</p>
              </div>
            </div>

            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 text-xs text-amber-900 space-y-2">
              <p className="font-bold text-sm flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                آلية الإقفال وتصفية العهدة الشهرية:
              </p>
              <ul className="list-disc list-inside space-y-1 text-amber-800 pr-2">
                <li>يتم حصر رصيد الخزينة الفرعية المتبقي بدقة.</li>
                <li>يتم توليد حركة رد عهدة في الخزينة الفرعية تصفّر رصيدها تماماً (0.00 ج.م).</li>
                <li>يتم قيد المبلغ المردود آلياً كـ <strong>تحويل وارد</strong> إلى الخزينة الرئيسية ويزيد رصيدها بنفس القيمة.</li>
                <li>يمكن بدء الشهر الجديد بتغذية عهدة جديدة للخزينة الفرعية حسب حاجة العمل.</li>
              </ul>
            </div>

            {/* Current Sub Safes Balances */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700">الخزائن الفرعية المتاحة للإقفال:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {subSafes.map(sub => (
                  <div key={sub.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{sub.name}</p>
                      <p className="text-xs text-slate-500">أمين الخزينة: {sub.custodian_name || 'غير محدد'}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] text-slate-400 font-bold">المتبقي للرد</p>
                      <p className="font-black text-lg text-amber-700 font-mono">{fmt(sub.current_balance)} ج.م</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Close Execution Form */}
            <form onSubmit={handleMonthEnd} className="space-y-4 pt-2 border-t border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">اختر الخزينة الفرعية المراد إقفالها *</label>
                  <select
                    required
                    value={monthEndForm.sub_safe_id}
                    onChange={e => setMonthEndForm(f => ({ ...f, sub_safe_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold bg-white"
                  >
                    <option value="">-- اختر الخزينة الفرعية --</option>
                    {subSafes.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} — الرصيد المتبقي: {fmt(s.current_balance)} ج.م
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">تاريخ الإقفال والرد *</label>
                  <input
                    type="date"
                    required
                    value={monthEndForm.transaction_date}
                    onChange={e => setMonthEndForm(f => ({ ...f, transaction_date: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">ملاحظات وبيان الإقفال</label>
                <input
                  type="text"
                  value={monthEndForm.notes}
                  onChange={e => setMonthEndForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="مثال: إقفال عهدة شهر أكتوبر 2026 بعد سداد كافة المصروفات..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={saving || !monthEndForm.sub_safe_id}
                className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-black text-sm rounded-2xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Archive className="w-4 h-4" />
                {saving ? 'جاري تنفيذ الإقفال والرد...' : 'تنفيذ إقفال الخزينة الفرعية ورد المتبقي للرئيسية'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════ TAB: TRUSTS & TEMPORARY CUSTODIES (الأمانات والعهد ومواعيد الرد) ══════════════════ */}
      {activeTab === 'trusts' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-gradient-to-r from-teal-800 via-teal-900 to-slate-900 rounded-3xl p-6 text-white shadow-md flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center shrink-0">
                <Coins className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black">سجل الأمانات والعهد المؤقتة ومتابعة مواعيد الرد</h2>
                  <span className="px-2.5 py-0.5 bg-teal-500/30 text-teal-200 border border-teal-500/40 rounded-full text-xs font-bold">
                    خزينة الأمانات والعهد
                  </span>
                </div>
                <p className="text-xs text-teal-100/80 mt-1 max-w-2xl">
                  متابعة المبالغ المنصرفة على سبيل الأمانة أو العهدة لموظفين أو أشخاص خارجيين، مع تحديد موعد الرد، وعند رد المبلغ يتم إيداعه بالخزينة وتصفيته وحذفه من عليه آلياً.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadTrusts}
                className="p-2.5 text-teal-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                title="تحديث البيانات"
              >
                <RefreshCw className={`w-4 h-4 ${trustsLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => openNewTrustModal()}
                className="flex items-center gap-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black rounded-xl text-xs shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                صرف أمانة / عهدة جديدة
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs min-w-0">
              <span className="text-xs font-bold text-slate-500 block truncate">إجمالي الأمانات المصروفة</span>
              <p className="text-xl sm:text-2xl font-black font-mono text-slate-800 mt-1 truncate">
                {fmt(trusts.reduce((s, t) => s + (t.amount || 0), 0))} <span className="text-xs font-sans text-slate-400 font-normal">ج.م</span>
              </p>
            </div>

            <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200 shadow-xs min-w-0">
              <span className="text-xs font-bold text-rose-800 block truncate">المتبقي غير المسدد (عهود قائمة)</span>
              <p className="text-xl sm:text-2xl font-black font-mono text-rose-700 mt-1 truncate">
                {fmt(trusts.reduce((s, t) => s + (t.remaining_amount || 0), 0))} <span className="text-xs font-sans text-rose-500 font-normal">ج.م</span>
              </p>
            </div>

            <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-xs min-w-0">
              <span className="text-xs font-bold text-emerald-800 block truncate">إجمالي ما تم استرداده للخزينة</span>
              <p className="text-xl sm:text-2xl font-black font-mono text-emerald-700 mt-1 truncate">
                {fmt(trusts.reduce((s, t) => s + (t.returned_amount || 0), 0))} <span className="text-xs font-sans text-emerald-500 font-normal">ج.م</span>
              </p>
            </div>

            <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 shadow-xs min-w-0">
              <span className="text-xs font-bold text-amber-800 block truncate">أمانات متأخرة تجاوزت موعد الرد</span>
              <p className="text-xl sm:text-2xl font-black font-mono text-amber-900 mt-1 truncate">
                {trusts.filter(t => t.is_overdue).length} <span className="text-xs font-sans text-amber-700 font-normal">أمانة متأخرة</span>
              </p>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {[
                { id: 'all', label: `الكل (${trusts.length})` },
                { id: 'active', label: `عهود قائمة طرف الأشخاص (${trusts.filter(t => t.remaining_amount > 0 && !t.is_overdue).length})` },
                { id: 'overdue', label: `⚠️ متأخرة عن موعد الرد (${trusts.filter(t => t.is_overdue).length})` },
                { id: 'returned', label: `✓ تم الرد والتصفية (${trusts.filter(t => t.remaining_amount <= 0.01).length})` }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setTrustFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    trustFilter === f.id
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="بحث بالاسم، الهاتف، أو الغرض..."
                value={trustSearch}
                onChange={e => setTrustSearch(e.target.value)}
                className="w-full pr-9 pl-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-teal-500"
              />
            </div>
          </div>

          {/* List of Trusts */}
          <div className="space-y-3">
            {trusts
              .filter(t => {
                if (trustFilter === 'active') return t.remaining_amount > 0 && !t.is_overdue;
                if (trustFilter === 'overdue') return t.is_overdue;
                if (trustFilter === 'returned') return t.remaining_amount <= 0.01;
                return true;
              })
              .filter(t => {
                if (!trustSearch) return true;
                const q = trustSearch.toLowerCase();
                return (
                  t.person_name?.toLowerCase().includes(q) ||
                  t.person_phone?.includes(q) ||
                  t.purpose?.toLowerCase().includes(q) ||
                  t.safe_name?.toLowerCase().includes(q)
                );
              })
              .length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center text-slate-400 border border-dashed border-slate-200 space-y-2">
                  <Coins className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="font-bold text-sm">لا توجد أمانات أو عهد مسجلة بهذا الفلتر</p>
                  <p className="text-xs text-slate-400">اضغط "صرف أمانة / عهدة جديدة" لتسجيل مبلغ طرف شخص وتحديد موعد الرد</p>
                </div>
              ) : (
                trusts
                  .filter(t => {
                    if (trustFilter === 'active') return t.remaining_amount > 0 && !t.is_overdue;
                    if (trustFilter === 'overdue') return t.is_overdue;
                    if (trustFilter === 'returned') return t.remaining_amount <= 0.01;
                    return true;
                  })
                  .filter(t => {
                    if (!trustSearch) return true;
                    const q = trustSearch.toLowerCase();
                    return (
                      t.person_name?.toLowerCase().includes(q) ||
                      t.person_phone?.includes(q) ||
                      t.purpose?.toLowerCase().includes(q) ||
                      t.safe_name?.toLowerCase().includes(q)
                    );
                  })
                  .map(t => {
                    const isFullyReturned = t.remaining_amount <= 0.01;
                    return (
                      <div
                        key={t.id}
                        className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all shadow-xs space-y-3 ${
                          t.is_overdue
                            ? 'border-rose-300 bg-rose-50/20'
                            : isFullyReturned
                            ? 'border-emerald-200 bg-emerald-50/20'
                            : 'border-slate-200'
                        }`}
                      >
                        {/* Top: Person Info, Status Badge, Due Date */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base shrink-0 ${
                              isFullyReturned
                                ? 'bg-emerald-100 text-emerald-800'
                                : t.is_overdue
                                ? 'bg-rose-100 text-rose-800 animate-pulse'
                                : 'bg-teal-100 text-teal-800'
                            }`}>
                              {t.person_type === 'employee' ? '👤' : '🏢'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black text-slate-800 text-sm">{t.person_name}</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                  {t.person_type === 'employee' ? 'موظف بالشركة' : 'شخص خارجي'}
                                </span>
                                {t.safe_name && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    {t.safe_name}
                                  </span>
                                )}
                              </div>
                              {t.person_phone && (
                                <p className="text-xs text-slate-500 font-mono mt-0.5" dir="ltr">
                                  📞 {t.person_phone}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Due Date & Smart Status Badge */}
                          <div className="flex items-center gap-2 shrink-0">
                            {isFullyReturned ? (
                              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                تم الرد بالكامل وتصفية العهدة
                              </span>
                            ) : t.is_overdue ? (
                              <span className="px-3 py-1 bg-rose-100 text-rose-800 border border-rose-300 rounded-xl text-xs font-black flex items-center gap-1.5 animate-bounce">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                متأخرة عن موعد الرد! (الموعد: {t.due_date})
                              </span>
                            ) : (
                              <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-amber-700" />
                                موعد الرد المحدد: {t.due_date}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Middle: Financials & Purpose */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-3 rounded-xl text-xs">
                          <div>
                            <span className="text-[11px] text-slate-400 block font-bold">مبلغ الأمانة الأصلي</span>
                            <p className="font-mono font-bold text-slate-800 text-sm mt-0.5">{fmt(t.amount)} ج.م</p>
                          </div>

                          <div>
                            <span className="text-[11px] text-slate-400 block font-bold">ما تم رده واسترداده</span>
                            <p className="font-mono font-bold text-emerald-700 text-sm mt-0.5">{fmt(t.returned_amount)} ج.م</p>
                          </div>

                          <div>
                            <span className="text-[11px] font-bold block text-rose-700">المتبقي طرفه (غير مسدد)</span>
                            <p className="font-mono font-black text-rose-700 text-base mt-0.5">
                              {fmt(t.remaining_amount)} <span className="text-xs font-sans">ج.م</span>
                            </p>
                          </div>

                          <div>
                            <span className="text-[11px] text-slate-400 block font-bold">تاريخ الاستلام</span>
                            <p className="font-mono text-slate-600 text-xs mt-0.5">{t.given_date}</p>
                          </div>
                        </div>

                        {/* Purpose & Notes */}
                        {(t.purpose || t.notes) && (
                          <div className="text-xs text-slate-600 bg-white p-2 rounded-lg border border-slate-100 flex items-center gap-2">
                            <span className="font-bold text-slate-700">الغرض / البيان:</span>
                            <span>{t.purpose || t.notes}</span>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                          <div className="text-[11px] text-slate-400">
                            {isFullyReturned ? (
                              <span className="text-emerald-700 font-bold">✓ تم إخلاء طرف المستلم وتصفية المبلغ بالكامل من عليه</span>
                            ) : (
                              <span>الأمانة قائمة ومسجلة على ذمة المستلم حتى تاريخ الرد</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {!isFullyReturned && (
                              <button
                                onClick={() => openReturnTrustModal(t)}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
                              >
                                <ArrowDownCircle className="w-3.5 h-3.5" />
                                <span>↩️ إثبات رد الأمانة (إخلاء طرف)</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteTrust(t.id, t.person_name)}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                              title="حذف / إلغاء الأمانة"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL: SUB-SAFE REPLENISH (تغذية الخزينة الفرعية بعهدة) ══════════════════ */}
      {showSubReplenishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-100 p-6 space-y-5 my-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-amber-100 text-amber-800 rounded-2xl">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">
                    تغذية خزينة فرعية بعهدة نقدية
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    تحويل عهدة من الخزينة الرئيسية إلى خزينة فرعية ومطابقة الرصيدين
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSubReplenishModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubReplenishSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Source Safe (Main) */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">الخزينة المصدر (الرئيسية) *</label>
                  <select
                    required
                    value={subReplenishForm.main_safe_id}
                    onChange={e => setSubReplenishForm(f => ({ ...f, main_safe_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-bold bg-slate-50"
                  >
                    {mainSafes.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} (رصيد: {fmt(s.current_balance)} ج.م)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Target Sub Safe */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">الخزينة الفرعية المستلمة للعهدة *</label>
                  <select
                    required
                    value={subReplenishForm.sub_safe_id}
                    onChange={e => {
                      const selected = subSafes.find(s => String(s.id) === e.target.value);
                      setSubReplenishForm(f => ({
                        ...f,
                        sub_safe_id: e.target.value,
                        custodian_name: selected?.custodian_name || f.custodian_name,
                        notes: selected ? `تغذية عهدة نقدية لخزينة ${selected.name}` : f.notes
                      }));
                    }}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-bold bg-white focus:outline-amber-500"
                  >
                    <option value="">-- اختر الخزينة الفرعية --</option>
                    {subSafes.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} — المسؤول: {s.custodian_name || 'غير محدد'} (رصيدها الحالي: {fmt(s.current_balance)} ج.م)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Amount with quick pills */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">مبلغ التغذية (ج.م) *</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={subReplenishForm.amount}
                    onChange={e => setSubReplenishForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="أدخل المبلغ بالجنيه..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-base font-black font-mono text-emerald-700 focus:outline-amber-500"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">ج.م</span>
                </div>
                {/* Quick amount buttons */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-400 font-bold">مبالغ سريعة:</span>
                  {[1000, 2000, 5000, 10000, 20000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setSubReplenishForm(f => ({ ...f, amount: String(val) }))}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      +{val.toLocaleString()} ج
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">تاريخ التغذية *</label>
                  <input
                    type="date"
                    required
                    value={subReplenishForm.date}
                    onChange={e => setSubReplenishForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">اسم المستلم للعهدة (المسؤول)</label>
                  <input
                    type="text"
                    value={subReplenishForm.custodian_name}
                    onChange={e => setSubReplenishForm(f => ({ ...f, custodian_name: e.target.value }))}
                    placeholder="مثال: أمين عهدة المخزن..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">بيان أو ملاحظات</label>
                <input
                  type="text"
                  value={subReplenishForm.notes}
                  onChange={e => setSubReplenishForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="ملاحظات..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSubReplenishModal(false)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold rounded-xl cursor-pointer shadow-xs flex items-center gap-2"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  {saving ? 'جاري التحويل...' : 'تأكيد تغذية الخزينة وتحويل العهدة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL: DISBURSE TRUST / CUSTODY (صرف أمانة / عهدة مؤقتة وموعد الرد) ══════════════════ */}
      {showNewTrustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-100 p-6 space-y-5 my-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-teal-100 text-teal-800 rounded-2xl">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">
                    صرف أمانة / عهدة مؤقتة (مع تحديد موعد الرد)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    أخذ مبلغ على سبيل العهدة أو الأمانة وتحديد موعد الرد، وتصفيتها وحذفها عند الرد
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNewTrustModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTrustSubmit} className="space-y-4 text-xs">
              {/* Safe Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">الخزينة المنصرف منها *</label>
                <select
                  required
                  value={newTrustForm.safe_id}
                  onChange={e => setNewTrustForm(f => ({ ...f, safe_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-bold bg-slate-50 focus:outline-teal-500"
                >
                  <option value="">-- اختر الخزينة --</option>
                  {safes.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.type === 'main' ? 'رئيسية' : 'فرعية'}) — الرصيد: {fmt(s.current_balance)} ج.م
                    </option>
                  ))}
                </select>
              </div>

              {/* Recipient Type Tabs */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">نوع المستلم للأمانة *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewTrustForm(f => ({ ...f, person_type: 'employee' }))}
                    className={`py-2 px-3 rounded-xl font-bold transition-all border ${
                      newTrustForm.person_type === 'employee'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    👤 موظف مسجل بالشركة
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTrustForm(f => ({ ...f, person_type: 'external', employee_id: '' }))}
                    className={`py-2 px-3 rounded-xl font-bold transition-all border ${
                      newTrustForm.person_type === 'external'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    🏢 شخص خارجي / مندوب / فني
                  </button>
                </div>
              </div>

              {newTrustForm.person_type === 'employee' ? (
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">اختر الموظف *</label>
                  <select
                    required
                    value={newTrustForm.employee_id}
                    onChange={e => {
                      const emp = employees.find(em => String(em.id) === e.target.value);
                      setNewTrustForm(f => ({
                        ...f,
                        employee_id: e.target.value,
                        person_name: emp ? emp.name : '',
                        person_phone: emp?.phone || ''
                      }));
                    }}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white font-bold"
                  >
                    <option value="">-- اختر الموظف من القائمة --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.code}) — {emp.job_title}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">اسم الشخص المستلم *</label>
                    <input
                      required
                      type="text"
                      value={newTrustForm.person_name}
                      onChange={e => setNewTrustForm(f => ({ ...f, person_name: e.target.value }))}
                      placeholder="الاسم ثلاثي..."
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">رقم الهاتف (للتواصل والواتساب)</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={newTrustForm.person_phone}
                      onChange={e => setNewTrustForm(f => ({ ...f, person_phone: e.target.value }))}
                      placeholder="01012345678"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">مبلغ الأمانة / العهدة (ج.م) *</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={newTrustForm.amount}
                    onChange={e => setNewTrustForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="أدخل المبلغ..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-base font-black font-mono text-teal-800"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">ج.م</span>
                </div>
              </div>

              {/* Dates: Given Date and DUE DATE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">تاريخ أخذ المبلغ *</label>
                  <input
                    type="date"
                    required
                    value={newTrustForm.given_date}
                    onChange={e => setNewTrustForm(f => ({ ...f, given_date: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-rose-700 mb-1.5 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    موعد الرد المحدد (تاريخ الاستحقاق) *
                  </label>
                  <input
                    type="date"
                    required
                    value={newTrustForm.due_date}
                    onChange={e => setNewTrustForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full border-2 border-rose-300 rounded-xl px-3 py-2 bg-rose-50/50 font-bold text-rose-900 focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Quick presets for due date */}
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-500 font-bold">تحديد سريع لموعد الرد:</span>
                {[
                  { label: 'بعد 3 أيام', days: 3 },
                  { label: 'بعد أسبوع', days: 7 },
                  { label: 'بعد 15 يوم', days: 15 },
                  { label: 'بعد شهر', days: 30 }
                ].map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + p.days);
                      setNewTrustForm(f => ({ ...f, due_date: d.toISOString().split('T')[0] }));
                    }}
                    className="px-2 py-0.5 bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-800 border border-slate-200 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Purpose & Notes */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">الغرض من الأمانة / سبب الصرف</label>
                <input
                  type="text"
                  value={newTrustForm.purpose}
                  onChange={e => setNewTrustForm(f => ({ ...f, purpose: e.target.value }))}
                  placeholder="مثال: شراء قطع غيار، أمانة نقدية تحت الحساب، مهمة عمل..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">ملاحظات إضافية</label>
                <input
                  type="text"
                  value={newTrustForm.notes}
                  onChange={e => setNewTrustForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="ملاحظات..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewTrustModal(false)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-700 hover:from-teal-700 hover:to-cyan-800 text-white font-bold rounded-xl cursor-pointer shadow-xs flex items-center gap-2"
                >
                  <Coins className="w-4 h-4" />
                  {saving ? 'جاري الصرف...' : 'تأكيد صرف الأمانة وحفظ موعد الرد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL: RETURN TRUST (رد واسترداد الأمانة وتصفيتها) ══════════════════ */}
      {showReturnTrustModal && selectedTrustForReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 p-6 space-y-5 my-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-2xl">
                  <ArrowDownCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">
                    إثبات رد واسترداد الأمانة (إخلاء طرف)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    عند رد المبلغ يتم إيداعه بالخزينة وحذف وتصفية المبلغ من على المستلم
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowReturnTrustModal(false); setSelectedTrustForReturn(null); }}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Trust Info Summary Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-500">اسم المستلم:</span>
                  <p className="text-sm font-black text-slate-800">{selectedTrustForReturn.person_name}</p>
                </div>
                {selectedTrustForReturn.person_phone && (
                  <span className="text-xs font-mono text-emerald-700 font-bold" dir="ltr">
                    {selectedTrustForReturn.person_phone}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-center">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">مبلغ الأمانة الأصلي</span>
                  <p className="font-mono font-bold text-slate-700 text-xs">{fmt(selectedTrustForReturn.amount)} ج.م</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">ما تم رده سابقاً</span>
                  <p className="font-mono font-bold text-emerald-600 text-xs">{fmt(selectedTrustForReturn.returned_amount)} ج.م</p>
                </div>
                <div>
                  <span className="text-[10px] text-rose-500 font-bold block">المتبقي المطلوب رده</span>
                  <p className="font-mono font-black text-rose-700 text-xs">{fmt(selectedTrustForReturn.remaining_amount)} ج.م</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleReturnTrustSubmit} className="space-y-4 text-xs">
              {/* Target Safe to receive the refund */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">الخزينة المودع بها المبلغ المردود *</label>
                <select
                  required
                  value={returnTrustForm.return_safe_id}
                  onChange={e => setReturnTrustForm(f => ({ ...f, return_safe_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-bold bg-white focus:outline-emerald-500"
                >
                  {safes.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.type === 'main' ? 'رئيسية' : 'فرعية'}) — الرصيد الحالي: {fmt(s.current_balance)} ج.م
                    </option>
                  ))}
                </select>
              </div>

              {/* Return Amount */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">المبلغ المردود (ج.م) *</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={selectedTrustForReturn.remaining_amount}
                    required
                    value={returnTrustForm.amount}
                    onChange={e => setReturnTrustForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-base font-black font-mono text-emerald-700"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">ج.م</span>
                </div>
                <div className="flex items-center justify-between mt-1 text-[11px]">
                  <span className="text-slate-400">يمكن رد المبلغ كاملاً أو جزء منه</span>
                  <button
                    type="button"
                    onClick={() => setReturnTrustForm(f => ({ ...f, amount: String(selectedTrustForReturn.remaining_amount) }))}
                    className="text-emerald-700 font-bold hover:underline"
                  >
                    رد المبلغ كاملاً ({fmt(selectedTrustForReturn.remaining_amount)} ج.م)
                  </button>
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">تاريخ رد الأمانة *</label>
                <input
                  type="date"
                  required
                  value={returnTrustForm.return_date}
                  onChange={e => setReturnTrustForm(f => ({ ...f, return_date: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">ملاحظات الرد والتسوية</label>
                <input
                  type="text"
                  value={returnTrustForm.notes}
                  onChange={e => setReturnTrustForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="ملاحظات..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setShowReturnTrustModal(false); setSelectedTrustForReturn(null); }}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer shadow-xs flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {saving ? 'جاري التسوية...' : 'تأكيد رد الأمانة وتصفيتها من على المستلم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL: DISBURSE MID-MONTH EXPENSES (يوم 10 أو 20) ══════════════════ */}
      {showMidMonthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-100 p-6 space-y-5 my-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">
                    صرف مصروفات منتصف الشهر (يوم {midMonthForm.day}) من الخزينة وربطها بالراتب
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    يتم خصم الإجمالي من الخزينة المحددة وتسجيلها في كشف مصروفات الشهر لتخصم من الرواتب تلقائياً
                  </p>
                </div>
              </div>
              <button onClick={() => setShowMidMonthModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDisburseMidMonth} className="space-y-4 text-xs">
              {/* Basic Selection Strip */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الخزينة المراد الصرف منها *</label>
                  <select
                    required
                    value={midMonthForm.safe_id}
                    onChange={e => setMidMonthForm(f => ({ ...f, safe_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold bg-white"
                  >
                    <option value="">-- اختر الخزينة --</option>
                    {safes.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} — رصيد متاح: {fmt(s.current_balance)} ج.م
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">دفعة اليوم *</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMidMonthForm(f => ({ ...f, day: 10 }));
                        loadMidMonthData(midMonthForm.year, midMonthForm.month, 10, midMonthForm.safe_id);
                      }}
                      className={`flex-1 py-2 rounded-xl font-bold cursor-pointer transition-colors ${
                        midMonthForm.day === 10 ? 'bg-amber-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700'
                      }`}
                    >
                      يوم 10
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMidMonthForm(f => ({ ...f, day: 20 }));
                        loadMidMonthData(midMonthForm.year, midMonthForm.month, 20, midMonthForm.safe_id);
                      }}
                      className={`flex-1 py-2 rounded-xl font-bold cursor-pointer transition-colors ${
                        midMonthForm.day === 20 ? 'bg-amber-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700'
                      }`}
                    >
                      يوم 20
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">الشهر والسنة *</label>
                  <div className="flex gap-1.5">
                    <select
                      value={midMonthForm.month}
                      onChange={e => {
                        const m = Number(e.target.value);
                        setMidMonthForm(f => ({ ...f, month: m }));
                        loadMidMonthData(midMonthForm.year, m, midMonthForm.day, midMonthForm.safe_id);
                      }}
                      className="w-2/3 border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold bg-white"
                    >
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>شهر {m}</option>)}
                    </select>
                    <select
                      value={midMonthForm.year}
                      onChange={e => {
                        const y = Number(e.target.value);
                        setMidMonthForm(f => ({ ...f, year: y }));
                        loadMidMonthData(y, midMonthForm.month, midMonthForm.day, midMonthForm.safe_id);
                      }}
                      className="w-1/3 border border-slate-200 rounded-xl px-2 py-2 text-xs font-mono font-bold bg-white"
                    >
                      {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">تاريخ صرف الخزينة *</label>
                  <input
                    type="date"
                    required
                    value={midMonthForm.transaction_date}
                    onChange={e => setMidMonthForm(f => ({ ...f, transaction_date: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold bg-white"
                  />
                </div>
              </div>

              {/* Responsible Courier and Phone for WhatsApp */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-3 rounded-2xl border border-slate-200">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    اسم الموظف / السائق / المشرف المستلم للدفعة لتوزيعها
                  </label>
                  <input
                    type="text"
                    value={midMonthForm.courier_name}
                    onChange={e => setMidMonthForm(f => ({ ...f, courier_name: e.target.value }))}
                    placeholder="مثال: عاصم عبد الرؤوف (سائق) أو مشرف المخزن..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    رقم موبايل المستلم (لإرسال إشعار واتساب بالمبلغ الإجمالي)
                  </label>
                  <input
                    type="text"
                    value={midMonthForm.sender_phone}
                    onChange={e => setMidMonthForm(f => ({ ...f, sender_phone: e.target.value }))}
                    placeholder="010xxxxxxxx"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Search & Bulk Select Strip */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700">قائمة المستحقين للمصروف:</span>
                  <button
                    type="button"
                    onClick={() => setMidMonthItems(items => items.map(it => ({ ...it, selected: true })))}
                    className="text-blue-600 font-bold hover:underline text-[11px] cursor-pointer"
                  >
                    تحديد الكل
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setMidMonthItems(items => items.map(it => ({ ...it, selected: false })))}
                    className="text-slate-500 hover:underline text-[11px] cursor-pointer"
                  >
                    إلغاء التحديد
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={midMonthSearch}
                    onChange={e => setMidMonthSearch(e.target.value)}
                    placeholder="بحث باسم أو كود الموظف..."
                    className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs w-56"
                  />
                  <div className="bg-amber-100 text-amber-900 px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5">
                    <span>إجمالي المصروف المحدد:</span>
                    <strong className="font-mono text-sm">{fmt(midMonthTotalSelected)}</strong>
                    <span>ج.م</span>
                  </div>
                </div>
              </div>

              {/* Employees List Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-5 font-bold text-slate-700">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-12">صرف</th>
                      <th className="py-2.5 px-3 text-right">كود</th>
                      <th className="py-2.5 px-3 text-right">اسم الموظف</th>
                      <th className="py-2.5 px-3 text-right">القسم</th>
                      <th className="py-2.5 px-3 text-center w-36">المبلغ المنصرف (ج.م)</th>
                      <th className="py-2.5 px-3 text-right">ملاحظات وبيان</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {midMonthLoading ? (
                      <tr><td colSpan={6} className="py-8 text-center text-slate-400">جاري تحميل بيانات المصروفات...</td></tr>
                    ) : filteredMidMonthItems.length === 0 ? (
                      <tr><td colSpan={6} className="py-8 text-center text-slate-400">لا يوجد موظفون يطابقون البحث</td></tr>
                    ) : filteredMidMonthItems.map(item => (
                      <tr key={item.employee_id} className={`hover:bg-slate-50 ${item.selected ? 'bg-amber-50/40 font-semibold' : ''}`}>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={e => {
                              const checked = e.target.checked;
                              setMidMonthItems(list => list.map(it => it.employee_id === item.employee_id ? { ...it, selected: checked } : it));
                            }}
                            className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-500">{item.employee_code}</td>
                        <td className="py-2 px-3 font-bold text-slate-800">{item.employee_name}</td>
                        <td className="py-2 px-3 text-slate-500">{item.department}</td>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            step="50"
                            value={item.amount}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              setMidMonthItems(list => list.map(it => it.employee_id === item.employee_id ? { ...it, amount: val, selected: val > 0 } : it));
                            }}
                            className="w-28 border border-slate-200 rounded-lg px-2 py-1 text-center font-mono font-bold text-amber-800 bg-white"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={item.notes}
                            onChange={e => {
                              const n = e.target.value;
                              setMidMonthItems(list => list.map(it => it.employee_id === item.employee_id ? { ...it, notes: n } : it));
                            }}
                            placeholder="ملاحظات..."
                            className="w-full border-0 bg-transparent text-xs text-slate-600 focus:bg-white focus:border focus:border-slate-200 rounded px-1.5 py-0.5"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Denomination toggle */}
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="midMonthDenomToggle"
                  checked={midMonthForm.withDenom}
                  onChange={e => setMidMonthForm(f => ({ ...f, withDenom: e.target.checked }))}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
                <label htmlFor="midMonthDenomToggle" className="text-xs font-bold text-slate-700 cursor-pointer flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-amber-600" />
                  تسجيل فئات الدرج الفعلي (الجرد) بعد صرف المصروفات
                </label>
              </div>

              {midMonthForm.withDenom && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>إدخال فئات النقدية المتبقية بالدرج:</span>
                    <span className="font-mono text-emerald-800">إجمالي الدرج: {fmt(txDenomTotal)} ج.م</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {DENOM_FIELDS.map(f => (
                      <div key={f.key} className="bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-600 truncate">{f.label}</label>
                        <input
                          type="number"
                          min="0"
                          value={denomData[f.key]}
                          onChange={e => setDenomData(d => ({ ...d, [f.key]: e.target.value }))}
                          placeholder="0"
                          className="w-14 text-center font-mono font-bold text-xs border border-slate-200 rounded py-1"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="text-xs">
                  <span className="text-slate-500">سيتم صرف: </span>
                  <strong className="text-base text-amber-900 font-mono font-black">{fmt(midMonthTotalSelected)} ج.م</strong>
                  <span className="text-slate-500"> لعدد ({midMonthItems.filter(i => i.selected && i.amount > 0).length}) موظف</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowMidMonthModal(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={saving || midMonthTotalSelected <= 0}
                    className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    {saving ? 'جاري الصرف والخصم...' : 'تأكيد صرف المصروف من الخزينة وربطه بالراتب'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL: DISBURSE LOAN (صرف سلفة وتقسيط على الشهور) ══════════════════ */}
      {showLoanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-100 p-6 space-y-5 my-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-100 text-purple-800 rounded-xl">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">صرف سلفة نقدية وتقسيطها على الشهور</h3>
                  <p className="text-[11px] text-slate-400">تخصم من الخزينة وتدرج تلقائياً في جدول السلف وأقساط الرواتب</p>
                </div>
              </div>
              <button onClick={() => setShowLoanModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDisburseLoan} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">الخزينة المراد الصرف منها *</label>
                  <select
                    required
                    value={loanForm.safe_id}
                    onChange={e => setLoanForm(f => ({ ...f, safe_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold bg-white"
                  >
                    <option value="">-- اختر الخزينة --</option>
                    {safes.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} — رصيد: {fmt(s.current_balance)} ج.م
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">تاريخ صرف السلفة *</label>
                  <input
                    type="date"
                    required
                    value={loanForm.transaction_date}
                    onChange={e => setLoanForm(f => ({ ...f, transaction_date: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
              </div>

              {/* Employee Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">الموظف المستلم للسلفة *</label>
                <select
                  required
                  value={loanForm.employee_id}
                  onChange={e => {
                    const emp = employees.find(em => String(em.id) === e.target.value);
                    setLoanForm(f => ({
                      ...f,
                      employee_id: e.target.value,
                      courier_name: emp ? emp.name : f.courier_name
                    }));
                  }}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold bg-white"
                >
                  <option value="">-- اختر الموظف المستحق للسلفة --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.code}) — {emp.job_title} • راتب: {fmt(emp.actual_salary)} ج.م
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount and Months (كام شهر) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">مبلغ السلفة الإجمالي (ج.م) *</label>
                  <input
                    type="number"
                    step="100"
                    min="100"
                    required
                    value={loanForm.total_amount}
                    onChange={e => setLoanForm(f => ({ ...f, total_amount: e.target.value }))}
                    placeholder="مثال: 12000"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-base font-black font-mono text-purple-900"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    التقسيط على كام شهر؟ *
                  </label>
                  <select
                    required
                    value={loanForm.months_count}
                    onChange={e => setLoanForm(f => ({ ...f, months_count: parseInt(e.target.value, 10) }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold bg-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 8, 10, 12, 18, 24, 36].map(m => (
                      <option key={m} value={m}>
                        {m} {m === 1 ? 'شهر (دفعة واحدة)' : m === 2 ? 'شهران' : m <= 10 ? 'شهور' : 'شهراً'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Installment Live Preview Box */}
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-950">قيمة القسط الشهري المحتسب:</span>
                  <span className="font-black text-xl text-purple-900 font-mono">
                    {fmt(calculatedLoanInstallment)} <span className="text-xs font-normal">ج.م / شهر</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-purple-800 pt-1 border-t border-purple-200/60">
                  <span>شهر بداية الخصم من الراتب:</span>
                  <input
                    type="month"
                    value={loanForm.start_date}
                    onChange={e => setLoanForm(f => ({ ...f, start_date: e.target.value }))}
                    className="bg-white border border-purple-200 rounded-lg px-2 py-0.5 font-mono font-bold text-purple-900"
                  />
                  <span>شهر النهاية: <strong className="font-mono">{calculatedLoanEndDate}</strong></span>
                </div>
              </div>

              {/* Courier and WhatsApp */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">اسم من وصل أو استلم السلفة</label>
                  <input
                    type="text"
                    value={loanForm.courier_name}
                    onChange={e => setLoanForm(f => ({ ...f, courier_name: e.target.value }))}
                    placeholder="اسم الموظف أو مندوب التسليم..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">موبايل المستلم (لإرسال إشعار واتساب)</label>
                  <input
                    type="text"
                    value={loanForm.sender_phone}
                    onChange={e => setLoanForm(f => ({ ...f, sender_phone: e.target.value }))}
                    placeholder="010xxxxxxxx"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">ملاحظات وسبب السلفة</label>
                <input
                  type="text"
                  value={loanForm.notes}
                  onChange={e => setLoanForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="مثال: سلفة شخصية معتمدة تخصم شهرياً من الراتب..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              {/* Denomination toggle */}
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="loanDenomToggle"
                  checked={loanForm.withDenom}
                  onChange={e => setLoanForm(f => ({ ...f, withDenom: e.target.checked }))}
                  className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                />
                <label htmlFor="loanDenomToggle" className="text-xs font-bold text-slate-700 cursor-pointer flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-amber-600" />
                  تسجيل فئات الدرج الفعلي (الجرد) بعد صرف السلفة
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowLoanModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving || !loanForm.employee_id || !loanForm.total_amount}
                  className="px-6 py-2.5 bg-purple-700 hover:bg-purple-800 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {saving ? 'جاري التسجيل والصرف...' : 'اعتماد وصرف السلفة من الخزينة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL: NEW / EDIT SAFE ══════════════════ */}
      {showNewSafeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 p-6 space-y-5">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-600" />
                {editSafe ? 'تعديل بيانات الخزينة' : 'إضافة خزينة جديدة'}
              </h3>
              <button
                onClick={() => { setShowNewSafeModal(false); setEditSafe(null); }}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSafe} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">اسم الخزينة *</label>
                  <input
                    required
                    value={safeForm.name}
                    onChange={e => setSafeForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="مثال: خزينة مخزن عرابي"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">نوع الخزينة *</label>
                  <select
                    value={safeForm.type}
                    onChange={e => setSafeForm(f => ({ ...f, type: e.target.value }))}
                    disabled={!!editSafe}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white"
                  >
                    <option value="main">خزينة رئيسية</option>
                    <option value="sub">خزينة فرعية مستقلة</option>
                  </select>
                </div>
              </div>

              {safeForm.type === 'sub' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">الخزينة الرئيسية التابعة لها *</label>
                  <select
                    required
                    value={safeForm.parent_safe_id}
                    onChange={e => setSafeForm(f => ({ ...f, parent_safe_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white"
                  >
                    <option value="">-- اختر الخزينة الرئيسية --</option>
                    {mainSafes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-purple-900">
                  <input
                    type="checkbox"
                    checked={!!safeForm.is_trust}
                    onChange={e => setSafeForm(f => ({ ...f, is_trust: e.target.checked ? 1 : 0 }))}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <span>🏷️ تخصيص كـ "خزينة أمانات وعهد مؤقتة" (للصرف والاسترداد مع تحديد موعد الرد)</span>
                </label>
                <p className="text-[11px] text-purple-700 mt-1 mr-6">
                  تظهر بتمييز خاص وتُستخدم لصرف العهد والأمانات المؤقتة ومتابعة مواعيد ردها وتصفيتها.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">اسم أمين الخزينة / المسؤول</label>
                  <input
                    value={safeForm.custodian_name}
                    onChange={e => setSafeForm(f => ({ ...f, custodian_name: e.target.value }))}
                    placeholder="محمد عادل..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">رقم موبايل أمين الخزينة (للواتساب)</label>
                  <input
                    value={safeForm.custodian_phone}
                    onChange={e => setSafeForm(f => ({ ...f, custodian_phone: e.target.value }))}
                    placeholder="01012345678"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">ربط بالموظف من السيستم (اختياري)</label>
                <select
                  value={safeForm.custodian_employee_id}
                  onChange={e => {
                    const emp = employees.find(em => String(em.id) === e.target.value);
                    setSafeForm(f => ({
                      ...f,
                      custodian_employee_id: e.target.value,
                      custodian_name: emp ? emp.name : f.custodian_name
                    }));
                  }}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white"
                >
                  <option value="">-- اختر موظف من قائمة العاملين --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.code}) — {emp.job_title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">ملاحظات</label>
                <input
                  value={safeForm.notes}
                  onChange={e => setSafeForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="ملاحظات أو موقع الخزينة..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setShowNewSafeModal(false); setEditSafe(null); }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl cursor-pointer shadow-xs"
                >
                  {saving ? 'جاري الحفظ...' : editSafe ? 'حفظ التعديلات' : 'إضافة الخزينة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL: RECORD GENERAL TRANSACTION ══════════════════ */}
      {showTxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 p-6 space-y-5 my-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 sticky top-0 bg-white z-10">
              <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-emerald-600" />
                {txForm.type === 'custody_receive' ? 'استلام عهدة نقدية من أمين خزينة الشركة' : 'تسجيل حركة في الخزينة'}
              </h3>
              <button onClick={() => setShowTxModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTx} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">الخزينة المراد القيد عليها *</label>
                  <select
                    required
                    value={txForm.safe_id}
                    onChange={e => {
                      const sId = e.target.value;
                      const sObj = safes.find(s => String(s.id) === sId);
                      setTxForm(f => ({
                        ...f,
                        safe_id: sId,
                        sender_phone: f.sender_phone || sObj?.custodian_phone || ''
                      }));
                    }}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold bg-white"
                  >
                    <option value="">-- اختر الخزينة --</option>
                    {safes.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.type === 'main' ? 'رئيسية' : 'فرعية'}) — رصيد: {fmt(s.current_balance)} ج.م
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">نوع الحركة المالية *</label>
                  <select
                    required
                    value={txForm.type}
                    onChange={e => setTxForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold bg-white"
                  >
                    {Object.entries(TX_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">المبلغ (جنيه مصري) *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={txForm.amount}
                    onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-base font-black font-mono text-emerald-800"
                    dir="ltr"
                  />
                  {selectedSafeObj && (
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      الرصيد الدفتري الحالي: <strong>{fmt(selectedSafeObj.current_balance)}</strong> ج.م
                    </span>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">تاريخ الحركة *</label>
                  <input
                    required
                    type="date"
                    value={txForm.transaction_date}
                    onChange={e => setTxForm(f => ({ ...f, transaction_date: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold"
                  />
                </div>
              </div>

              {/* Special Fields for EXPENSE (صرف مصروفات / مشتريات لغير الموظفين أو الموظفين) */}
              {txForm.type === 'expense' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Building className="w-4 h-4 text-purple-600" />
                      تحديد المستفيد / جهة الصرف:
                    </label>
                    <div className="flex gap-1.5 p-1 bg-white border border-slate-200 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setTxForm(f => ({ ...f, recipient_type: 'employee' }))}
                        className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                          txForm.recipient_type !== 'party' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        موظف / سائق داخلي
                      </button>
                      <button
                        type="button"
                        onClick={() => setTxForm(f => ({ ...f, recipient_type: 'party' }))}
                        className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                          txForm.recipient_type === 'party' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        جهة / شركة / مورد خارجي
                      </button>
                    </div>
                  </div>

                  {txForm.recipient_type === 'party' ? (
                    <div className="space-y-3 pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="font-bold text-slate-700 text-xs">اسم الشركة أو التوكيل أو الفني *</label>
                            <button
                              type="button"
                              onClick={() => {
                                setPartyForm({ name: '', party_type: 'company', category: 'أحبار وطابعات', contact_person: '', phone: '', tax_no: '', address: '', notes: '' });
                                setShowNewPartyModal(true);
                              }}
                              className="text-[10px] text-purple-700 hover:underline font-bold cursor-pointer"
                            >
                              + تكويد جهة جديدة
                            </button>
                          </div>
                          <select
                            value={txForm.party_id}
                            onChange={e => {
                              const pId = e.target.value;
                              const pObj = parties.find(p => String(p.id) === pId);
                              setTxForm(f => ({
                                ...f,
                                party_id: pId,
                                party_name: pObj?.name || '',
                                category: pObj?.category || f.category,
                                description: f.description || (pObj ? `صرف مصروف لـ ${pObj.name} (${pObj.category || ''})` : f.description)
                              }));
                            }}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white font-bold"
                          >
                            <option value="">-- اختر الشركة أو الجهة الخارجية --</option>
                            {parties.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.category || 'عام'})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-1 text-xs">تصنيف المصروف / الخدمة *</label>
                          <select
                            value={txForm.category}
                            onChange={e => setTxForm(f => ({ ...f, category: e.target.value }))}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white font-semibold"
                          >
                            <option value="أحبار وطابعات">أحبار وطابعات ومستلزمات كمبيوتر</option>
                            <option value="كاميرات ومراقبة">كاميرات مراقبة وأجهزة إنذار وشبكات</option>
                            <option value="صيانة سيارات وكاوتش">صيانة سيارات وإطارات وكاوتش وبنشر</option>
                            <option value="مهمات تشغيل ونظافة">مهمات تشغيل ونظافة ومشتريات بوفيه</option>
                            <option value="صيانة عامة وكهرباء">صيانة عامة وكهرباء ومقاولات سريعة</option>
                            <option value="إكراميات ونثريات">إكراميات ونثريات وبوابات</option>
                            <option value="أخرى">مصروفات ومشتريات أخرى</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1 text-xs">رقم الفاتورة أو إيصال التوريد</label>
                          <input
                            type="text"
                            value={txForm.invoice_no}
                            onChange={e => setTxForm(f => ({ ...f, invoice_no: e.target.value }))}
                            placeholder="مثال: فاتورة رقم 1042 أو إيصال قبض"
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white font-mono"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1 text-xs">الشخص المستلم أو المندوب</label>
                          <input
                            type="text"
                            value={txForm.related_employee_name}
                            onChange={e => setTxForm(f => ({ ...f, related_employee_name: e.target.value }))}
                            placeholder="اسم مندوب الشركة أو الفني..."
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white"
                          />
                        </div>
                      </div>

                      {/* Quick Suggestion Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] text-slate-400 font-bold">نماذج سريعة للبيان:</span>
                        {[
                          'شراء أحبار طابعات وصيانة دورية',
                          'تركيب وصيانة كاميرات المراقبة بالشركة',
                          'صيانة كاوتش وبنشر وترصيص سيارات',
                          'مستلزمات نظافة وتطهير وبوفيه',
                          'صيانة كهرباء ومعدات تشغيل'
                        ].map(sug => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => setTxForm(f => ({ ...f, description: sug }))}
                            className="px-2 py-0.5 bg-slate-200/70 hover:bg-slate-300 text-slate-700 rounded-md text-[10px] cursor-pointer"
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-xs">الموظف أو السائق المستلم</label>
                        <select
                          value={txForm.related_employee_id}
                          onChange={e => {
                            const emp = employees.find(em => String(em.id) === e.target.value);
                            setTxForm(f => ({
                              ...f,
                              related_employee_id: e.target.value,
                              related_employee_name: emp ? emp.name : f.related_employee_name
                            }));
                          }}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white"
                        >
                          <option value="">-- اختر الموظف / السائق --</option>
                          {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name} ({emp.code}) — {emp.job_title}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1 text-xs">اسم المستلم يدوياً</label>
                        <input
                          type="text"
                          value={txForm.related_employee_name}
                          onChange={e => setTxForm(f => ({ ...f, related_employee_name: e.target.value }))}
                          placeholder="اسم المستلم..."
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Special Fields for Custody Receive */}
              {txForm.type === 'custody_receive' && (
                <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl space-y-3">
                  <p className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-emerald-700" />
                    بيانات أمين الخزينة بالشركة والموظف / السائق المسلم للعهدة:
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        رقم موبايل أمين خزينة الشركة (لإرسال رسالة الواتساب)
                      </label>
                      <input
                        type="text"
                        value={txForm.sender_phone}
                        onChange={e => setTxForm(f => ({ ...f, sender_phone: e.target.value }))}
                        placeholder="010xxxxxxxx"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono bg-white"
                        dir="ltr"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">رقم الإيصال / سند الصرف</label>
                      <input
                        type="text"
                        value={txForm.reference_no}
                        onChange={e => setTxForm(f => ({ ...f, reference_no: e.target.value }))}
                        placeholder="رقم السند الدفتري"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      اسم الموظف أو السائق الذي وصل العهدة إليّ
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <select
                        value={txForm.related_employee_id}
                        onChange={e => {
                          const emp = employees.find(em => String(em.id) === e.target.value);
                          setTxForm(f => ({
                            ...f,
                            related_employee_id: e.target.value,
                            related_employee_name: emp ? emp.name : f.related_employee_name
                          }));
                        }}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white font-medium"
                      >
                        <option value="">-- اختيار من موظفي / سائقي الشركة --</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name} ({emp.code}) — {emp.job_title}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        value={txForm.related_employee_name}
                        onChange={e => setTxForm(f => ({ ...f, related_employee_name: e.target.value }))}
                        placeholder="أو اكتب الاسم يدوياً إن لم يكن مسجلاً..."
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Sub Replenish Target Safe */}
              {(txForm.type === 'sub_replenish' || txForm.type === 'transfer_out') && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">الخزينة المستلمة للتحويل *</label>
                  <select
                    required
                    value={txForm.related_safe_id}
                    onChange={e => setTxForm(f => ({ ...f, related_safe_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold bg-white"
                  >
                    <option value="">-- اختر الخزينة المستلمة --</option>
                    {safes.filter(s => String(s.id) !== txForm.safe_id).map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.type === 'main' ? 'رئيسية' : 'فرعية'}) — رصيدها: {fmt(s.current_balance)} ج.م
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">البيان والوصف *</label>
                <input
                  required
                  value={txForm.description}
                  onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="اكتب بيان الحركة بالتفصيل..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">ملاحظات إضافية</label>
                <input
                  value={txForm.notes}
                  onChange={e => setTxForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="ملاحظات..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              {/* DRAWER DENOMINATION CHECKBOX & INPUTS (بالباكو والفكة والتفقيط) */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2.5 p-3 bg-amber-50/70 border border-amber-200 rounded-2xl cursor-pointer">
                  <input
                    type="checkbox"
                    id="withDenomToggle"
                    checked={txForm.withDenom}
                    onChange={e => setTxForm(f => ({ ...f, withDenom: e.target.checked }))}
                    className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                  />
                  <label htmlFor="withDenomToggle" className="font-bold text-slate-800 text-xs cursor-pointer flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-amber-600" />
                    كتابة الفئات بالباكو والفكة لجرد الدرج الفعلي للخزينة مباشرة بعد هذه العملية
                  </label>
                </div>

                {txForm.withDenom && (
                  <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <DenominationInputs
                      data={denomData}
                      onChange={setDenomData}
                      currentBookBalance={
                        selectedSafeObj ? (
                          ['expense', 'transfer_out', 'salary_payment', 'custody_return', 'sub_replenish'].includes(txForm.type)
                            ? (selectedSafeObj.current_balance - (parseFloat(txForm.amount) || 0))
                            : (selectedSafeObj.current_balance + (parseFloat(txForm.amount) || 0))
                        ) : undefined
                      }
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTxModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  {saving ? 'جاري التسجيل...' : 'حفظ وتسجيل الحركة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL: MANUAL DENOMINATION SNAPSHOT (جرد درج الخزينة الرئيسية) ══════════════════ */}
      {showDenomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 p-6 space-y-5 my-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 sticky top-0 bg-white z-10">
              <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-500" />
                جرد درج الخزينة الرئيسية الفعلي (فئات وبواكي) ومطابقة العجز والزيادة
              </h3>
              <button onClick={() => setShowDenomModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDenom} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">الخزينة الرئيسية المراد جرد درجها *</label>
                  <select
                    required
                    value={denomForm.safe_id}
                    onChange={e => setDenomForm(f => ({ ...f, safe_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold bg-white"
                  >
                    <option value="">-- اختر الخزينة الرئيسية --</option>
                    {mainSafes.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} (رئيسية) — الرصيد الدفتري: {fmt(s.current_balance)} ج.م
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">تاريخ الجرد *</label>
                  <input
                    required
                    type="date"
                    value={denomForm.snapshot_date}
                    onChange={e => setDenomForm(f => ({ ...f, snapshot_date: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
              </div>

              {/* Denominations Component with Bundles & Loose Change */}
              <DenominationInputs
                data={denomForm}
                onChange={setDenomForm}
                currentBookBalance={denomModalSafeObj?.current_balance}
              />

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">ملاحظات الجرد</label>
                <input
                  value={denomForm.notes}
                  onChange={e => setDenomForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="ملاحظات حول الجرد أو أسباب الفروق إن وجدت..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDenomModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  {saving ? 'جاري الحفظ...' : 'حفظ واعتماد الجرد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL: DEDICATED SUB-SAFE WORKSPACE & LEDGER ══════════════════ */}
      {selectedSubSafe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl border border-slate-100 p-6 space-y-6 my-auto max-h-[95vh] overflow-y-auto">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4 border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-amber-200">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-black text-slate-800 text-lg md:text-xl">{selectedSubSafe.name}</h2>
                    <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 rounded-full text-[11px] font-bold border border-amber-200">
                      خزينة فرعية مستقلة
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                    <span>المسؤول: <strong>{selectedSubSafe.custodian_name || 'غير محدد'}</strong></span>
                    {selectedSubSafe.custodian_phone && (
                      <span className="text-emerald-600 font-mono font-bold" dir="ltr">({selectedSubSafe.custodian_phone})</span>
                    )}
                    {selectedSubSafe.notes && <span>• {selectedSubSafe.notes}</span>}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadSubSafeTransactions(selectedSubSafe.id)}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  title="تحديث"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedSubSafe(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Sub-Safe Hero KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-gradient-to-br from-amber-600 to-orange-700 text-white p-4 rounded-2xl shadow-sm">
                <span className="text-[11px] font-bold text-amber-100">رصيد العهدة الحالي المتاح</span>
                <p className="text-xl sm:text-2xl font-black font-mono mt-1 break-all">
                  {fmt(selectedSubSafe.current_balance)} <span className="text-xs font-normal">ج.م</span>
                </p>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-emerald-950">
                <span className="text-[11px] font-bold text-emerald-700">إجمالي العهدة الواردة (تغذية)</span>
                <p className="text-xl sm:text-2xl font-black font-mono mt-1 text-emerald-800 break-all">
                  {fmt(subSafeTransactions.filter(t => t.type === 'transfer_in' || t.type === 'custody_receive').reduce((s, t) => s + (t.amount || 0), 0))} <span className="text-xs font-normal">ج.م</span>
                </p>
              </div>

              <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl text-rose-950">
                <span className="text-[11px] font-bold text-rose-700">إجمالي المصروفات المنصرفة</span>
                <p className="text-xl sm:text-2xl font-black font-mono mt-1 text-rose-800 break-all">
                  {fmt(subSafeTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0))} <span className="text-xs font-normal">ج.م</span>
                </p>
              </div>
            </div>

            {/* Dedicated Action Bar: Disbursement Button & Quick Expense Category Pills */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-amber-600" />
                  أزرار الصرف السريع من الخزينة الفرعية:
                </h4>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSubSafeExpenseForm({
                        amount: '',
                        category: 'مصروفات تشغيل عامة',
                        courier_name: '',
                        description: '',
                        reference_no: '',
                        notes: '',
                        withDenom: false
                      });
                      setShowSubSafeExpenseModal(true);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    صرف مصروف جديد من الخزينة الفرعية
                  </button>

                  <button
                    onClick={() => {
                      setMonthEndForm({ sub_safe_id: String(selectedSubSafe.id), transaction_date: today(), notes: `إقفال عهدة خزينة ${selectedSubSafe.name}` });
                      setShowMonthEndModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                  >
                    <Archive className="w-3.5 h-3.5 text-amber-400" />
                    إقفال العهدة ورد المتبقي للرئيسية
                  </button>
                </div>
              </div>

              {/* Quick Category Action Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1">
                {[
                  { cat: 'كارتات طريق ورسوم بوابات وموازين', icon: '🛣️', label: 'كارتات طريق وبوابات', defaultDesc: 'كارتات طريق ورسوم موازين وبوابات' },
                  { cat: 'مصاريف كاوتش وبنشر وصيانة سيارات', icon: '🚗', label: 'كاوتش وبنشر سيارات', defaultDesc: 'إصلاح كاوتش وبنشر وترصيص سيارات' },
                  { cat: 'مصاريف نظافة ومهمات تشغيل وبوفيه', icon: '🧹', label: 'نظافة وبوفيه ومهمات', defaultDesc: 'مهمات نظافة وتطهير ومشتريات بوفيه' },
                  { cat: 'إكراميات ونثريات وسيارات إسعاف', icon: '🤝', label: 'إكراميات ونثريات', defaultDesc: 'إكراميات عمال تحميل ونثريات طريق' },
                  { cat: 'تصفية عهدة سائق أو موظف', icon: '🔄', label: 'تصفية عهدة سائق', defaultDesc: 'تصفية وحساب عهدة السائق عن رحلة تشغيل' },
                  { cat: 'مشتريات طارئة ومستلزمات', icon: '🛒', label: 'مشتريات طارئة', defaultDesc: 'شراء مستلزمات وقطع طارئة للمخزن' }
                ].map(item => (
                  <button
                    key={item.cat}
                    type="button"
                    onClick={() => {
                      setSubSafeExpenseForm({
                        amount: '',
                        category: item.cat,
                        courier_name: '',
                        description: item.defaultDesc,
                        reference_no: '',
                        notes: '',
                        withDenom: false
                      });
                      setShowSubSafeExpenseModal(true);
                    }}
                    className="p-2.5 bg-white hover:bg-amber-50 hover:border-amber-300 border border-slate-200 rounded-xl text-right transition-all group cursor-pointer shadow-2xs"
                  >
                    <span className="text-base block mb-1">{item.icon}</span>
                    <span className="font-bold text-slate-800 text-[11px] block group-hover:text-amber-800">{item.label}</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">+ صرف فوري</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-Safe Dedicated Ledger (دفتر حركات الخزينة الفرعية) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-600" />
                  دفتر حركات الخزينة الفرعية المستقل (سجل الوارد والمنصرف والرصيد المتراكم):
                </h4>
                <span className="text-[11px] text-slate-400 font-mono">
                  إجمالي الحركات: {subSafeTransactions.length}
                </span>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto max-h-[400px]">
                  <table className="w-full text-xs" dir="rtl">
                    <thead className="sticky top-0 bg-slate-100 z-5 shadow-2xs">
                      <tr>
                        <th className="py-2.5 px-3 text-right font-bold text-slate-600">التاريخ</th>
                        <th className="py-2.5 px-3 text-right font-bold text-slate-600">نوع الحركة</th>
                        <th className="py-2.5 px-3 text-right font-bold text-slate-600">البيان والتفاصيل</th>
                        <th className="py-2.5 px-3 text-right font-bold text-slate-600">المستلم / السائق</th>
                        <th className="py-2.5 px-3 text-center font-bold text-emerald-700 bg-emerald-50/60">وارد (+)</th>
                        <th className="py-2.5 px-3 text-center font-bold text-rose-700 bg-rose-50/60">منصرف (-)</th>
                        <th className="py-2.5 px-3 text-center font-bold text-slate-800">الرصيد بعد</th>
                        <th className="py-2.5 px-3 text-center font-bold text-slate-500">الإيصال</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {subSafeTxLoading ? (
                        <tr><td colSpan={8} className="py-8 text-center text-slate-400">جاري تحميل حركات الخزينة الفرعية...</td></tr>
                      ) : subSafeTransactions.length === 0 ? (
                        <tr><td colSpan={8} className="py-8 text-center text-slate-400 font-semibold">لا توجد حركات مسجلة لهذه الخزينة الفرعية حتى الآن</td></tr>
                      ) : (
                        subSafeTransactions.map(tx => {
                          const isIn = tx.type === 'transfer_in' || tx.type === 'custody_receive' || tx.type === 'income';
                          const isOut = tx.type === 'expense' || tx.type === 'custody_return' || tx.type === 'transfer_out';
                          const txInfo = TX_TYPES[tx.type] || { label: tx.type, color: 'text-slate-600 bg-slate-100', icon: '📄' };

                          return (
                            <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-700 whitespace-nowrap">{tx.transaction_date}</td>
                              <td className="py-2.5 px-3">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${txInfo.color}`}>
                                  <span>{txInfo.icon}</span>
                                  <span>{txInfo.label}</span>
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-800">
                                <p className="font-medium">{tx.description}</p>
                                {tx.category && <span className="text-[10px] text-amber-700 font-bold block">{tx.category}</span>}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700 font-semibold">
                                {tx.related_employee_name || '—'}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-black text-emerald-700 bg-emerald-50/30">
                                {isIn ? fmt(tx.amount) : '—'}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-black text-rose-700 bg-rose-50/30">
                                {isOut ? fmt(tx.amount) : '—'}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-black text-slate-800">
                                {fmt(tx.balance_after)}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-500">
                                {tx.reference_no || '—'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL: SUB-SAFE DISBURSEMENT (إيصال J1 ومطابقة الفئات) ══════════════════ */}
      {showSubSafeExpenseModal && selectedSubSafe && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 p-6 space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-rose-100 text-rose-700 rounded-2xl">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-slate-800 text-base">صرف مصروف من {selectedSubSafe.name}</h3>
                    <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full font-mono font-black text-xs border border-amber-300">
                      رقم الإيصال: {subSafeExpenseForm.reference_no || 'J1-001'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    الرصيد المتاح حالياً بالخزينة: <strong className="text-amber-700 font-mono font-black">{fmt(selectedSubSafe.current_balance)} ج.م</strong>
                  </p>
                </div>
              </div>
              <button onClick={() => setShowSubSafeExpenseModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubSafeDisburse} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">المبلغ المراد صرفه (جنيه مصري) *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={subSafeExpenseForm.amount}
                    onChange={e => setSubSafeExpenseForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full border-2 border-rose-300 rounded-2xl px-3 py-2 text-base font-black font-mono text-rose-700 focus:border-rose-600 focus:outline-none"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">تصنيف المصروف *</label>
                  <select
                    value={subSafeExpenseForm.category}
                    onChange={e => setSubSafeExpenseForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold bg-white"
                  >
                    <option value="كارتات طريق ورسوم بوابات وموازين">🛣️ كارتات طريق ورسوم بوابات وموازين</option>
                    <option value="مصاريف كاوتش وبنشر وصيانة سيارات">🚗 مصاريف كاوتش وبنشر وصيانة سيارات</option>
                    <option value="مصاريف نظافة ومهمات تشغيل وبوفيه">🧹 مصاريف نظافة ومهمات تشغيل وبوفيه</option>
                    <option value="إكراميات ونثريات وسيارات إسعاف">🤝 إكراميات ونثريات وسيارات إسعاف</option>
                    <option value="تصفية عهدة سائق أو موظف">🔄 تصفية عهدة سائق أو موظف</option>
                    <option value="مشتريات طارئة ومستلزمات">🛒 مشتريات طارئة ومستلزمات</option>
                    <option value="أخرى">نثريات ومصروفات أخرى</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">اسم الموظف أو السائق المستلم</label>
                  <input
                    type="text"
                    value={subSafeExpenseForm.courier_name}
                    onChange={e => setSubSafeExpenseForm(f => ({ ...f, courier_name: e.target.value }))}
                    placeholder="اسم السائق أو مستلم المبلغ..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">رقم الإيصال (يبدأ بـ J1) *</label>
                  <input
                    type="text"
                    required
                    value={subSafeExpenseForm.reference_no}
                    onChange={e => setSubSafeExpenseForm(f => ({ ...f, reference_no: e.target.value }))}
                    placeholder="J1-001"
                    className="w-full border-2 border-amber-300 rounded-xl px-3 py-2 text-xs font-mono font-bold bg-amber-50/50"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">البيان والسبب بالتفصيل *</label>
                <input
                  required
                  value={subSafeExpenseForm.description}
                  onChange={e => setSubSafeExpenseForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="مثال: رسوم كارتة طريق القاهرة الإسكندرية لسيارة رقم ..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              {/* Receipt / Invoice Photo Attachment (Optional) */}
              <ReceiptAttachmentInput
                value={subSafeExpenseForm.receipt_image}
                onChange={url => setSubSafeExpenseForm(f => ({ ...f, receipt_image: url }))}
                label="صورة إيصال المصروف / تذكرة الكارتة أو الفاتورة (اختياري)"
              />

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="text-xs text-slate-500">
                  سيتم خصم <strong className="font-mono text-rose-700 font-bold">{fmt(parseFloat(subSafeExpenseForm.amount) || 0)} ج.م</strong> من رصيد عهدة {selectedSubSafe.name}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSubSafeExpenseModal(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !subSafeExpenseForm.amount || parseFloat(subSafeExpenseForm.amount) <= 0 || parseFloat(subSafeExpenseForm.amount) > (selectedSubSafe?.current_balance || 0)}
                    className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    {saving ? 'جاري القيد والصرف...' : 'اعتماد وصرف المصروف (J1)'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL: EMPLOYEE DISBURSEMENT (نافذة واحدة لمصروف 10 و 20 والسلف) ══════════════════ */}
      {showEmployeeDisburseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 p-6 space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-100 text-purple-700 rounded-2xl">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">
                    صرف مالي للموظفين (مصروف 10 و 20 والسلف)
                  </h3>
                  <p className="text-xs text-slate-500">
                    نافذة موحدة لصرف مستحقات وسلف الموظفين مع إنقاص الدرج والربط المباشر بالرواتب
                  </p>
                </div>
              </div>
              <button onClick={() => setShowEmployeeDisburseModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployeeDisbursement} className="space-y-4 text-xs">
              {/* Safe & Employee */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الخزينة المنصرف منها *</label>
                  <select
                    value={empDisburseForm.safe_id}
                    onChange={e => setEmpDisburseForm(f => ({ ...f, safe_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 font-bold"
                    required
                  >
                    {mainSafes.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} (الرصيد المتاح: {fmt(s.current_balance)} ج.م)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">الموظف المستفيد *</label>
                  <select
                    required
                    value={empDisburseForm.employee_id}
                    onChange={e => setEmpDisburseForm(f => ({ ...f, employee_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white font-bold"
                  >
                    <option value="">-- اختر الموظف --</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>
                        [{e.code}] {e.name} {e.job_title ? `— ${e.job_title}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Operation Type Switcher */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">نوع الصرف المطلوب *</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'day_10', label: 'مصروف يوم 10', icon: '📅', desc: 'يخصم من راتب الشهر' },
                    { id: 'day_20', label: 'مصروف يوم 20', icon: '📅', desc: 'يخصم من راتب الشهر' },
                    { id: 'monthly_loan', label: 'سلفة (أقساط شهور)', icon: '💳', desc: 'تقسيط على عدة شهور' },
                    { id: 'emergency_loan', label: 'سلفة طارئة', icon: '⚡', desc: 'سلفة مؤقتة مستردة' },
                  ].map(opt => (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => setEmpDisburseForm(f => ({ ...f, disbursement_type: opt.id }))}
                      className={`p-2.5 rounded-2xl border text-right transition-all cursor-pointer ${
                        empDisburseForm.disbursement_type === opt.id
                          ? 'border-purple-600 bg-purple-50 text-purple-950 ring-2 ring-purple-400/40 shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <span>{opt.icon}</span>
                        <span>{opt.label}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional details for Day 10 / Day 20 */}
              {(empDisburseForm.disbursement_type === 'day_10' || empDisburseForm.disbursement_type === 'day_20') && (
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex flex-wrap items-center justify-between gap-3">
                  <span className="font-bold text-amber-900 text-xs">
                    سيتم قيد هذا المبلغ في مسير مصروفات منتصف الشهر وخصمه تلقائياً من صافي راتب الشهر المحدد
                  </span>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-bold text-amber-800">شهر/سنة الخصم:</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={empDisburseForm.month}
                      onChange={e => setEmpDisburseForm(f => ({ ...f, month: e.target.value }))}
                      className="w-16 bg-white border border-amber-300 rounded-lg px-2 py-1 text-center font-bold"
                    />
                    <input
                      type="number"
                      min="2020"
                      max="2035"
                      value={empDisburseForm.year}
                      onChange={e => setEmpDisburseForm(f => ({ ...f, year: e.target.value }))}
                      className="w-20 bg-white border border-amber-300 rounded-lg px-2 py-1 text-center font-bold"
                    />
                  </div>
                </div>
              )}

              {/* Conditional details for Monthly Loan */}
              {empDisburseForm.disbursement_type === 'monthly_loan' && (
                <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-purple-900 mb-1">عدد شهور التقسيط *</label>
                      <select
                        value={empDisburseForm.months_count}
                        onChange={e => setEmpDisburseForm(f => ({ ...f, months_count: e.target.value }))}
                        className="w-full bg-white border border-purple-300 rounded-xl px-3 py-2 font-bold"
                      >
                        {[1, 2, 3, 4, 5, 6, 8, 10, 12, 18, 24].map(m => (
                          <option key={m} value={m}>{m} شهر</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-purple-900 mb-1">شهر بدء خصم القسط *</label>
                      <input
                        type="month"
                        value={empDisburseForm.start_date}
                        onChange={e => setEmpDisburseForm(f => ({ ...f, start_date: e.target.value }))}
                        className="w-full bg-white border border-purple-300 rounded-xl px-3 py-2 font-bold font-mono"
                        required
                      />
                    </div>
                  </div>

                  {empDisburseForm.amount && empDisburseForm.months_count && (
                    <div className="p-2.5 bg-white rounded-xl border border-purple-300 flex items-center justify-between">
                      <span className="text-purple-900 font-bold">قيمة القسط الشهري المحسوبة:</span>
                      <span className="text-sm font-black text-purple-800 font-mono">
                        {fmt((parseFloat(empDisburseForm.amount) / parseInt(empDisburseForm.months_count, 10)).toFixed(2))} ج.م شهرياً
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Amount Input */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">مبلغ الصرف المطلوب (ج.م) *</label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  required
                  value={empDisburseForm.amount}
                  onChange={e => setEmpDisburseForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full border-2 border-purple-300 rounded-2xl px-4 py-2.5 text-lg font-black font-mono text-purple-950 focus:border-purple-600 focus:outline-none"
                />
              </div>

              {/* Denominations / Drawer Payout Breakdown */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-purple-600" />
                  تحديد فئات وبواكي النقدية المنصرفة من الدرج (إلزامي لمطابقة مبلغ الصرف):
                </span>
                <DenominationInputs
                  data={empDenomData}
                  onChange={setEmpDenomData}
                  targetAmount={parseFloat(empDisburseForm.amount) || 0}
                  title="فئات النقدية المنصرفة للموظف:"
                />
              </div>

              {/* Notes & Recipient */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اسم المستلم أو المندوب (إن وجد)</label>
                  <input
                    value={empDisburseForm.courier_name}
                    onChange={e => setEmpDisburseForm(f => ({ ...f, courier_name: e.target.value }))}
                    placeholder="اسم الشخص المستلم..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ملاحظات وبيان إضافي</label>
                  <input
                    value={empDisburseForm.notes}
                    onChange={e => setEmpDisburseForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="ملاحظات الصرف..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              {/* Optional Receipt / Loan Attachment */}
              <ReceiptAttachmentInput
                imageUrl={empDisburseForm.receipt_image}
                onUpload={(url) => setEmpDisburseForm(f => ({ ...f, receipt_image: url }))}
                onRemove={() => setEmpDisburseForm(f => ({ ...f, receipt_image: '' }))}
                label="إرفاق صورة إيصال استلام السلفة أو توقيع الموظف (اختياري 📷)"
              />

              {/* Matching status alert & Save button */}
              {(() => {
                const amt = parseFloat(empDisburseForm.amount) || 0;
                const denomTot = calcDenomTotal(empDenomData);
                const isMatch = amt > 0 && Math.abs(denomTot - amt) < 0.01;
                return (
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    {!isMatch && (
                      <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 font-bold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>
                          {denomTot === 0
                            ? `⚠️ يجب إدخال فئات النقدية المنصرفة لتطابق مبلغ الصرف (${fmt(amt)} ج.م) لتفعيل الحفظ.`
                            : `❌ غير متطابق: إجمالي الفئات المنصرفة (${fmt(denomTot)} ج.م) لا يطابق مبلغ الصرف (${fmt(amt)} ج.م) - الفارق: ${fmt(Math.abs(amt - denomTot))} ج.م`}
                        </span>
                      </div>
                    )}
                    {isMatch && (
                      <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>✅ الفئات والبواكي مطابقة لمبلغ الصرف تماماً - جاهز لتأكيد الصرف وحفظ الحركة.</span>
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowEmployeeDisburseModal(false)}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        disabled={saving || !isMatch || !empDisburseForm.employee_id}
                        className="px-6 py-2.5 bg-purple-700 hover:bg-purple-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        {saving ? 'جاري الصرف والخصم من الدرج...' : 'تأكيد وصرف المبلغ للموظف'}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL: NON-EMPLOYEE DISBURSEMENT (صرف للأشخاص والشركات) ══════════════════ */}
      {showPartyDisburseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 p-6 space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-2xl">
                  <Building className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">
                    صرف نقدية لجهات وشركات التعامل (موردين / فنيين / صيانة)
                  </h3>
                  <p className="text-xs text-slate-500">
                    صرف لشراء أحبار، تركيب كاميرات، صيانة كاوتش، مستلزمات مع رقم الفاتورة والإنقاص من الدرج
                  </p>
                </div>
              </div>
              <button onClick={() => setShowPartyDisburseModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePartyDisbursement} className="space-y-4 text-xs">
              {/* Safe selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">الخزينة المنصرف منها *</label>
                <select
                  value={partyDisburseForm.safe_id}
                  onChange={e => setPartyDisburseForm(f => ({ ...f, safe_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 font-bold"
                  required
                >
                  {mainSafes.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} (الرصيد المتاح: {fmt(s.current_balance)} ج.م)
                    </option>
                  ))}
                </select>
              </div>

              {/* Party Selector or Quick New Inline */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700">الجهة / الشركة / الشخص المستفيد *</label>
                  <button
                    type="button"
                    onClick={() => setPartyDisburseForm(f => ({ ...f, isNewPartyInline: !f.isNewPartyInline }))}
                    className="text-blue-600 hover:underline text-[11px] font-bold cursor-pointer"
                  >
                    {partyDisburseForm.isNewPartyInline ? '← اختيار من الجهات المسجلة' : '+ تكويد اسم جهة / شخص جديد'}
                  </button>
                </div>

                {!partyDisburseForm.isNewPartyInline ? (
                  <select
                    required
                    value={partyDisburseForm.party_id}
                    onChange={e => {
                      const pid = e.target.value;
                      const p = parties.find(x => String(x.id) === String(pid));
                      setPartyDisburseForm(f => ({
                        ...f,
                        party_id: pid,
                        party_name: p ? p.name : '',
                        category: p ? p.category : f.category
                      }));
                    }}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white font-bold text-xs"
                  >
                    <option value="">-- اختر الجهة أو الشركة --</option>
                    {parties.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.category}) {p.phone ? `— ${p.phone}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">اسم الجهة أو الشركة الجديدة *</label>
                        <input
                          required
                          value={partyDisburseForm.newPartyName}
                          onChange={e => setPartyDisburseForm(f => ({ ...f, newPartyName: e.target.value }))}
                          placeholder="مثال: شركة النصر للأحبار"
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">رقم الموبايل</label>
                        <input
                          value={partyDisburseForm.newPartyPhone}
                          onChange={e => setPartyDisburseForm(f => ({ ...f, newPartyPhone: e.target.value }))}
                          placeholder="010..."
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Category & Invoice No */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">تصنيف المصروف *</label>
                  <select
                    value={partyDisburseForm.category}
                    onChange={e => setPartyDisburseForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white text-xs font-bold"
                  >
                    <option value="أحبار وطابعات">أحبار وطابعات ومطبوعات</option>
                    <option value="كاميرات ومراقبة">كاميرات مراقبة وأجهزة شبكات</option>
                    <option value="كاوتش وصيانة سيارات">كاوتش وبنشر وصيانة سيارات</option>
                    <option value="مهمات نظافة وتشغيل">مهمات نظافة وتشغيل وبوفيه</option>
                    <option value="كهرباء وسباكة">كهرباء وسباكة ومقاولات</option>
                    <option value="إكراميات ونثريات">إكراميات ونثريات</option>
                    <option value="صيانة دورية">صيانة دورية ومستلزمات</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم الفاتورة / إذن التوريد أو الإيصال</label>
                  <input
                    value={partyDisburseForm.invoice_no}
                    onChange={e => setPartyDisburseForm(f => ({ ...f, invoice_no: e.target.value }))}
                    placeholder="مثال: INV-2026-004"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {/* Quick Suggestion Chips */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">نماذج سريعة للبيان بنقرة واحدة:</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'شراء عبوات حبر طابعة HP',
                    'تركيب وصيانة كاميرات المراقبة',
                    'إصلاح وتغيير كاوتش وبنشر',
                    'مستلزمات ومهمات تشغيل',
                    'فني صيانة كهرباء وسباكة',
                    'سداد فاتورة توريدات'
                  ].map(chip => (
                    <button
                      type="button"
                      key={chip}
                      onClick={() => setPartyDisburseForm(f => ({ ...f, description: chip }))}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-[10px] font-bold text-slate-600 transition-colors cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">بيان المصروف التفصيلي *</label>
                <input
                  required
                  value={partyDisburseForm.description}
                  onChange={e => setPartyDisburseForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="مثال: شراء عبوات حبر لطابعات قسم الحسابات"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">مبلغ الفاتورة / الصرف المطلوب (ج.م) *</label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  required
                  value={partyDisburseForm.amount}
                  onChange={e => setPartyDisburseForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full border-2 border-blue-300 rounded-2xl px-4 py-2.5 text-lg font-black font-mono text-blue-950 focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* Farm Cost Center Tag */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-900">
                  <input
                    type="checkbox"
                    checked={partyDisburseForm.isFarmExpense}
                    onChange={e => setPartyDisburseForm(f => ({ ...f, isFarmExpense: e.target.checked }))}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <span>🌾 هذا المصروف يخص مزرعة الشركة (أسمدة، تقليم، بذور، شجر، شبكات ري)</span>
                </label>
                {partyDisburseForm.isFarmExpense && (
                  <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                    سيُدرج في حساب المزرعة
                  </span>
                )}
              </div>

              {/* Optional Receipt / Invoice Attachment */}
              <ReceiptAttachmentInput
                imageUrl={partyDisburseForm.receipt_image}
                onUpload={(url) => setPartyDisburseForm(f => ({ ...f, receipt_image: url }))}
                onRemove={() => setPartyDisburseForm(f => ({ ...f, receipt_image: '' }))}
                label="إرفاق صورة الفاتورة أو إيصال الصرف (اختياري 🧾)"
              />

              {/* Denominations / Drawer Payout Breakdown */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-blue-600" />
                  تحديد فئات وبواكي النقدية المنصرفة من الدرج (إلزامي لمطابقة مبلغ الصرف):
                </span>
                <DenominationInputs
                  data={partyDenomData}
                  onChange={setPartyDenomData}
                  targetAmount={parseFloat(partyDisburseForm.amount) || 0}
                  title="فئات النقدية المنصرفة للجهة:"
                />
              </div>

              {/* Matching status alert & Save button */}
              {(() => {
                const amt = parseFloat(partyDisburseForm.amount) || 0;
                const denomTot = calcDenomTotal(partyDenomData);
                const isMatch = amt > 0 && Math.abs(denomTot - amt) < 0.01;
                const hasParty = partyDisburseForm.isNewPartyInline ? !!partyDisburseForm.newPartyName.trim() : !!partyDisburseForm.party_id;

                return (
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    {!isMatch && (
                      <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 font-bold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>
                          {denomTot === 0
                            ? `⚠️ يجب إدخال فئات النقدية المنصرفة لتطابق مبلغ الفاتورة (${fmt(amt)} ج.م) لتفعيل الحفظ.`
                            : `❌ غير متطابق: إجمالي الفئات المنصرفة (${fmt(denomTot)} ج.م) لا يطابق مبلغ الفاتورة (${fmt(amt)} ج.م) - الفارق: ${fmt(Math.abs(amt - denomTot))} ج.م`}
                        </span>
                      </div>
                    )}
                    {isMatch && (
                      <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>✅ الفئات والبواكي مطابقة لمبلغ الفاتورة تماماً - جاهز لتأكيد الصرف وتحديث كشف حساب الجهة.</span>
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowPartyDisburseModal(false)}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        disabled={saving || !isMatch || !hasParty || !partyDisburseForm.description}
                        className="px-6 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        {saving ? 'جاري الصرف والخصم...' : 'تأكيد وصرف المبلغ للجهة'}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL: CUSTODY RECEIVE (استلام عهدة مع مطابقة الفئات الصارمة) ══════════════════ */}
      {showCustodyReceiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 p-6 space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-2xl">
                  <ArrowDownCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">
                    استلام عهدة نقدية من أمين خزينة الشركة
                  </h3>
                  <p className="text-xs text-slate-500">
                    إيداع عهدة جديدة بالخزينة وإثبات الفئات والبواكي بالدرج وإشعار الواتساب
                  </p>
                </div>
              </div>
              <button onClick={() => setShowCustodyReceiveModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustodyReceive} className="space-y-4 text-xs">
              {/* Safe selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الخزينة المستلمة *</label>
                  <select
                    value={custodyReceiveForm.safe_id}
                    onChange={e => setCustodyReceiveForm(f => ({ ...f, safe_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 font-bold"
                    required
                  >
                    {mainSafes.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} (الرصيد الحالي: {fmt(s.current_balance)} ج.م)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم موبايل أمين الخزينة (لإرسال إشعار الواتساب)</label>
                  <input
                    value={custodyReceiveForm.sender_phone}
                    onChange={e => setCustodyReceiveForm(f => ({ ...f, sender_phone: e.target.value }))}
                    placeholder="010..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الموظف / السائق الذي وصل العهدة</label>
                  <input
                    value={custodyReceiveForm.courier_name}
                    onChange={e => setCustodyReceiveForm(f => ({ ...f, courier_name: e.target.value }))}
                    placeholder="اسم الموظف أو السائق..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم الإيصال / السند</label>
                  <input
                    value={custodyReceiveForm.reference_no}
                    onChange={e => setCustodyReceiveForm(f => ({ ...f, reference_no: e.target.value }))}
                    placeholder="رقم الإيصال..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">المبلغ المستلم للعهدة (ج.م) *</label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  required
                  value={custodyReceiveForm.amount}
                  onChange={e => setCustodyReceiveForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full border-2 border-emerald-300 rounded-2xl px-4 py-2.5 text-lg font-black font-mono text-emerald-950 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {/* Denominations Breakdown (Must match exactly) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-600" />
                  توزيع فئات وبواكي وفكة المبلغ المستلم (إلزامي لمطابقة مبلغ العهدة):
                </span>
                <DenominationInputs
                  data={custodyDenomData}
                  onChange={setCustodyDenomData}
                  targetAmount={parseFloat(custodyReceiveForm.amount) || 0}
                  title="فئات وبواكي العهدة المستلمة:"
                />
              </div>

              {/* Matching check and save button */}
              {(() => {
                const amt = parseFloat(custodyReceiveForm.amount) || 0;
                const denomTot = calcDenomTotal(custodyDenomData);
                const isMatch = amt > 0 && Math.abs(denomTot - amt) < 0.01;

                return (
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    {!isMatch && (
                      <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 font-bold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>
                          {denomTot === 0
                            ? `⚠️ يجب إدخال فئات النقدية المستلمة لتطابق مبلغ العهدة (${fmt(amt)} ج.م) لتفعيل الحفظ.`
                            : `❌ غير متطابق: إجمالي الفئات المستلمة (${fmt(denomTot)} ج.م) لا يطابق مبلغ العهدة (${fmt(amt)} ج.م) - الفارق: ${fmt(Math.abs(amt - denomTot))} ج.م`}
                        </span>
                      </div>
                    )}
                    {isMatch && (
                      <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>✅ الفئات والبواكي مطابقة لمبلغ العهدة تماماً - جاهز لحفظ العهدة وتحديث الدرج.</span>
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCustodyReceiveModal(false)}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        disabled={saving || !isMatch}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        {saving ? 'جاري الحفظ وإيداع الدرج...' : 'تأكيد واستلام العهدة بالخزينة'}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL: SUB-SAFES BROWSER (استعراض الخزائن الفرعية) ══════════════════ */}
      {showSubSafesBrowserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-100 p-6 space-y-5 my-auto max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 text-amber-700 rounded-2xl">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-lg">
                    استعراض ومراجعة الخزائن الفرعية المستقلة ({subSafes.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    متابعة أرصدة العهد بالخزائن الفرعية المستقلة، الدخول لدفاتر الحركات، والصرف السريع
                  </p>
                </div>
              </div>
              <button onClick={() => setShowSubSafesBrowserModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary KPI Banner */}
            <div className="p-4 bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl text-white flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs font-bold text-amber-100 block">إجمالي أرصدة العهد بالخزائن الفرعية</span>
                <p className="text-xl sm:text-2xl font-black font-mono tracking-tight break-all">{fmt(subBalance)} ج.م</p>
              </div>
              <button
                onClick={() => {
                  setShowSubSafesBrowserModal(false);
                  setEditSafe(null);
                  setSafeForm({ name: '', type: 'sub', parent_safe_id: mainSafes[0]?.id || '', custodian_name: '', custodian_phone: '', custodian_employee_id: '', notes: '' });
                  setShowNewSafeModal(true);
                }}
                className="px-4 py-2 bg-white text-amber-900 font-bold rounded-xl text-xs shadow-xs hover:bg-amber-50 transition-colors cursor-pointer"
              >
                + إضافة خزينة فرعية جديدة
              </button>
            </div>

            {/* Grid of Sub Safes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subSafes.length === 0 ? (
                <div className="col-span-2 p-10 text-center text-slate-400 font-bold bg-slate-50 rounded-2xl">
                  لا توجد خزائن فرعية مسجلة حالياً
                </div>
              ) : (
                subSafes.map(sub => (
                  <div key={sub.id} className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3 hover:border-amber-400 transition-all shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-800 text-sm">{sub.name}</span>
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold">فرعية مستقلة</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          المسؤول: {sub.custodian_name || 'غير محدد'}
                          {sub.custodian_phone && <span className="mr-2 text-emerald-600 font-mono font-bold">({sub.custodian_phone})</span>}
                        </p>
                      </div>
                      <div className="text-left bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold block">رصيد العهدة</span>
                        <span className="font-black text-base text-amber-700 font-mono">{fmt(sub.current_balance)} ج.م</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
                      <button
                        onClick={() => {
                          setShowSubSafesBrowserModal(false);
                          setSelectedSubSafe(sub);
                          loadSubSafeTransactions(sub.id);
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        دخول ومراجعة الخزينة
                      </button>

                      <button
                        onClick={() => {
                          setShowSubSafesBrowserModal(false);
                          openSubSafeExpenseModal(sub);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        صرف سريع (J1)
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL: PARTY STATEMENT (كشف حساب الجهة) ══════════════════ */}
      {showStatementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-100 p-6 space-y-6 my-auto max-h-[92vh] overflow-y-auto print:p-0 print:shadow-none">
            {/* Modal Top Bar */}
            <div className="flex items-center justify-between border-b pb-4 border-slate-100 sticky top-0 bg-white z-10 print:hidden">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-lg font-bold">
                  🏢
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base md:text-lg">
                    كشف حساب ومراجعة معاملات الجهة / الشركة
                  </h3>
                  <p className="text-xs text-slate-400">سجل كامل بجميع المسحوبات والمصروفات المنصرفة لهذه الجهة</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  طباعة كشف الحساب
                </button>
                <button
                  onClick={() => { setShowStatementModal(false); setStatementData(null); }}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {statementLoading ? (
              <div className="p-12 text-center text-slate-400 font-bold">جاري جلب تفاصيل كشف الحساب...</div>
            ) : statementData ? (
              <div className="space-y-6">
                {/* Party Profile Card */}
                <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 border border-purple-200 rounded-2xl p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-black text-purple-950">{statementData.party.name}</h2>
                        <span className="px-2.5 py-0.5 bg-purple-200 text-purple-900 rounded-full text-[10px] font-bold">
                          {statementData.party.category || 'جهة خارجية'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-purple-800 mt-1">
                        {statementData.party.contact_person && (
                          <span>المسؤول: <strong>{statementData.party.contact_person}</strong></span>
                        )}
                        {statementData.party.phone && (
                          <span dir="ltr" className="font-mono font-bold text-emerald-700">📞 {statementData.party.phone}</span>
                        )}
                        {statementData.party.tax_no && (
                          <span>رقم ضريبي: <strong className="font-mono">{statementData.party.tax_no}</strong></span>
                        )}
                      </div>
                    </div>

                    <div className="text-left bg-white/80 border border-purple-200 px-4 py-2.5 rounded-2xl">
                      <span className="text-[10px] font-bold text-purple-700 block">إجمالي ما تم صرفه للجهة</span>
                      <span className="text-xl font-black font-mono text-purple-950">
                        {fmt(statementData.statement.total_amount)} <span className="text-xs font-normal">ج.م</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Transactions Table */}
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-purple-600" />
                    تفاصيل الفواتير والمسحوبات المنصرفة ({statementData.statement.transactions_count} حركة):
                  </h4>

                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                    <table className="w-full text-xs" dir="rtl">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 text-right font-bold text-slate-700">التاريخ</th>
                          <th className="py-2.5 px-3 text-right font-bold text-slate-700">الخزينة المصروف منها</th>
                          <th className="py-2.5 px-3 text-right font-bold text-slate-700">البيان وتفاصيل الصرف</th>
                          <th className="py-2.5 px-3 text-right font-bold text-slate-700">المستلم / المندوب</th>
                          <th className="py-2.5 px-3 text-center font-bold text-slate-700">رقم الفاتورة / الإيصال</th>
                          <th className="py-2.5 px-3 text-center font-bold text-purple-800 bg-purple-50/50">المبلغ المنصرف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {statementData.statement.transactions.length === 0 ? (
                          <tr><td colSpan={6} className="py-8 text-center text-slate-400">لا توجد حركات مسجلة لهذه الجهة</td></tr>
                        ) : statementData.statement.transactions.map(t => (
                          <tr key={t.id} className="hover:bg-slate-50/80">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{t.transaction_date}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-800">{t.safe_name}</td>
                            <td className="py-2.5 px-3 text-slate-800">
                              <p className="font-medium">{t.description}</p>
                              {t.category && <span className="text-[10px] text-purple-600 font-bold block">{t.category}</span>}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">{t.related_employee_name || '—'}</td>
                            <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-500">
                              {t.invoice_no || t.reference_no || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-black text-purple-900 bg-purple-50/30 text-sm">
                              {fmt(t.amount)} ج.م
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                        <tr>
                          <td colSpan={5} className="py-3 px-4 text-left font-black text-slate-800">
                            إجمالي المنصرف النهائي:
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-black text-purple-900 text-sm">
                            {fmt(statementData.statement.total_amount)} ج.م
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL: NEW / EDIT PARTY ══════════════════ */}
      {showNewPartyModal && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                <Building className="w-5 h-5 text-purple-600" />
                {editParty ? 'تعديل بيانات الجهة / الشركة' : 'تكويد جهة أو شركة خارجية جديدة'}
              </h3>
              <button
                onClick={() => { setShowNewPartyModal(false); setEditParty(null); }}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveParty} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم الشركة أو التوكيل أو الفني *</label>
                <input
                  required
                  value={partyForm.name}
                  onChange={e => setPartyForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="مثال: شركة النيل لتوريد أحبار وماكينات الطباعة"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">نوع الجهة *</label>
                  <select
                    value={partyForm.party_type}
                    onChange={e => setPartyForm(f => ({ ...f, party_type: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white font-semibold"
                  >
                    <option value="company">شركة توريدات / توكيل</option>
                    <option value="supplier">مورد خامات / بضائع</option>
                    <option value="technician">فني / مقاول صيانة</option>
                    <option value="individual">شخص / جهة أخرى</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">التصنيف الرئيسي *</label>
                  <select
                    value={partyForm.category}
                    onChange={e => setPartyForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white font-semibold"
                  >
                    <option value="أحبار وطابعات">أحبار وطابعات ومستلزمات كمبيوتر</option>
                    <option value="كاميرات ومراقبة">كاميرات مراقبة وأجهزة إنذار وشبكات</option>
                    <option value="صيانة سيارات وكاوتش">صيانة سيارات وإطارات وبنشر</option>
                    <option value="مهمات تشغيل ونظافة">مهمات تشغيل ونظافة وبوفيه</option>
                    <option value="أجهزة ومعدات">أجهزة ومعدات كهربائية</option>
                    <option value="صيانة عامة">صيانة عامة ومقاولات</option>
                    <option value="أخرى">أخرى ونثريات</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">الشخص المسؤول / جهة الاتصال</label>
                  <input
                    value={partyForm.contact_person}
                    onChange={e => setPartyForm(f => ({ ...f, contact_person: e.target.value }))}
                    placeholder="م. أحمد..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">رقم الهاتف / الموبايل</label>
                  <input
                    value={partyForm.phone}
                    onChange={e => setPartyForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="010xxxxxxxx"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">الرقم الضريبي (اختياري)</label>
                  <input
                    value={partyForm.tax_no}
                    onChange={e => setPartyForm(f => ({ ...f, tax_no: e.target.value }))}
                    placeholder="رقم السجل أو البطاقة الضريبية"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">العنوان / الفرع</label>
                  <input
                    value={partyForm.address}
                    onChange={e => setPartyForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="العنوان أو موقع الفرع..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات إضافية</label>
                <input
                  value={partyForm.notes}
                  onChange={e => setPartyForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="ملاحظات حول طريقة السداد أو مواعيد التوريد..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setShowNewPartyModal(false); setEditParty(null); }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving || !partyForm.name}
                  className="px-6 py-2 bg-purple-700 hover:bg-purple-800 disabled:bg-slate-300 text-white font-bold rounded-xl cursor-pointer shadow-xs"
                >
                  {saving ? 'جاري الحفظ...' : editParty ? 'حفظ التعديلات' : 'تكويد الجهة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL: FARM CROP SALE DEPOSIT (توريد بيع محاصيل المزرعة M1) ══════════════════ */}
      {showFarmSaleModal && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-100 p-6 space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-2xl">
                  <Sprout className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-slate-800 text-base">توريد مبيعات محصول للمزرعة</h3>
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-mono font-black text-xs border border-emerald-300">
                      سند: {farmSaleForm.reference_no || 'M1-001'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    إيداع مبالغ نقدية واردة من بيع المحاصيل الزراعية وإثباتها بحساب المزرعة
                  </p>
                </div>
              </div>
              <button onClick={() => setShowFarmSaleModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFarmSale} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الخزينة المودع بها *</label>
                  <select
                    required
                    value={farmSaleForm.safe_id}
                    onChange={e => setFarmSaleForm(f => ({ ...f, safe_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 font-bold"
                  >
                    {safes.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.type === 'main' ? 'خزينة رئيسية' : 'خزينة فرعية'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">نوع المحصول المباع *</label>
                  <select
                    value={farmSaleForm.crop_type}
                    onChange={e => {
                      const ct = e.target.value;
                      setFarmSaleForm(f => ({
                        ...f,
                        crop_type: ct,
                        description: `توريد قيمة بيع ${ct}`
                      }));
                    }}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white font-bold"
                  >
                    <option value="محصول مانجو">🥭 محصول مانجو</option>
                    <option value="محصول بلح">🌴 محصول بلح</option>
                    <option value="محصول زيتون">🫒 محصول زيتون</option>
                    <option value="محاصيل أخرى">🌾 محاصيل أخرى ونواتج تقليم</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">المبلغ المورد (جنيه مصري) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={farmSaleForm.amount}
                    onChange={e => setFarmSaleForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full border-2 border-emerald-400 rounded-2xl px-3 py-2 text-base font-black font-mono text-emerald-950 focus:border-emerald-600 focus:outline-none"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">رقم السند / الإيصال *</label>
                  <input
                    type="text"
                    required
                    value={farmSaleForm.reference_no}
                    onChange={e => setFarmSaleForm(f => ({ ...f, reference_no: e.target.value }))}
                    placeholder="M1-001"
                    className="w-full border-2 border-emerald-300 rounded-xl px-3 py-2 text-xs font-mono font-bold bg-emerald-50/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">اسم التاجر أو المشتري</label>
                  <input
                    type="text"
                    value={farmSaleForm.buyer_name}
                    onChange={e => setFarmSaleForm(f => ({ ...f, buyer_name: e.target.value }))}
                    placeholder="اسم التاجر أو العميل المشتري..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">تاريخ التوريد</label>
                  <input
                    type="date"
                    value={farmSaleForm.transaction_date}
                    onChange={e => setFarmSaleForm(f => ({ ...f, transaction_date: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">البيان وتفاصيل الوزنة والكمية</label>
                <input
                  value={farmSaleForm.description}
                  onChange={e => setFarmSaleForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="مثال: توريد دفعة مبيعات مانجو زبدية 5 أطنان وزن بسكول"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              {/* Receipt / Scale ticket attachment */}
              <ReceiptAttachmentInput
                value={farmSaleForm.receipt_image}
                onChange={url => setFarmSaleForm(f => ({ ...f, receipt_image: url }))}
                label="صورة تذكرة وزنة البسكول أو إيصال استلام النقدية (اختياري)"
              />

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ملاحظات إضافية</label>
                <input
                  value={farmSaleForm.notes}
                  onChange={e => setFarmSaleForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="أي شروط توريد أو متبقي على التاجر..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="text-xs text-slate-500">
                  سيتم قيد <strong className="font-mono text-emerald-800 font-bold">{fmt(parseFloat(farmSaleForm.amount) || 0)} ج.م</strong> كإيراد لحساب المزرعة
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFarmSaleModal(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !farmSaleForm.amount || parseFloat(farmSaleForm.amount) <= 0}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    {saving ? 'جاري التوريد...' : 'تأكيد وقيد توريد المحصول (M1)'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL: CFO DRAWER RECONCILIATION SHARE (إرسال تقرير مطابقة الدرج عبر واتساب) ══════════════════ */}
      {showCfoShareModal && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-100 p-6 space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-2xl">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">
                    إرسال تقرير مطابقة الدرج للمدير المالي
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    إرسال تفاصيل الرصيد الفعلي وفئات وبواكي الدرج اليومية عبر واتساب بنقرة واحدة
                  </p>
                </div>
              </div>
              <button onClick={() => setShowCfoShareModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* CFO Phone & Save */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <label className="block font-bold text-slate-800">
                  📱 رقم موبايل المدير المالي (لإرسال رسالة الواتساب):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="tel"
                    value={cfoPhone}
                    onChange={e => setCfoPhone(e.target.value)}
                    placeholder="010xxxxxxxx أو +2010xxxxxxxx"
                    className="flex-1 border border-slate-300 rounded-xl px-3 py-2 font-mono text-sm font-bold bg-white focus:outline-emerald-500"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        localStorage.setItem('treasury_cfo_phone', cfoPhone);
                        alert('✅ تم تثبيت رقم المدير المالي بنجاح، ولن تحتاج لإدخاله مرة أخرى.');
                      } catch {
                        alert('تم الحفظ.');
                      }
                    }}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold cursor-pointer text-xs"
                    title="تثبيت الرقم دائماً في هذا المتصفح"
                  >
                    تثبيت الرقم 📌
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 block">
                  * يتم حفظ هذا الرقم في ذاكرة المتصفح تلقائياً لإرسال تقارير المطابقة اليومية إليه دائماً.
                </span>
              </div>

              {/* Status Banner */}
              <div className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between ${
                isExactDrawer ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-amber-50 border-amber-300 text-amber-800'
              }`}>
                <div className="flex items-center gap-2">
                  {isExactDrawer ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
                  <span>
                    {isExactDrawer
                      ? 'الدرج الفعلي مطابق 100% للرصيد الدفتري (لا يوجد عجز أو زيادة).'
                      : `يوجد فارق بين الدرج والدفتري: ${fmt(Math.abs(mainVariance))} ج.م (${mainVariance > 0 ? 'زيادة' : 'عجز'})`}
                  </span>
                </div>
                <span className="font-mono font-black text-sm">{fmt(mainPhysicalDrawer)} ج.م</span>
              </div>

              {/* Formatted Message Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700">معاينة نص الرسالة المرسلة:</label>
                  <button
                    type="button"
                    onClick={() => {
                      const msg = generateCfoWhatsAppMessage();
                      navigator.clipboard.writeText(msg);
                      setCfoCopied(true);
                      setTimeout(() => setCfoCopied(false), 2500);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {cfoCopied ? 'تم النسخ للحافظة ✓' : 'نسخ النص'}
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={9}
                  value={generateCfoWhatsAppMessage()}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-mono text-slate-800 leading-relaxed resize-none focus:outline-none"
                  dir="rtl"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCfoShareModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  إغلاق
                </button>

                <div className="flex items-center gap-2">
                  {typeof navigator !== 'undefined' && navigator.share && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.share({
                            title: 'تقرير مطابقة الخزينة',
                            text: generateCfoWhatsAppMessage()
                          });
                        } catch {
                          // Ignore cancelled share
                        }
                      }}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer flex items-center gap-1.5 text-xs"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      مشاركة
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      try {
                        localStorage.setItem('treasury_cfo_phone', cfoPhone);
                      } catch (e) {
                        console.error(e);
                      }
                      const cleanPhone = (cfoPhone || '').replace(/\D/g, '');
                      const formattedPhone = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone;
                      const msg = encodeURIComponent(generateCfoWhatsAppMessage());
                      const url = formattedPhone
                        ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${msg}`
                        : `https://api.whatsapp.com/send?text=${msg}`;
                      window.open(url, '_blank');
                    }}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 text-xs"
                  >
                    <span>إرسال تقرير المطابقة عبر واتساب 💬</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL: RECEIPT LIGHTBOX (معاينة وتكبير صورة الفاتورة) ══════════════════ */}
      {viewReceiptImage && (
        <div
          className="fixed inset-0 z-65 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
          onClick={() => setViewReceiptImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[92vh] bg-slate-900 rounded-3xl p-3 border border-white/10 shadow-2xl flex flex-col items-center space-y-3"
            onClick={e => e.stopPropagation()}
          >
            {/* Top Toolbar */}
            <div className="w-full flex items-center justify-between text-white text-xs px-2 pt-1 border-b border-white/10 pb-2">
              <span className="font-bold flex items-center gap-1.5 text-slate-200">
                <Image className="w-4 h-4 text-emerald-400" />
                معاينة مستند الفاتورة / إيصال الصرف
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={viewReceiptImage}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold text-[11px] transition-colors"
                >
                  فتح في تبويب جديد ↗
                </a>
                <button
                  type="button"
                  onClick={() => {
                    const win = window.open('');
                    win.document.write(`<img src="${viewReceiptImage}" style="max-width:100%;height:auto;" onload="window.print();window.close()"/>`);
                    win.focus();
                  }}
                  className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
                >
                  طباعة 🖨️
                </button>
                <button
                  type="button"
                  onClick={() => setViewReceiptImage(null)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Image Container */}
            <div className="overflow-auto max-h-[80vh] flex items-center justify-center rounded-2xl bg-black/40 p-2">
              <img
                src={viewReceiptImage}
                alt="صورة الفاتورة أو الإيصال"
                className="max-h-[76vh] max-w-full object-contain rounded-xl shadow-lg border border-white/10"
              />
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL: SUPABASE CLOUD STATUS & VERIFICATION ══════════════════ */}
      {showSupabaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col">
            <div className="p-6 bg-gradient-to-l from-emerald-700 to-teal-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-2xl">
                  <Cloud className="w-6 h-6 text-emerald-200" />
                </div>
                <div>
                  <h3 className="font-black text-lg">حالة المزامنة السحابية اللحظية (Supabase)</h3>
                  <p className="text-xs text-emerald-100">فحص وتأكيد الربط الفوري بين الخزينة والسيرفر السحابي</p>
                </div>
              </div>
              <button
                onClick={() => setShowSupabaseModal(false)}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {supabaseLoading ? (
                <div className="py-12 text-center text-slate-500 font-bold">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-600" />
                  جاري فحص السجلات سحابياً عبر خادم Supabase...
                </div>
              ) : supabaseStatus ? (
                <>
                  <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900">
                    <div className="flex items-center gap-3">
                      <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <div>
                        <div className="font-black text-sm">الاتصال السحابي نشط ويعمل بلحظية تامة ⚡</div>
                        <div className="text-[11px] text-emerald-700">أي حركة تتم على الخزينة أو الموردين تُسجل في سوبابيز في نفس اللحظة</div>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold bg-white px-2.5 py-1 rounded-lg border border-emerald-300">Port 5432 / 6543</span>
                  </div>

                  <div className="border border-slate-100 rounded-2xl overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3">الجدول / البند</th>
                          <th className="p-3 text-center">التطبيق المحلي</th>
                          <th className="p-3 text-center">سوبابيز السحابي</th>
                          <th className="p-3 text-center">حالة المزامنة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {supabaseStatus.comparison?.map((row, idx) => {
                          const labels = {
                            treasury_parties: '🏢 الموردين والشركات',
                            cash_safes: '🏦 الخزائن وأرصدتها',
                            cash_transactions: '📋 حركات وإيصالات الخزينة',
                            employees: '👥 الموظفين'
                          };
                          return (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="p-3 font-bold text-slate-800">{labels[row.table] || row.table}</td>
                              <td className="p-3 text-center font-mono font-bold text-slate-700">{row.localCount}</td>
                              <td className="p-3 text-center font-mono font-bold text-emerald-700">{row.remoteCount}</td>
                              <td className="p-3 text-center">
                                {row.synced ? (
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-black text-[10px] rounded-md">
                                    مطابق 100% ✓
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-black text-[10px] rounded-md">
                                    جاري التحديث...
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="text-center text-slate-500">لم يتم العثور على بيانات الاتصال</div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={handleForceSupabaseSync}
                disabled={supabaseSyncing}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${supabaseSyncing ? 'animate-spin' : ''}`} />
                {supabaseSyncing ? 'جاري المزامنة...' : 'مزامنة وتدقيق شامل الآن 🔄'}
              </button>

              <button
                onClick={() => setShowSupabaseModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
