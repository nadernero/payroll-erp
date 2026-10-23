// Base API Helper - Auto-detects environment (Local, Vercel, or Google Firebase)
const isFirebase = typeof window !== 'undefined' && (
  window.location.hostname.includes('.web.app') ||
  window.location.hostname.includes('.firebaseapp.com')
);

const API_BASE = isFirebase 
  ? 'https://payroll-erp-rho.vercel.app/api'
  : '/api';

export async function fetchJson(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (!res.ok) {
    let errMsg = 'حدث خطأ في الاتصال بالخادم';
    try {
      const data = await res.json();
      errMsg = data.error || errMsg;
    } catch (e) {
      // ignore
    }
    throw new Error(errMsg);
  }

  return res.json();
}

export async function uploadFile(endpoint, file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    let errMsg = 'فشل رفع الملف';
    try {
      const data = await res.json();
      errMsg = data.error || errMsg;
    } catch (e) {
      // ignore
    }
    throw new Error(errMsg);
  }

  return res.json();
}
