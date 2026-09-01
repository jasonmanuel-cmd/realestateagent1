/**
 * Vercel serverless function, invoked on schedule by the `crons` entry in
 * vercel.json. Vercel attaches `Authorization: Bearer <CRON_SECRET>` to
 * cron-triggered requests when CRON_SECRET is set as a project env var --
 * checking it here stops anyone who finds this URL from triggering a real
 * run for free. See README.md "Hosting on Vercel" for full setup.
 */
module.exports = async (req, res) => {
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  } else {
    console.warn('CRON_SECRET is not set -- this endpoint has no auth barrier. Set it in Vercel env vars.');
  }

  try {
    // Required inside the handler, not at module top level: src/config.js
    // throws at require-time if a required env var (e.g. SPREADSHEET_ID) is
    // missing. Requiring it outside this try/catch would crash the whole
    // function invocation (Vercel's opaque FUNCTION_INVOCATION_FAILED) before
    // we get a chance to turn that into a readable JSON error.
    const { getAuthenticatedClientFromEnv } = require('../src/auth');
    const { runDailyDigest } = require('../src/digest');

    const auth = getAuthenticatedClientFromEnv();
    const result = await runDailyDigest(auth);
    res.status(result.errors.length > 0 ? 207 : 200).json(result);
  } catch (err) {
    console.error('Fatal error running digest:', err);
    // Message only, never err.stack -- this can be reached by anyone if
    // CRON_SECRET isn't set, and a stack trace shouldn't leak to them.
    res.status(500).json({ error: err.message || String(err) });
  }
};
