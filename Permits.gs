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
 * That has to be done by hand against the live portal -- it can't be
 * guessed from this codebase, and this build session's network policy
 * blocks reaching aca-prod.accela.com to even inspect it. Per the spec:
 * do not fabricate permit rows here to make the digest look complete.
 * Returning [] and logging the gap is the correct behavior until this is
 * finished for real.
 */

function collectPermitData() {
  try {
    var response = UrlFetchApp.fetch(CONFIG.PERMITS_SEARCH_URL, { muteHttpExceptions: true });

    if (response.getResponseCode() !== 200) {
      logError_('collectPermitData', 'HTTP ' + response.getResponseCode());
      return [];
    }

    // TODO: extract __VIEWSTATE / __EVENTVALIDATION from response.getContentText(),
    // POST a today's-date search with them, parse the results table, and diff
    // against Permits_Seen. See header comment above.
    logError_('collectPermitData', 'Not implemented: Accela form POST + parse must be built by hand against the live portal (spec Step 5).');
    return [];
  } catch (err) {
    logError_('collectPermitData', err.toString());
    return [];
  }
}
