/**
 * Runs all three collectors, diffs what's new, emails a digest, and logs the
 * run to Digest_Log. Each collector (and the email send itself) is wrapped
 * in its own try/catch so a failure in one never blocks the others, and
 * every failure lands in `errors` -- which both shows up in the email body
 * and gets written to Digest_Log's Errors column. A collector returning an
 * empty array because it errored must never be indistinguishable from it
 * returning an empty array because there was genuinely nothing new; the
 * errors list is what keeps those two cases apart.
 */
const nodemailer = require('nodemailer');
const config = require('./config');
const { formatDate } = require('./utils');
const { collectParcelData, writeParcelSnapshot, diffParcels } = require('./parcels');
const { collectPermitData } = require('./permits');
const { collectEmailAlerts } = require('./emailAlerts');
const { ensureDigestSheetsExist } = require('./sheetSetup');
const sheetsApi = require('./sheets');

async function runDailyDigest() {
  await ensureDigestSheetsExist();

  const errors = [];
  let newParcels = [];
  let newPermits = [];
  let newListings = [];

  try {
    const features = await collectParcelData();
    await writeParcelSnapshot(features);
    newParcels = await diffParcels();
  } catch (err) {
    errors.push(`Parcels: ${err.message || err}`);
  }

  try {
    newPermits = await collectPermitData();
  } catch (err) {
    errors.push(`Permits: ${err.message || err}`);
  }

  try {
    newListings = await collectEmailAlerts();
  } catch (err) {
    errors.push(`Listings: ${err.message || err}`);
  }

  const totalNew = newParcels.length + newPermits.length + newListings.length;
  const body = buildDigestBody(newParcels, newPermits, newListings, errors);
  const subject = totalNew === 0
    ? `Golden Valley Digest -- No new items (${formatDate(new Date())})`
    : `Golden Valley Digest -- ${totalNew} new item(s) (${formatDate(new Date())})`;

  let emailSent = false;
  try {
    await sendDigestEmail(subject, body);
    emailSent = true;
  } catch (err) {
    errors.push(`Email send: ${err.message || err}`);
  }

  await logDigestRun(newParcels.length, newPermits.length, newListings.length, emailSent, errors);

  return { newParcels, newPermits, newListings, errors, emailSent };
}

function buildDigestBody(parcels, permits, listings, errors) {
  let body = '';

  if (parcels.length === 0 && permits.length === 0 && listings.length === 0) {
    body += 'No new listings, parcels, or permits since the last run.\n\n';
  } else {
    if (parcels.length > 0) {
      body += `NEW VACANT LAND (${parcels.length}):\n`;
      parcels.forEach((p) => {
        body += `- APN ${p[0]} | Acreage: ${p[1]} | Zoning: ${p[2]} | Status: ${p[3]}\n`;
      });
      body += '\n';
    }
    if (permits.length > 0) {
      body += `NEW PERMITS (${permits.length}):\n`;
      permits.forEach((p) => { body += `- ${p.join(' | ')}\n`; });
      body += '\n';
    }
    if (listings.length > 0) {
      body += `NEW LISTINGS (${listings.length}):\n`;
      listings.forEach((l) => { body += `- ${l.join(' | ')}\n`; });
      body += '\n';
    }
  }

  if (!config.PARCEL_REFRESH_CADENCE_CONFIRMED) {
    body += "NOTE: The Kern County vacant-parcels layer's refresh cadence has not been " +
      'confirmed yet (run `npm run inspect:parcel-schema` and check editFieldsInfo, or ask ' +
      'County GIS directly). "New" parcels above are new relative to the last successful ' +
      'pull, not necessarily new since yesterday.\n\n';
  }

  if (errors.length > 0) {
    body += 'COLLECTOR ERRORS (data below may be incomplete):\n';
    errors.forEach((e) => { body += `- ${e}\n`; });
  }

  return body;
}

async function sendDigestEmail(subject, body) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_APP_PASSWORD
    },
    // nodemailer's default timeouts run up to ~2 minutes on a bad
    // connection/credentials -- too long next to Vercel's function duration
    // cap (vercel.json requests 60s). Fail fast instead so a broken SMTP
    // config shows up as a normal logged error, not a killed function that
    // never reaches logDigestRun().
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000
  });

  await transporter.sendMail({
    from: config.SMTP_USER,
    to: config.DIGEST_TO_EMAIL || config.SMTP_USER,
    subject,
    text: body
  });
}

async function logDigestRun(parcelCount, permitCount, listingCount, emailSent, errors) {
  const row = [formatDate(new Date()), parcelCount, permitCount, listingCount, emailSent, errors.join('; ')];
  await sheetsApi.appendValues(config.SHEET_NAMES.DIGEST_LOG, [row]);
}

module.exports = { runDailyDigest, buildDigestBody };
