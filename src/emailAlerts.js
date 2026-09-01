/**
 * INTENTIONALLY STUBBED. The Zillow/Redfin/Realtor.com email-alert parser
 * that the original "Kern County Deal Finder" project used never existed in
 * this repo -- the repo was empty when this build started, so there was
 * nothing to port. Wire your real Gmail-parsing logic in here (the Gmail
 * API needs a `gmail.readonly` scope added to src/auth.js's SCOPES, plus
 * re-running the consent flow), or replace this with a port of your
 * existing parser if you have it saved elsewhere.
 *
 * Per the build rules: do not fabricate example listing rows here to make
 * the digest look complete. Returning [] and logging the gap is correct
 * until this is written for real.
 */
const { logError } = require('./utils');

async function collectEmailAlerts() {
  logError('collectEmailAlerts', 'Not implemented: email-alert parser was never ported to the standalone build. Returning [].');
  return [];
}

module.exports = { collectEmailAlerts };
