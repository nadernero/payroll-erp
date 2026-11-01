import app from '../server/app.js';

export default function handler(req, res) {
  try {
    app(req, res);
  } catch (err) {
    console.error('[Vercel Handler Error]:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message, stack: err.stack });
    }
  }
}
