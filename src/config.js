require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. Locally: copy .env.example to .env and fill it in. ` +
      `On a host like Vercel: set it in Project Settings -> Environment Variables and redeploy.`
    );
  }
  return value;
}

module.exports = {
  // The deployed Apps Script Web App URL and its shared secret -- see
  // apps-script/Code.gs. Replaces the Google Sheets REST API + OAuth.
  SHEETS_WEBAPP_URL: required('SHEETS_WEBAPP_URL'),
  SHEETS_WEBAPP_SECRET: required('SHEETS_WEBAPP_SECRET'),

  // Gmail SMTP + an App Password (myaccount.google.com -> Security -> App
  // Passwords, requires 2-Step Verification). Replaces the Gmail API + OAuth.
  SMTP_USER: required('SMTP_USER'),
  SMTP_APP_PASSWORD: required('SMTP_APP_PASSWORD'),
  // Defaults to SMTP_USER itself if unset.
  DIGEST_TO_EMAIL: process.env.DIGEST_TO_EMAIL || null,

  PARCEL_QUERY_URL: 'https://maps.kerncounty.com/arcgis/rest/services/Planning/SB2VP_VacantParcels_pub/MapServer/5/query',
  PARCEL_LAYER_METADATA_URL: 'https://maps.kerncounty.com/arcgis/rest/services/Planning/SB2VP_VacantParcels_pub/MapServer/5?f=json',

  ASSESSOR_ROOT_URL: 'https://maps.co.kern.ca.us/arcgis/rest/services/Assessor/Assessor_Public/MapServer?f=json',
  ASSESSOR_QUERY_BASE_URL: 'https://maps.co.kern.ca.us/arcgis/rest/services/Assessor/Assessor_Public/MapServer',
  // Not currently queried by any collector -- the spec only asked for the layer
  // index to be confirmed, not wired in yet.
  ASSESSOR_LAYER_INDEX: null,

  PERMITS_SEARCH_URL: 'https://aca-prod.accela.com/KERNCO/Cap/CapHome.aspx?module=Building',

  PAGE_SIZE: 2000,

  // UNVERIFIED PLACEHOLDERS. Run `npm run inspect:parcel-schema` against the
  // live ArcGIS layer and replace these with the real field names before
  // trusting collectParcelData() output. A wrong name returns `undefined`,
  // not an error -- see src/parcels.js for how that's surfaced instead of
  // silently swallowed.
  PARCEL_FIELDS: {
    APN: 'APN',
    ACREAGE: 'ACREAGE',
    ZONING: 'ZONING',
    STATUS: 'STATUS',
    EDIT_DATE: null
  },

  // Flip to true only once a human has confirmed how often the vacant-parcels
  // layer actually refreshes (via editFieldsInfo, or by asking Kern County GIS
  // directly). Until then, the digest email says so instead of claiming
  // "daily new parcels".
  PARCEL_REFRESH_CADENCE_CONFIRMED: false,

  SHEET_NAMES: {
    PARCELS_SNAPSHOT: 'Parcels_Snapshot',
    PARCELS_SEEN: 'Parcels_Seen',
    PERMITS_SEEN: 'Permits_Seen',
    DIGEST_LOG: 'Digest_Log'
  }
};
