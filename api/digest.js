/**
 * Vercel serverless function, invoked on schedule by the `crons` entry in
 * vercel.json. Vercel attaches `Authorization: Bearer <CRON_SECRET>` to
 * cron-triggered requests when CRON_SECRET is set as a project env var --
 * checking it here stops anyone who finds this URL from triggering a real
 * run for free. See README.md "Hosting on Vercel" for full setup.
 */
const { getAuthenticatedClientFromEnv } = require('../src/auth');
const { runDailyDigest } = require('../src/digest');

module.exports = async (req, res) => {
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  try {
    const auth = getAuthenticatedClientFromEnv();
    const result = await runDailyDigest(auth);
    res.status(result.errors.length > 0 ? 207 : 200).json(result);
  } catch (err) {
    console.error('Fatal error running digest:', err);
    res.status(500).json({ error: err.message || String(err) });
  }
};
