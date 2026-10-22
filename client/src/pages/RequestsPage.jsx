import React, { useState, useEffect } from 'react';
import { 
  Inbox, CheckCircle2, XCircle, Clock3, Search, Filter, 
  RefreshCw, Check, X, Palmtree, Clock, UserPlus, ShieldCheck,
  Building2, UserCheck, ArrowRight, AlertCircle, FileText
} from 'lucide-react';
import { fetchJson } from '../utils/api';

export default function RequestsPage() {
  const [requests, setRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // View mode: 'admin' (الإدارة العامة) or 'manager' (مدير المخزن)
  const [viewMode, setViewMode] = useState('admin');

  // Submit on behalf modal
  const [showOnBehalfModal, setShowOnBehalfModal] = useState(false);
  const [onBehalfForm, setOnBehalfForm] = useState({
    employee_id: '',
    request_type: 'leave',
    title: '',
    date_from: new Date().toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
    quantity: 1,
    details: ''
  });
  const [submittingOnBehalf, setSubmittingOnBehalf] = useState(false);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const [reqData, empData] = await Promise.all([
        fetchJson(`/requests?status=${statusFilter}&type=${typeFilter}`),
        fetchJson('/employees')
      ]);
      setRequests(reqData);
      setEmployees(empData);
      if (empData.length > 0 && !onBehalfForm.employee_id) {
        setOnBehalfForm(prev => ({ ...prev, employee_id: empData[0].id }));
      }
    } catch (err) {
      alert('خطأ في جلب الطلبات: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [statusFilter, typeFilter]);

  // Warehouse Manager Action: approve (advances to pending_admin) or reject
  const handleManagerAction = async (id, action) => {
    const actionText = action === 'approved' ? 'الموافقة المبدئية ورفع الطلب للإدارة' : 'رفض الطلب';
    const notes = prompt(`ملاحظات مدير المخزن على ${actionText}:`, action === 'approved' ? 'موافق ومعتمد من مدير المخزن' : 'مرفوض لظروف العمل');
    if (notes === null) return;

    try {
      await fetchJson(`/requests/${id}/manager-action`, {
        method: 'PUT',
        body: JSON.stringify({ action, manager_notes: notes })
      });
      loadRequests();
    } catch (err) {
      alert('خطأ: ' + err.message);
    }
  };

  // Admin Final Action
  const handleAdminAction = async (id, status) => {
    const actionName = status === 'approved' ? 'الاعتماد النهائي والموافقة على' : 'رفض';
    if (window.confirm(`هل أنت متأكد من ${actionName} هذا الطلب؟`)) {
      try {
        await fetchJson(`/requests/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ status })
        });
        loadRequests();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  // Submit on behalf of worker
  const handleOnBehalfSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmittingOnBehalf(true);
      const res = await fetchJson('/requests/on-behalf', {
        method: 'POST',
        body: JSON.stringify(onBehalfForm)
      });
      alert('تم بنجاح رفع الطلب نيابة عن الموظف واعتماده مبدئياً وإرساله للإدارة العامة للاعتماد!');
      setShowOnBehalfModal(false);
      setOnBehalfForm({
        employee_id: employees[0]?.id || '',
        request_type: 'leave',
        title: '',
        date_from: new Date().toISOString().split('T')[0],
        date_to: new Date().toISOString().split('T')[0],
        quantity: 1,
        details: ''
      });
      loadRequests();
    } catch (err) {
      alert('خطأ أثناء تقديم الطلب: ' + err.message);
    } finally {
      setSubmittingOnBehalf(false);
    }
  };

  const filteredRequests = requests.filter(r =>
    !searchTerm ||
    r.employee_name.includes(searchTerm) ||
    r.employee_code.includes(searchTerm) ||
    r.title.includes(searchTerm)
  );

  const pendingManagerCount = requests.filter(r => r.status === 'pending_manager' || r.status === 'pending').length;
  const pendingAdminCount = requests.filter(r => r.status === 'pending_admin').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Inbox className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800">
              دورة موافقات الطلبات (مدير المخزن + الإدارة العامة)
            </h1>
            <p className="text-xs md:text-sm text-slate-500">
              اعتماد مرحلي للطلبات: موافقة مدير المخزن أولاً ثم اعتماد الإدارة، مع إمكانية التقديم نيابة عن السائقين والعمال
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 text-xs font-bold">
            <button
              onClick={() => setViewMode('manager')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'manager' 
                  ? 'bg-amber-500 text-slate-950 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              بوابة مدير المخزن {pendingManagerCount > 0 && `(${pendingManagerCount})`}
            </button>
            <button
              onClick={() => setViewMode('admin')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'admin' 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الإدارة العامة {pendingAdminCount > 0 && `(${pendingAdminCount})`}
            </button>
          </div>

          {/* Submit on behalf button */}
          <button
            onClick={() => setShowOnBehalfModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-xl shadow-xs transition-all"
          >
            <UserPlus className="w-4 h-4" />
            تقديم طلب نيابة عن سائق / عامل
          </button>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-2 px-3 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl font-bold"
          >
            <option value="all">جميع الحالات</option>
            <option value="pending_manager">في انتظار موافقة مدير المخزن ⏳</option>
            <option value="pending_admin">معتمد من مدير المخزن (في انتظار الإدارة) 🔔</option>
            <option value="approved">معتمد ومقبول نهائياً ✅</option>
            <option value="rejected">مرفوض ❌</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="py-2 px-3 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium"
          >
            <option value="all">جميع أنواع الطلبات</option>
            <option value="leave">طلبات الإجازة السنوية والعارضة</option>
            <option value="overtime">طلبات الإضافي</option>
            <option value="deduction">طلبات الخصم والغياب الجزئي</option>
            <option value="loan">طلبات السلف</option>
          </select>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالموظف، الكود أو الموضوع..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
          />
        </div>
      </div>

      {/* Requests List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mb-3 text-blue-600" />
            <p className="text-sm">جاري جلب الطلبات...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center p-12 text-slate-400">
            <Inbox className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-base font-medium text-slate-600">لا توجد طلبات مطابقة للبحث أو الفلتر المختار</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredRequests.map((req) => {
              const isManagerStage = req.status === 'pending_manager' || req.status === 'pending';
              const isAdminStage = req.status === 'pending_admin';
              const isApproved = req.status === 'approved';
              const isRejected = req.status === 'rejected';

              return (
                <div key={req.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-2xl shrink-0 ${
                      req.request_type === 'leave' ? 'bg-emerald-50 text-emerald-600' : 
                      req.request_type === 'deduction' ? 'bg-rose-50 text-rose-600' : 
                      'bg-blue-50 text-blue-600'
                    }`}>
                      {req.request_type === 'leave' ? <Palmtree className="w-6 h-6" /> : 
                       req.request_type === 'deduction' ? <AlertCircle className="w-6 h-6" /> : 
                       <Clock className="w-6 h-6" />}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs px-2 py-0.5 bg-blue-100 text-blue-700 font-bold rounded">
                          {req.employee_code}
                        </span>
                        <h3 className="font-bold text-slate-900 text-base">{req.employee_name}</h3>
                        <span className="text-xs text-slate-500">({req.department} - {req.job_title})</span>

                        {/* Distinction of who submitted the request: Manager vs Worker */}
                        {req.submitted_by && (req.submitted_by.includes('مدير') || req.on_behalf_of > 0) ? (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 bg-amber-400 text-slate-950 rounded-lg border border-amber-500 flex items-center gap-1 shadow-xs">
                            <Building2 className="w-3.5 h-3.5" />
                            <span>مقدم بواسطة مدير المخازن (نيابة عن العامل)</span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-lg border border-blue-200 flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>مقدم من العامل مباشرة</span>
                          </span>
                        )}

                        {req.request_type === 'deduction' && (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 bg-rose-100 text-rose-800 rounded-lg border border-rose-200">
                            طلب خصم / جزاء
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-bold text-slate-800">{req.title}</p>
                      
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-0.5">
                        <span>التاريخ: <strong className="text-slate-700 font-mono">{req.date_from || '-'}</strong></span>
                        {req.date_to && req.date_to !== req.date_from && (
                          <span>إلى: <strong className="text-slate-700 font-mono">{req.date_to}</strong></span>
                        )}
                        <span>المقدار: <strong className={req.request_type === 'deduction' ? 'text-rose-700 font-bold font-mono' : 'text-blue-700 font-mono'}>{req.quantity} {req.request_type === 'leave' || req.request_type === 'deduction' ? 'يوم' : 'ساعة'}</strong></span>
                        <span className="text-[11px] text-slate-400">تاريخ الطلب: {req.created_at ? req.created_at.split(' ')[0] : ''}</span>
                      </div>

                      {req.details && (
                        <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-1">
                          {req.details}
                        </p>
                      )}

                      {/* Approval Workflow Stepper indicator */}
                      <div className="flex items-center gap-2 pt-2 text-[11px]">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          req.manager_status === 'approved' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : isManagerStage 
                            ? 'bg-amber-100 text-amber-800 animate-pulse' 
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          المرحلة 1: موافقة مدير المخزن {req.manager_status === 'approved' ? '✓' : ''}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          isApproved 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : isAdminStage 
                            ? 'bg-blue-100 text-blue-800 animate-pulse' 
                            : isRejected 
                            ? 'bg-rose-100 text-rose-800' 
                            : 'bg-slate-100 text-slate-400'
                        }`}>
                          المرحلة 2: اعتماد الإدارة العامة {isApproved ? '✓' : isRejected ? '✕' : ''}
                        </span>
                      </div>

                      {req.manager_notes && (
                        <p className="text-[11px] text-amber-900 bg-amber-50/70 px-2 py-1 rounded border border-amber-200 inline-block mt-1">
                          ملاحظات مدير المخزن: {req.manager_notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions based on View Mode and Request Stage */}
                  <div className="flex items-center gap-2 sm:self-center shrink-0">
                    {/* Stage 1: Warehouse Manager Action */}
                    {isManagerStage && (
                      viewMode === 'manager' || viewMode === 'admin' ? (
                        <>
                          <button
                            onClick={() => handleManagerAction(req.id, 'approved')}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl shadow-xs transition-all"
                            title="موافقة مدير المخزن وتمريره للإدارة العامة"
                          >
                            <Check className="w-4 h-4" />
                            <span>موافقة مدير المخزن</span>
                          </button>

                          <button
                            onClick={() => handleManagerAction(req.id, 'rejected')}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition-all"
                          >
                            <X className="w-4 h-4" />
                            <span>رفض</span>
                          </button>
                        </>
                      ) : (
                        <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                          في انتظار موافقة مدير المخزن
                        </span>
                      )
                    )}

                    {/* Stage 2: Admin Final Action */}
                    {isAdminStage && (
                      viewMode === 'admin' ? (
                        <>
                          <button
                            onClick={() => handleAdminAction(req.id, 'approved')}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                          >
                            <Check className="w-4 h-4" />
                            <span>اعتماد نهائي</span>
                          </button>

                          <button
                            onClick={() => handleAdminAction(req.id, 'rejected')}
                            className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition-all"
                          >
                            <X className="w-4 h-4" />
                            <span>رفض</span>
                          </button>
                        </>
                      ) : (
                        <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200">
                          تمت موافقة المخزن — في انتظار الإدارة
                        </span>
                      )
                    )}

                    {/* Final Status Badges */}
                    {isApproved && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        معتمد نهائياً
                      </span>
                    )}

                    {isRejected && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-800 text-xs font-bold rounded-xl border border-rose-200">
                        <XCircle className="w-4 h-4 text-rose-600" />
                        مرفوض
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Submit On Behalf of Worker by Warehouse Manager */}
      {showOnBehalfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-amber-50/60">
              <div className="flex items-center gap-2 text-amber-900 font-bold">
                <UserPlus className="w-5 h-5 text-amber-600" />
                <h3 className="text-base">تقديم طلب نيابة عن سائق أو عامل مخزن</h3>
              </div>
              <button
                onClick={() => setShowOnBehalfModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOnBehalfSubmit} className="p-6 space-y-4 text-xs">
              <div className="bg-amber-50 text-amber-900 p-3 rounded-xl border border-amber-200 leading-relaxed">
                يقوم مدير المخزن هنا بتسجيل طلب نيابة عن العامل أو السائق غير المتاح لديه هاتف ذكي، ويمر الطلب مباشرة بموافقة مدير المخزن إلى الإدارة للاعتماد.
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">اختر الموظف / السائق / العامل *</label>
                <select
                  required
                  value={onBehalfForm.employee_id}
                  onChange={(e) => setOnBehalfForm({ ...onBehalfForm, employee_id: e.target.value })}
                  className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.code} - {emp.name} ({emp.department} - {emp.job_title})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">نوع الطلب *</label>
                  <select
                    value={onBehalfForm.request_type}
                    onChange={(e) => setOnBehalfForm({ ...onBehalfForm, request_type: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="leave">إجازة سنوية</option>
                    <option value="overtime">احتساب أجر إضافي</option>
                    <option value="deduction">احتساب خصم / غياب جزئي</option>
                    <option value="loan">طلب سلفة مالية</option>
                    <option value="inquiry">إذن أو عذر غياب</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    {onBehalfForm.request_type === 'leave' ? 'عدد الأيام' : 'المقدار (أيام / ساعات)'}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    value={onBehalfForm.quantity}
                    onChange={(e) => setOnBehalfForm({ ...onBehalfForm, quantity: Number(e.target.value) })}
                    className="w-full py-2 px-3 font-mono border border-slate-200 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">عنوان الطلب / الموضوع *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: إجازة سنوية لظرف عائلي أو إضافي مأمورية الإسكندرية"
                  value={onBehalfForm.title}
                  onChange={(e) => setOnBehalfForm({ ...onBehalfForm, title: e.target.value })}
                  className="w-full py-2 px-3 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">من تاريخ</label>
                  <input
                    type="date"
                    required
                    value={onBehalfForm.date_from}
                    onChange={(e) => setOnBehalfForm({ ...onBehalfForm, date_from: e.target.value })}
                    className="w-full py-2 px-3 font-mono border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">إلى تاريخ</label>
                  <input
                    type="date"
                    required
                    value={onBehalfForm.date_to}
                    onChange={(e) => setOnBehalfForm({ ...onBehalfForm, date_to: e.target.value })}
                    className="w-full py-2 px-3 font-mono border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">تفاصيل ومبررات الطلب</label>
                <textarea
                  rows={2}
                  placeholder="اكتب تفاصيل إضافية أو توصية مدير المخزن..."
                  value={onBehalfForm.details}
                  onChange={(e) => setOnBehalfForm({ ...onBehalfForm, details: e.target.value })}
                  className="w-full py-2 px-3 border border-slate-200 rounded-xl resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowOnBehalfModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingOnBehalf}
                  className="flex items-center gap-1.5 px-5 py-2 font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-xl shadow-xs transition-colors"
                >
                  {submittingOnBehalf ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>رفع الطلب واعتماده مبدئياً للإدارة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
