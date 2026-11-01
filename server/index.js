import app from './app.js';
import { getNetworkAddresses } from './routes/system.js';
import { startAutoSync } from './supabaseSync.js';
import db from './db.js';
import { exec } from 'child_process';

const DEFAULT_PORT = Number(process.env.PORT) || 5000;

function startServer(port) {
  const server = app.listen(port, '0.0.0.0', () => {
    const lanAddresses = getNetworkAddresses(port);
    console.log(`=======================================================`);
    console.log(`🚀 Payroll ERP Server is running on:`);
    console.log(`👉 Local:   http://localhost:${port}`);
    lanAddresses.forEach(addr => {
      console.log(`👉 Network (${addr.interface}): ${addr.url}`);
    });
    console.log(`=======================================================`);

    // Start background live two-way sync with Supabase
    try {
      startAutoSync(db, 15);
    } catch (e) {
      console.warn('⚠️ Supabase Auto-sync warning:', e.message);
    }

    // Automatically open browser ONLY when server is 100% ready and listening
    if (process.env.AUTO_OPEN !== 'false' && process.platform === 'win32') {
      setTimeout(() => {
        exec(`start http://localhost:${port}`, (err) => {
          if (err) console.log(`👉 يرجى فتح المتصفح على الرابط: http://localhost:${port}`);
        });
      }, 500);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ المنفذ ${port} مشغول حالياً، جاري المحاولة على المنفذ البديل ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('[Server Error]:', err);
    }
  });
}

startServer(DEFAULT_PORT);
