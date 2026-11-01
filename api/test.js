export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  const info = {
    time: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    cwd: process.cwd(),
    env: {
      VERCEL: process.env.VERCEL,
      NODE_ENV: process.env.NODE_ENV,
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
      HAS_FIREBASE_SERVICE_ACCOUNT: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      HAS_FIREBASE_SERVICE_ACCOUNT_B64: !!process.env.FIREBASE_SERVICE_ACCOUNT_B64
    }
  };

  try {
    const fs = await import('fs');
    info.cwdFiles = fs.readdirSync(process.cwd());
  } catch (e) {
    info.cwdFilesError = e.message;
  }

  try {
    const { DatabaseSync } = await import('node:sqlite');
    info.hasNodeSqlite = true;
  } catch (e) {
    info.hasNodeSqlite = false;
    info.nodeSqliteError = e.message;
  }

  try {
    const bs = await import('better-sqlite3');
    info.hasBetterSqlite = true;
  } catch (e) {
    info.hasBetterSqlite = false;
    info.betterSqliteError = e.message;
  }

  try {
    const fb = await import('firebase-admin/app');
    info.hasFirebaseAdmin = true;
  } catch (e) {
    info.hasFirebaseAdmin = false;
    info.firebaseAdminError = e.message;
  }

  try {
    const dbModule = await import('../server/db.js');
    info.dbLoaded = true;
  } catch (e) {
    info.dbLoaded = false;
    info.dbError = e.message;
    info.dbStack = e.stack;
  }

  try {
    const appModule = await import('../server/app.js');
    info.appLoaded = true;
  } catch (e) {
    info.appLoaded = false;
    info.appError = e.message;
    info.appStack = e.stack;
  }

  res.status(200).json(info);
}
