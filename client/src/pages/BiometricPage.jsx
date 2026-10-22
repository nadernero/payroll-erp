import React, { useState, useEffect } from 'react';
import { 
  Cpu, Wifi, PlusCircle, RefreshCw, CheckCircle2, AlertCircle, 
  Trash2, Edit2, Play, Eye, Calendar, User, Clock, ArrowRight,
  Server, Shield, Copy, Check, ExternalLink
} from 'lucide-react';
import { fetchJson } from '../utils/api';

export default function BiometricPage() {
  const [devices, setDevices] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [networkInfo, setNetworkInfo] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Testing connection state
  const [testingId, setTestingId] = useState(null);
  const [testResult, setTestResult] = useState(null);

  // Add / Edit Modal
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [deviceForm, setDeviceForm] = useState({
    name: '',
    ip: '192.168.1.201',
    port: 4370,
    protocol: 'udp',
    timeout: 5000,
    location: ''
  });

  // Sync / Pull Modal
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const currentDate = new Date();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
  const todayStr = currentDate.toISOString().split('T')[0];

  const [syncForm, setSyncForm] = useState({
    employeeCode: 'all',
    startDate: firstDayOfMonth,
    endDate: todayStr,
    ignoreDateRange: false
  });
  const [syncing, setSyncing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewLogs, setPreviewLogs] = useState(null);
  const [previewFilter, setPreviewFilter] = useState('all'); // 'all', 'registered', 'unregistered'
  const [previewStats, setPreviewStats] = useState({ registered: 0, unregistered: 0, total: 0 });
  const [syncMessage, setSyncMessage] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [devs, emps, net] = await Promise.all([
        fetchJson('/biometric/devices'),
        fetchJson('/employees'),
        fetchJson('/system/network-info').catch(() => null)
      ]);
      setDevices(devs);
      setEmployees(emps);
      if (net) setNetworkInfo(net);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTestConnection = async (dev) => {
    try {
      setTestingId(dev.id);
      setTestResult(null);
      const res = await fetchJson('/biometric/test', {
        method: 'POST',
        body: JSON.stringify({
          deviceId: dev.id,
          ip: dev.ip,
          port: dev.port,
          protocol: dev.protocol,
          timeout: dev.timeout
        })
      });
      setTestResult({ deviceId: dev.id, ...res });
    } catch (err) {
      setTestResult({
        deviceId: dev.id,
        success: false,
        message: 'خطأ أثناء اختبار الاتصال: ' + err.message
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleSaveDevice = async (e) => {
    e.preventDefault();
    try {
      if (editingDevice) {
        await fetchJson(`/biometric/devices/${editingDevice.id}`, {
          method: 'PUT',
          body: JSON.stringify(deviceForm)
        });
      } else {
        await fetchJson('/biometric/devices', {
          method: 'POST',
          body: JSON.stringify(deviceForm)
        });
      }
      setShowDeviceModal(false);
      setEditingDevice(null);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteDevice = async (id, name) => {
    if (window.confirm(`هل أنت متأكد من حذف الماكينة "${name}"؟`)) {
      try {
        await fetchJson(`/biometric/devices/${id}`, { method: 'DELETE' });
        loadData();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const handleOpenSync = (dev) => {
    setSelectedDevice(dev);
    setPreviewLogs(null);
    setSyncMessage(null);
    setShowSyncModal(true);
  };

  const handlePreviewLogs = async () => {
    if (!selectedDevice) return;
    try {
      setPreviewing(true);
      setSyncMessage(null);
      const res = await fetchJson('/biometric/preview', {
        method: 'POST',
        body: JSON.stringify({
          deviceId: selectedDevice.id,
          employeeCode: syncForm.employeeCode,
          startDate: syncForm.startDate,
          endDate: syncForm.endDate,
          ignoreDateRange: syncForm.ignoreDateRange
        })
      });
      setPreviewLogs(res.logs || []);
      setPreviewStats({
        registered: res.registeredLogsCount || 0,
        unregistered: res.unregisteredLogsCount || 0,
        total: (res.logs || []).length
      });
      setPreviewFilter('all');
      if (res.message) {
        setSyncMessage(res.message);
      }
    } catch (err) {
      alert('خطأ أثناء معاينة الحركات: ' + err.message);
    } finally {
      setPreviewing(false);
    }
  };

  const handleExecuteSync = async () => {
    if (!selectedDevice) return;
    try {
      setSyncing(true);
      setSyncMessage(null);
      const res = await fetchJson('/biometric/sync', {
        method: 'POST',
        body: JSON.stringify({
          deviceId: selectedDevice.id,
          employeeCode: syncForm.employeeCode,
          startDate: syncForm.startDate,
          endDate: syncForm.endDate,
          ignoreDateRange: syncForm.ignoreDateRange
        })
      });
      setSyncMessage(res.message);
      setPreviewLogs(null);
      loadData();
    } catch (err) {
      alert('خطأ أثناء المزامنة: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800">
              ماكينات البصمة البيومترية (ZKTeco)
            </h1>
            <p className="text-xs md:text-sm text-slate-500">
              الاتصال بماكينات ZKTeco عبر الشبكة المحلية أو IP حقيقي (Port 4370)، تجربة الاتصال، وسحب الحركات حسب الموظف والفترة الزمنية
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setEditingDevice(null);
              setDeviceForm({
                name: '',
                ip: '192.168.1.201',
                port: 4370,
                protocol: 'udp',
                timeout: 5000,
                location: ''
              });
              setShowDeviceModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            إضافة ماكينة جديدة
          </button>
        </div>
      </div>

      {/* Network Access Pill Card */}
      {networkInfo && (
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-4 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 text-blue-300 rounded-xl">
              <Wifi className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <span className="text-xs font-bold text-blue-200 block">
                الاتصال بالبرنامج من كمبيوتر آخر أو موبايل على نفس الشبكة:
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <code className="text-sm font-mono text-emerald-300 font-bold bg-black/30 px-2 py-0.5 rounded-lg">
                  {networkInfo.primaryLanUrl}
                </code>
                <button
                  onClick={() => copyToClipboard(networkInfo.primaryLanUrl)}
                  className="p-1 text-slate-300 hover:text-white hover:bg-white/10 rounded transition-all"
                  title="نسخ الرابط"
                >
                  {copiedUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-300 max-w-md">
            يمكنك فتح هذا الرابط من أي جهاز كمبيوتر أو هاتف متصل بنفس شبكة الراوتر (LAN / Wi-Fi) للاتصال بماكينة البصمة وتجربة النظام ومتابعة الحضور.
          </p>
        </div>
      )}

      {/* Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {devices.map((dev) => {
          const isTesting = testingId === dev.id;
          const result = testResult && testResult.deviceId === dev.id ? testResult : null;

          return (
            <div
              key={dev.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                      <Cpu className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-900 text-sm">{dev.name}</h2>
                      <span className="text-[11px] text-slate-400 block">{dev.location || 'الموقع غير محدد'}</span>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                    Port: {dev.port}
                  </span>
                </div>

                <div className="mt-4 p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">عنوان IP:</span>
                    <span className="font-bold text-slate-800">{dev.ip}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">البروتوكول:</span>
                    <span className="uppercase text-slate-700">{dev.protocol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">آخر مزامنة:</span>
                    <span className="text-slate-600">{dev.last_sync_at || 'لم تتم بعد'}</span>
                  </div>
                </div>

                {/* Test Result Message */}
                {result && (
                  <div
                    className={`mt-3 p-3 rounded-xl text-xs flex items-start gap-2 ${
                      result.success
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {result.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">{result.message}</p>
                      {result.info && (
                        <p className="text-[10px] text-emerald-700 mt-0.5 font-mono">
                          {typeof result.info === 'object' ? JSON.stringify(result.info) : result.info}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions Toolbar */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {/* Test Connection Button */}
                  <button
                    onClick={() => handleTestConnection(dev)}
                    disabled={isTesting}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-blue-600' : ''}`} />
                    {isTesting ? 'جارِ الاختبار...' : 'تجربة الاتصال'}
                  </button>

                  {/* Sync Logs Button */}
                  <button
                    onClick={() => handleOpenSync(dev)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all"
                  >
                    <Play className="w-3.5 h-3.5" />
                    سحب الحركات
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingDevice(dev);
                      setDeviceForm({
                        name: dev.name,
                        ip: dev.ip,
                        port: dev.port,
                        protocol: dev.protocol,
                        timeout: dev.timeout,
                        location: dev.location || ''
                      });
                      setShowDeviceModal(true);
                    }}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="تعديل"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteDevice(dev.id, dev.name)}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="حذف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sync / Pull Logs Modal */}
      {showSyncModal && selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  سحب حركات البصمة من: {selectedDevice.name}
                </h2>
                <span className="text-xs text-slate-500 font-mono">
                  {selectedDevice.ip}:{selectedDevice.port} ({selectedDevice.protocol.toUpperCase()})
                </span>
              </div>
              <button
                onClick={() => setShowSyncModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-sm">
              {/* Form Options */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                {/* Employee Filter */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">الموظف</label>
                  <select
                    value={syncForm.employeeCode}
                    onChange={(e) => setSyncForm({ ...syncForm, employeeCode: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="all">جميع الموظفين (~60 موظف)</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.code}>
                        {emp.code} - {emp.name} ({emp.department})
                      </option>
                    ))}
                  </select>
                </div>

                {/* From Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">من تاريخ</label>
                  <input
                    type="date"
                    value={syncForm.startDate}
                    onChange={(e) => setSyncForm({ ...syncForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>

                {/* To Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">إلى تاريخ</label>
                  <input
                    type="date"
                    disabled={syncForm.ignoreDateRange}
                    value={syncForm.endDate}
                    onChange={(e) => setSyncForm({ ...syncForm, endDate: e.target.value })}
                    className={`w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono ${syncForm.ignoreDateRange ? 'opacity-50' : ''}`}
                  />
                </div>

                {/* Ignore Date Range Checkbox */}
                <div className="col-span-1 md:col-span-3 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-blue-950 bg-blue-50/80 p-2.5 rounded-xl border border-blue-200">
                    <input
                      type="checkbox"
                      checked={syncForm.ignoreDateRange}
                      onChange={(e) => setSyncForm({ ...syncForm, ignoreDateRange: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span>سحب جميع حركات الموظف المختار من ذاكرة الماكينة (تجاهل تصفية التاريخ)</span>
                  </label>
                </div>
              </div>

              {/* Status / Diagnostic Message */}
              {syncMessage && (
                <div className={`p-3.5 rounded-xl text-xs font-bold leading-relaxed flex items-start gap-2.5 ${
                  syncMessage.includes('ولكن لا توجد') || syncMessage.includes('تنبيه') || syncMessage.includes('لم يتم')
                    ? 'bg-amber-50 text-amber-900 border border-amber-300'
                    : 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                }`}>
                  {syncMessage.includes('ولكن لا توجد') || syncMessage.includes('تنبيه') ? (
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  <span>{syncMessage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePreviewLogs}
                  disabled={previewing || syncing}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all disabled:opacity-50"
                >
                  <Eye className="w-4 h-4" />
                  {previewing ? 'جارِ قراءة الماكينة...' : 'معاينة الحركات أولاً'}
                </button>

                <button
                  type="button"
                  onClick={handleExecuteSync}
                  disabled={syncing || previewing}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'جارِ المزامنة وحفظ الحضور...' : 'مزامنة وحفظ الحضور في النظام'}
                </button>
              </div>

              {/* Preview Table & Filtering */}
              {previewLogs !== null && (
                <div className="mt-4 border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  {/* Summary Header & Stats */}
                  <div className="bg-slate-100 p-3 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-bold text-slate-800">
                        إجمالي الحركات المقروءة: {previewStats.total}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                        ✓ موظفو الشركة: {previewStats.registered} حركة (ستتم مزامنتهم)
                      </span>
                      {previewStats.unregistered > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold">
                          ✕ موظفون خارجيون: {previewStats.unregistered} حركة (سيتم استبعادهم)
                        </span>
                      )}
                    </div>

                    {/* Filter buttons */}
                    <div className="flex items-center gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setPreviewFilter('all')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                          previewFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        الكل ({previewStats.total})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewFilter('registered')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                          previewFilter === 'registered' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-slate-200'
                        }`}
                      >
                        المسجلون فقط ({previewStats.registered})
                      </button>
                      {previewStats.unregistered > 0 && (
                        <button
                          type="button"
                          onClick={() => setPreviewFilter('unregistered')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                            previewFilter === 'unregistered' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                          }`}
                        >
                          غير المسجلين ({previewStats.unregistered})
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto">
                    {previewLogs.length === 0 ? (
                      <p className="p-6 text-center text-xs text-slate-400">لا توجد حركات مسجلة في الماكينة ضمن الفترة المحددة</p>
                    ) : (
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0 z-10">
                          <tr>
                            <th className="py-2.5 px-3">كود الموظف</th>
                            <th className="py-2.5 px-3">اسم الموظف</th>
                            <th className="py-2.5 px-3">القسم</th>
                            <th className="py-2.5 px-3 text-center">التاريخ</th>
                            <th className="py-2.5 px-3 text-center">الوقت</th>
                            <th className="py-2.5 px-3 text-center">حالة المزامنة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {previewLogs
                            .filter(log => {
                              if (previewFilter === 'registered') return log.is_registered;
                              if (previewFilter === 'unregistered') return !log.is_registered;
                              return true;
                            })
                            .slice(0, 100)
                            .map((log, idx) => (
                              <tr 
                                key={idx} 
                                className={`transition-colors ${
                                  log.is_registered 
                                    ? 'hover:bg-emerald-50/40' 
                                    : 'bg-slate-50/50 hover:bg-slate-100/80 text-slate-400 opacity-80'
                                }`}
                              >
                                <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{log.employee_code}</td>
                                <td className="py-2.5 px-3 font-semibold">
                                  {log.is_registered ? (
                                    <span className="text-slate-900 font-bold">{log.employee_name}</span>
                                  ) : (
                                    <span className="text-slate-400 italic font-normal">{log.employee_name}</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">{log.department || '-'}</td>
                                <td className="py-2.5 px-3 text-center font-mono text-slate-600">{log.date}</td>
                                <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">{log.time}</td>
                                <td className="py-2.5 px-3 text-center">
                                  {log.is_registered ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      ✓ سيتم حفظه بالسيستم
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-600">
                                      ✕ سيتم تجاهله (غير مسجل)
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  {previewLogs.length > 100 && (
                    <div className="p-2 bg-slate-50 border-t border-slate-200 text-center text-[11px] text-slate-500">
                      يتم عرض أول 100 حركة في المعاينة لتسهيل التصفح السريع. عند الضغط على "مزامنة وحفظ الحضور" سيتم حفظ كافة حركات موظفي الشركة المسجلين.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Device Modal */}
      {showDeviceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">
                {editingDevice ? 'تعديل بيانات ماكينة البصمة' : 'إضافة ماكينة بصمة ZKTeco جديدة'}
              </h2>
              <button
                onClick={() => setShowDeviceModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDevice} className="p-5 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">اسم الماكينة *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: ماكينة الإدارة أو بوابة الورشة"
                  value={deviceForm.name}
                  onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">عنوان IP *</label>
                  <input
                    type="text"
                    required
                    placeholder="192.168.1.201"
                    value={deviceForm.ip}
                    onChange={(e) => setDeviceForm({ ...deviceForm, ip: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">البورت (Port)</label>
                  <input
                    type="number"
                    required
                    value={deviceForm.port}
                    onChange={(e) => setDeviceForm({ ...deviceForm, port: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">البروتوكول</label>
                  <select
                    value={deviceForm.protocol}
                    onChange={(e) => setDeviceForm({ ...deviceForm, protocol: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs uppercase"
                  >
                    <option value="udp">UDP (الأسرع والأكثر شيوعاً لـ ZKTeco)</option>
                    <option value="tcp">TCP</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">الموقع / القسم</label>
                  <input
                    type="text"
                    placeholder="مثال: البوابة الرئيسية"
                    value={deviceForm.location}
                    onChange={(e) => setDeviceForm({ ...deviceForm, location: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeviceModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs"
                >
                  حفظ الماكينة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
