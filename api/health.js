export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    status: 'online',
    appName: 'نظام إدارة المرتبات وشؤون العاملين | Payroll ERP',
    node: process.version,
    platform: process.platform,
    time: new Date().toISOString()
  });
}
