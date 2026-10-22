import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

console.log('========================================================================');
console.log('🚀 تشغيل رابط Cloudflare Tunnel المشفر لنظام Payroll ERP');
console.log('========================================================================\n');

// 1. Check if Node server on port 5000 is running
function checkServer(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  const isRunning = await checkServer(5000);
  if (!isRunning) {
    console.log('⏳ جاري تشغيل سيرفر النظام على المنفذ 5000...');
    const serverProc = spawn('node', ['server/index.js'], {
      cwd: rootDir,
      stdio: 'inherit',
      detached: true
    });
    serverProc.unref();

    // Wait for server to be responsive
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 1000));
      if (await checkServer(5000)) {
        console.log('✓ تم تشغيل سيرفر النظام بنجاح.\n');
        break;
      }
    }
  } else {
    console.log('✓ سيرفر النظام يعمل بالفعل وجاهز.\n');
  }

  // 2. Check cloudflared.exe
  const cloudflaredPath = path.join(rootDir, 'cloudflared.exe');
  if (!fs.existsSync(cloudflaredPath)) {
    console.error('❌ ملف cloudflared.exe غير موجود في مجلد المشروع!');
    return;
  }

  // Kill any existing cloudflared to avoid conflicts
  try {
    execSync('taskkill /F /IM cloudflared.exe /T 2>nul');
  } catch (e) {}

  console.log('🌐 جاري الاتصال بشبكة Cloudflare العالمية وتوليد الرابط الآمن...');
  console.log('------------------------------------------------------------------------');

  const tunnel = spawn(cloudflaredPath, ['tunnel', '--url', 'http://localhost:5000'], {
    cwd: rootDir
  });

  let tunnelUrl = null;

  const handleOutput = (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match && !tunnelUrl) {
      tunnelUrl = match[0];
      console.log('\n========================================================================');
      console.log('🎉 تم توليد الرابط السحابي بنجاح 100%! يعمل الآن من أي مكان بالعالم:');
      console.log('========================================================================\n');
      console.log(`👉 👑 رابط لوحة الإدارة والحسابات:`);
      console.log(`   ${tunnelUrl}\n`);
      console.log(`👉 📱 رابط بوابة الموظف (طلب إجازات / سلف):`);
      console.log(`   ${tunnelUrl}/portal\n`);
      console.log(`👉 🏢 رابط بوابة مدير المخازن والفروع:`);
      console.log(`   ${tunnelUrl}/warehouse-portal\n`);
      console.log('------------------------------------------------------------------------');
      console.log('💡 اترك هذه النافذة مفتوحة طالما تريد إتاحة الرابط للموظفين والفروع.');
      console.log('========================================================================\n');

      // Try opening in browser
      try {
        const startCmd = process.platform === 'win32' ? 'start' : 'open';
        execSync(`${startCmd} ${tunnelUrl}`);
      } catch (err) {}
    }
  };

  tunnel.stdout.on('data', handleOutput);
  tunnel.stderr.on('data', handleOutput);

  tunnel.on('close', (code) => {
    console.log(`\nتم إغلاق النفق (رمز: ${code})`);
  });
}

main().catch(console.error);
