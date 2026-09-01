module.exports = async (req, res) => {
  const { clearSessionCookie } = require('../src/session');
  res.setHeader('Set-Cookie', clearSessionCookie(req));
  res.status(200).json({ ok: true });
};
