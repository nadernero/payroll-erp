import app from '../server/app.js';

export default async function handler(req, res) {
  try {
    return app(req, res);
  } catch (e) {
    console.error('[Vercel Serverless Handler Error]:', e);
    return res.status(500).json({ error: e.message, stack: e.stack });
  }
}
