/**
 * Runs all three collectors, diffs what's new, emails a digest, and logs the
 * run to Digest_Log. Each collector is wrapped in its own try/catch so a
 * failure in one (e.g. permits) never blocks the others, and every failure
 * is pushed into `errors` -- which both shows up in the email body and gets
 * written to Digest_Log's Errors column. A collector returning an empty
 * array because it errored must never be indistinguishable from it
 * returning an empty array because there was genuinely nothing new; the
 * errors list is what keeps those two cases apart.
 */
function runDailyDigest() {
  ensureDigestSheetsExist();

  var errors = [];
  var newParcels = [], newPermits = [], newListings = [];

  try {
    collectParcelData();
    newParcels = diffParcels();
  } catch (err) {
    errors.push('Parcels: ' + err.toString());
  }

  try {
    newPermits = collectPermitData();
  } catch (err) {
    errors.push('Permits: ' + err.toString());
  }

  try {
    // Existing email-alert parser from the base Kern County Deal Finder
    // project -- not defined in this extension. Confirm its return shape
    // (an array of row-arrays, each joinable with ' | ') matches what
    // buildDigestBody() below expects.
    newListings = collectEmailAlerts();
  } catch (err) {
    errors.push('Listings: ' + err.toString());
  }

  var totalNew = newParcels.length + newPermits.length + newListings.length;
  var body = buildDigestBody(newParcels, newPermits, newListings, errors);

  MailApp.sendEmail({
    to: Session.getActiveUser().getEmail(),
    subject: totalNew === 0
      ? 'Golden Valley Digest -- No new items (' + formatDate_(new Date()) + ')'
      : 'Golden Valley Digest -- ' + totalNew + ' new item(s) (' + formatDate_(new Date()) + ')',
    body: body
  });

  logDigestRun_(newParcels.length, newPermits.length, newListings.length, errors);
}

function buildDigestBody(parcels, permits, listings, errors) {
  var body = '';

  if (parcels.length === 0 && permits.length === 0 && listings.length === 0) {
    body += 'No new listings, parcels, or permits since the last run.\n\n';
  } else {
    if (parcels.length > 0) {
      body += 'NEW VACANT LAND (' + parcels.length + '):\n';
      parcels.forEach(function (p) {
        body += '- APN ' + p[0] + ' | Acreage: ' + p[1] + ' | Zoning: ' + p[2] + ' | Status: ' + p[3] + '\n';
      });
      body += '\n';
    }
    if (permits.length > 0) {
      body += 'NEW PERMITS (' + permits.length + '):\n';
      permits.forEach(function (p) { body += '- ' + p.join(' | ') + '\n'; });
      body += '\n';
    }
    if (listings.length > 0) {
      body += 'NEW LISTINGS (' + listings.length + '):\n';
      listings.forEach(function (l) { body += '- ' + l.join(' | ') + '\n'; });
      body += '\n';
    }
  }

  if (!CONFIG.PARCEL_REFRESH_CADENCE_CONFIRMED) {
    body += 'NOTE: The Kern County vacant-parcels layer\'s refresh cadence has not been ' +
      'confirmed yet (run inspectParcelSchema() and check editFieldsInfo, or ask County ' +
      'GIS directly). "New" parcels above are new relative to this tool\'s last successful ' +
      'pull, not necessarily new since yesterday.\n\n';
  }

  if (errors.length > 0) {
    body += 'COLLECTOR ERRORS (data below may be incomplete):\n';
    errors.forEach(function (e) { body += '- ' + e + '\n'; });
  }

  return body;
}

function logDigestRun_(parcelCount, permitCount, listingCount, errors) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEET_NAMES.DIGEST_LOG);
  sheet.appendRow([new Date(), parcelCount, permitCount, listingCount, errors.length === 0, errors.join('; ')]);
}
