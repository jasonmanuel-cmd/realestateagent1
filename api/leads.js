/**
 * Read-only leads feed for the dashboard (index.html). Merges
 * Parcels_Snapshot (current attributes: acreage/zoning/status) with
 * Parcels_Seen (FirstSeenDate/LastSeenDate) by APN, sorted newest-first, so
 * "leads that came in" reads as a feed rather than a raw table dump.
 * Permits and email-alert listings aren't included yet -- both collectors
 * are still stubs returning [], so there's nothing real to show for them;
 * add sections here once src/permits.js and src/emailAlerts.js are finished.
 */
module.exports = async (req, res) => {
  const { isValidSession } = require('../src/session');
  if (!isValidSession(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { getAuthenticatedClientFromEnv } = require('../src/auth');
    const sheetsApi = require('../src/sheets');
    const config = require('../src/config');

    const auth = getAuthenticatedClientFromEnv();

    const [snapshot, seen] = await Promise.all([
      sheetsApi.getValues(auth, config.SPREADSHEET_ID, config.SHEET_NAMES.PARCELS_SNAPSHOT),
      sheetsApi.getValues(auth, config.SPREADSHEET_ID, config.SHEET_NAMES.PARCELS_SEEN)
    ]);

    const seenByApn = new Map();
    seen.slice(1).forEach((row) => {
      seenByApn.set(row[0], { firstSeenDate: row[1] || null, lastSeenDate: row[2] || null });
    });

    const leads = snapshot.slice(1)
      .filter((row) => row[0] && row[0] !== 'UNVERIFIED')
      .map((row) => {
        const seenInfo = seenByApn.get(row[0]) || { firstSeenDate: null, lastSeenDate: null };
        return {
          apn: row[0],
          acreage: row[1],
          zoning: row[2],
          status: row[3],
          pulledDate: row[5] || null,
          firstSeenDate: seenInfo.firstSeenDate,
          lastSeenDate: seenInfo.lastSeenDate
        };
      })
      .sort((a, b) => (b.firstSeenDate || '').localeCompare(a.firstSeenDate || ''));

    res.status(200).json({ leads, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Fatal error in /api/leads:', err);
    res.status(500).json({ error: err.message || String(err) });
  }
};
