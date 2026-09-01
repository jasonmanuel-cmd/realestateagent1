const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { createSessionCookie } = require('../src/session');

    const password = process.env.DASHBOARD_PASSWORD;
    if (!password) {
      res.status(500).json({ error: 'DASHBOARD_PASSWORD is not set on the server.' });
      return;
    }

    let body = req.body;
    // Vercel's Node runtime parses a JSON body automatically when
    // Content-Type: application/json is sent; this is a fallback for
    // runtimes/tools that hand back the raw string instead.
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body || '{}');
      } catch {
        body = {};
      }
    }

    const submitted = body && body.password;
    if (typeof submitted !== 'string' || submitted.length === 0) {
      res.status(400).json({ error: 'Missing password' });
      return;
    }

    const a = Buffer.from(submitted);
    const b = Buffer.from(password);
    const match = a.length === b.length && crypto.timingSafeEqual(a, b);

    if (!match) {
      res.status(401).json({ error: 'Incorrect password' });
      return;
    }

    res.setHeader('Set-Cookie', createSessionCookie(req));
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Fatal error in /api/login:', err);
    res.status(500).json({ error: err.message || String(err) });
  }
};
