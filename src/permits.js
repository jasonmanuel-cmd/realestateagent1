/**
 * Permit collector against Kern County's Accela Citizen Access portal.
 *
 * INTENTIONALLY UNFINISHED -- see build spec Step 5. Accela's Building
 * module search is an ASP.NET postback form with no confirmed JSON API.
 * Finishing it requires:
 *   1. Inspecting the live rendered form at
 *      https://aca-prod.accela.com/KERNCO/Cap/CapHome.aspx?module=Building
 *      (view-source / browser devtools) to capture the real search-form
 *      field names and the results-table markup.
 *   2. Extracting the __VIEWSTATE / __EVENTVALIDATION hidden fields from the
 *      GET response and POSTing a date-range search with them.
 *   3. Parsing the results table into
 *      [RecordNumber, APN_or_Address, PermitType, Status] rows, then diffing
 *      those against Permits_Seen the same way diffParcels() does for
 *      parcels (append new RecordNumbers with FirstSeenDate).
 *
 * That has to be done by hand against the live portal. Do not fabricate
 * permit rows here to make the digest look complete -- returning [] and
 * logging the gap is correct until this is finished for real.
 */
const config = require('./config');
const { logError } = require('./utils');

async function collectPermitData() {
  try {
    const res = await fetch(config.PERMITS_SEARCH_URL);

    if (!res.ok) {
      logError('collectPermitData', `HTTP ${res.status}`);
      return [];
    }

    // TODO: extract __VIEWSTATE / __EVENTVALIDATION from the response body,
    // POST a today's-date search with them, parse the results table, and
    // diff against Permits_Seen. See header comment above.
    logError('collectPermitData', 'Not implemented: Accela form POST + parse must be built by hand against the live portal (spec Step 5).');
    return [];
  } catch (err) {
    logError('collectPermitData', err.toString());
    return [];
  }
}

module.exports = { collectPermitData };
