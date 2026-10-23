export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    status: 'online',
    appName: 'نظام إدارة المرتبات وشؤون العاملين | Payroll ERP',
    time: new Date().toISOString()
  });
}
