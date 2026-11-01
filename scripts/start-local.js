import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync, spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.clear();
console.log('======================================================================');
console.log('           🚀 نظام إدارة المرتبات وشؤون العاملين (Payroll ERP)');
console.log('                    التشغيل المحلي على جهاز الكمبيوتر');
console.log('======================================================================\n');

// 1. Verify dependencies
let needInstall = false;
const nodeModulesDir = path.join(rootDir, 'node_modules');
if (!fs.existsSync(nodeModulesDir)) {
  needInstall = true;
} else {
  try {
    await import('express');
    await import('exceljs');
  } catch (e) {
    needInstall = true;
  }
}

if (needInstall) {
  console.log('📦 جاري استكمال مكتبات وحزم النظام لأول مرة (npm install)...');
  console.log('⏳ يرجى الانتظار دقيقة واحدة...\n');
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const res = spawnSync(npmCmd, ['install'], { cwd: rootDir, stdio: 'inherit', shell: true });
  if (res.status !== 0) {
    console.error('❌ حدث خطأ أثناء تثبيت المكتبات. يرجى مراجعة اتصال الإنترنت.');
    process.exit(1);
  }
  console.log('✅ اكتمل تثبيت المكتبات بنجاح!\n');
}

// 2. Verify client build files
const clientDistIndex = path.join(rootDir, 'client', 'dist', 'index.html');
const rootDistIndex = path.join(rootDir, 'dist', 'index.html');

if (!fs.existsSync(clientDistIndex) && !fs.existsSync(rootDistIndex)) {
  console.log('🔨 جاري بناء وتجهيز واجهة المستخدم لأول مرة (npm run build)...');
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const res = spawnSync(npmCmd, ['run', 'build'], { cwd: rootDir, stdio: 'inherit', shell: true });
  if (res.status !== 0) {
    console.warn('⚠️ تحذير: تعذر بناء الواجهة، سيتم المتابعة لتشغيل الخادم...');
  } else {
    console.log('✅ اكتمل بناء الواجهة بنجاح!\n');
  }
}

// 3. Start Server
console.log('======================================================================');
console.log('  ✅ جاري بدء تشغيل الخادم المحلي وقاعدة البيانات...');
console.log('  🌐 سيفتح المتصفح تلقائياً عند جاهزية النظام على: http://localhost:5000');
console.log('  ⚠️  تنبيه هام: اترك هذه النافذة مفتوحة طوال فترة عملك على البرنامج.');
console.log('======================================================================\n');

await import('../server/index.js');
