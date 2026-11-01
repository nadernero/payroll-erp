export default async function handler(req, res) {
  const info = { time: new Date().toISOString() };
  try {
    info.node = process.version;
    info.platform = process.platform;
    info.cwd = process.cwd();
  } catch (e) {
    info.basicError = e.message;
  }
  try {
    const fs = await import('fs');
    info.filesInCwd = fs.readdirSync(process.cwd());
  } catch (e) {
    info.fsError = e.message;
  }
  try {
    const app = await import('../server/app.js');
    info.appLoaded = true;
  } catch (e) {
    info.appError = e.message;
    info.appStack = e.stack;
  }
  res.status(200).json(info);
}
