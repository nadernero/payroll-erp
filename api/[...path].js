import app, { ensureAttendanceFresh } from '../server/app.js';

export default async function handler(req, res) {
  try {
    if (ensureAttendanceFresh) {
      await ensureAttendanceFresh();
    }
  } catch (e) {
    console.warn('ensureAttendanceFresh notice:', e.message);
  }
  return app(req, res);
}
