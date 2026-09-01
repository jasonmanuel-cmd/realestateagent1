/**
 * Minimal signed-cookie session for the single-password leads dashboard.
 * No session store needed: the cookie itself carries an expiry timestamp
 * plus an HMAC (keyed by SESSION_SECRET) proving it was issued by this
 * server, so validating a session doesn't need to hit the database/sheet.
 */
const crypto = require('crypto');

const COOKIE_NAME = 'session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function requireSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('Missing required env var SESSION_SECRET. Set a long random string in Vercel env vars.');
  }
  return secret;
}

function sign(value) {
  return crypto.createHmac('sha256', requireSecret()).update(value).digest('hex');
}

function cookieAttrs(req, extra) {
  const isHttps = req.headers['x-forwarded-proto'] === 'https' || !!process.env.VERCEL;
  const attrs = [extra, 'HttpOnly', 'Path=/', 'SameSite=Lax'];
  if (isHttps) attrs.push('Secure');
  return attrs;
}

function createSessionCookie(req) {
  const expiry = String(Date.now() + SESSION_TTL_SECONDS * 1000);
  const token = `${expiry}.${sign(expiry)}`;
  return cookieAttrs(req, `${COOKIE_NAME}=${token}; Max-Age=${SESSION_TTL_SECONDS}`).join('; ');
}

function clearSessionCookie(req) {
  return cookieAttrs(req, `${COOKIE_NAME}=; Max-Age=0`).join('; ');
}

function parseCookies(req) {
  const header = req.headers['cookie'];
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    cookies[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  });
  return cookies;
}

function isValidSession(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return false;

  const [value, sig] = token.split('.');
  if (!value || !sig) return false;

  let expectedSig;
  try {
    expectedSig = sign(value);
  } catch {
    return false; // SESSION_SECRET missing -- fail closed, not open
  }

  const sigBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return false;
  }

  const expiry = Number(value);
  return Number.isFinite(expiry) && expiry >= Date.now();
}

module.exports = { createSessionCookie, clearSessionCookie, isValidSession, COOKIE_NAME };
