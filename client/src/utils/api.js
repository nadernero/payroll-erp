// Base API Helper - Auto-detects environment (Local vs Cloud 24/7 API)
const isLocal = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.') ||
  window.location.hostname.startsWith('172.')
);

// Cloud API Endpoint (Hosted 24/7 on Vercel with Supabase persistence)
export const CLOUD_API_BASE = 'https://payroll-erp-rho.vercel.app/api';

export const API_BASE = isLocal 
  ? '/api' 
  : CLOUD_API_BASE;

export async function fetchJson(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;

  let res;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
  } catch (netErr) {
    console.error(`[API Network Error] ${url}:`, netErr);
    throw new Error('تعذر الاتصال بالسيرفر السحابي، يرجى التحقق من اتصال الإنترنت.');
  }

  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  // If response is HTML (e.g. Firebase rewrite or Vercel SPA fallback), auto-heal by calling Cloud API directly
  if (!contentType.includes('application/json') && (text.trim().startsWith('<!doctype') || text.trim().startsWith('<html'))) {
    if (!url.startsWith(CLOUD_API_BASE)) {
      console.warn(`[API Auto-Heal] Retrying directly against Cloud API: ${CLOUD_API_BASE}${endpoint}`);
      try {
        const retryRes = await fetch(`${CLOUD_API_BASE}${endpoint}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
          }
        });
        const retryText = await retryRes.text();
        return JSON.parse(retryText);
      } catch (retryErr) {
        console.error('[API Auto-Heal Failed]:', retryErr);
      }
    }
    throw new Error('استجابة غير صالحة من السيرفر السحابي، يرجى تحديث الصفحة.');
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (parseErr) {
    console.error(`[API JSON Parse Error] ${url}:`, text.substring(0, 200));
    throw new Error('حدث خطأ في معالجة بيانات السيرفر.');
  }

  if (!res.ok) {
    const errMsg = data?.error || 'حدث خطأ في الخادم';
    throw new Error(errMsg);
  }

  return data;
}

export async function uploadFile(endpoint, file) {
  const formData = new FormData();
  formData.append('file', file);

  const url = `${API_BASE}${endpoint}`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      body: formData
    });
  } catch (e) {
    throw new Error('تعذر رفع الملف، يرجى التحقق من الاتصال.');
  }

  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('فشل رفع الملف: استجابة غير صالحة');
  }

  if (!res.ok) {
    throw new Error(data.error || 'فشل رفع الملف');
  }

  return data;
}
