import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const vbsPath = path.join(rootDir, 'scripts', 'run-silent.vbs');
const htmlFile = path.join(rootDir, 'logs', 'install-success.html');

console.log('======================================================================');
console.log('   Payroll ERP - Automated Biometric Sync Installation');
console.log('======================================================================\n');

console.log('[1/2] Setting up Windows Scheduled Task (Runs every 15 minutes)...');

const taskName = 'PayrollERP_BiometricSync';
let success = false;

try {
  try { execSync(`schtasks /delete /tn "${taskName}" /f 2>nul`); } catch (e) {}
  execSync(`schtasks /create /tn "${taskName}" /tr "wscript.exe \\"${vbsPath}\\"" /sc minute /mo 15 /f`);
  success = true;
} catch (err) {
  console.error('\n[X] Failed to create scheduled task.');
  console.error('    Please right-click the file and select "Run as administrator".');
  console.error('    Error:', err.message);
}

if (success) {
  console.log('✓ Scheduled task created successfully.\n');
  console.log('[2/2] Triggering first background sync test...');
  try {
    execSync(`schtasks /run /tn "${taskName}" 2>nul`);
    console.log('✓ First sync cycle started in background.\n');
  } catch (e) {}

  console.log('======================================================================');
  console.log(' [OK] Service Installed Successfully!');
  console.log(' - Runs silently in the background every 15 minutes.');
  console.log(' - Syncs: Office Machine (192.168.1.66) & Factory Machine (81.10.115.81).');
  console.log(' - Uploads to Supabase Cloud & updates Web App 24/7.');
  console.log(' - Cloud URL: https://company-payroll-erp-2026.web.app');
  console.log('======================================================================\n');

  // Generate beautiful Arabic HTML confirmation
  const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>تم تثبيت المزامنة الآلية بنجاح</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px 20px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 24px; padding: 35px; max-width: 650px; margin: 0 auto; box-shadow: 0 20px 40px rgba(0,0,0,0.5); text-align: center; }
    .icon { width: 70px; height: 70px; background: rgba(16, 185, 129, 0.15); border: 2px solid #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 36px; }
    h1 { color: #10b981; margin: 0 0 10px; font-size: 24px; }
    p { color: #94a3b8; font-size: 14px; margin-bottom: 25px; line-height: 1.6; }
    .features { background: #0f172a; border: 1px solid #334155; border-radius: 16px; padding: 20px; text-align: right; margin-bottom: 25px; }
    .item { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; font-size: 13.5px; color: #e2e8f0; }
    .item:last-child { margin-bottom: 0; }
    .check { color: #10b981; font-weight: bold; font-size: 16px; }
    .btn { display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 14px 30px; border-radius: 12px; font-weight: bold; font-size: 15px; transition: 0.2s; box-shadow: 0 4px 15px rgba(37,99,235,0.4); }
    .btn:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h1>تم تثبيت خدمة المزامنة الآلية بنجاح!</h1>
    <p>تم تسجيل المهمة بنجاح داخل نظام ويندوز، وستعمل الآن في الخلفية دون الحاجة لفتح أي شاشات أو لمس أي ملفات.</p>
    
    <div class="features">
      <div class="item">
        <span class="check">✓</span>
        <span><strong>تعمل آلياً كل 15 دقيقة:</strong> تسحب أحدث الحركات وتغذي قاعدة البيانات السحابية.</span>
      </div>
      <div class="item">
        <span class="check">✓</span>
        <span><strong>تغطية شاملة للماكينات:</strong> ماكينة الإدارة (192.168.1.66) وماكينة المصنع (81.10.115.81).</span>
      </div>
      <div class="item">
        <span class="check">✓</span>
        <span><strong>صامتة 100%:</strong> تعمل في الخلفية بدون شاشات سوداء وبدون مقاطعة عملك على الجهاز.</span>
      </div>
      <div class="item">
        <span class="check">✓</span>
        <span><strong>تحديث سحابي فوري:</strong> الحركات تصبح متاحة على الموقع من الموبايل أو أي كمبيوتر 24/7.</span>
      </div>
    </div>

    <a href="https://company-payroll-erp-2026.web.app" target="_blank" class="btn">
      🌐 فتح موقع الحضور السحابي
    </a>
  </div>
</body>
</html>`;

  try {
    fs.writeFileSync(htmlFile, htmlContent, 'utf8');
    const startCmd = process.platform === 'win32' ? 'start' : 'open';
    execSync(`${startCmd} "" "${htmlFile}"`);
  } catch (e) {}
}
