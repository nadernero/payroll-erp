async function check() {
  const res = await fetch('https://company-payroll-erp-2026.web.app');
  const text = await res.text();
  const lines = text.split('\n').filter(l => l.includes('script type'));
  console.log('Live Firebase script line:', lines);

  // Also check if index-BQiykdsd.js is accessible on Firebase
  const jsRes = await fetch('https://company-payroll-erp-2026.web.app/assets/index-BQiykdsd.js');
  console.log('index-BQiykdsd.js HTTP status:', jsRes.status);
}

check().catch(console.error);
