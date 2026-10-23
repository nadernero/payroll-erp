import app from './app.js';
import { getNetworkAddresses } from './routes/system.js';
import { startAutoSync } from './supabaseSync.js';
import db from './db.js';

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  const lanAddresses = getNetworkAddresses(PORT);
  console.log(`=======================================================`);
  console.log(`🚀 Payroll ERP Server is running on:`);
  console.log(`👉 Local:   http://localhost:${PORT}`);
  lanAddresses.forEach(addr => {
    console.log(`👉 Network (${addr.interface}): ${addr.url}`);
  });
  console.log(`=======================================================`);

  // Start background live two-way sync with Supabase
  startAutoSync(db, 15);
});
