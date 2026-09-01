const config = require('./config');
const sheetsApi = require('./sheets');

async function ensureDigestSheetsExist(auth) {
  await ensureSheetWithHeaders(auth, config.SHEET_NAMES.PARCELS_SNAPSHOT,
    ['APN', 'Acreage', 'Zoning', 'Status', 'SourceLayer', 'PulledDate']);
  await ensureSheetWithHeaders(auth, config.SHEET_NAMES.PARCELS_SEEN,
    ['APN', 'FirstSeenDate', 'LastSeenDate', 'LastStatus']);
  await ensureSheetWithHeaders(auth, config.SHEET_NAMES.PERMITS_SEEN,
    ['RecordNumber', 'APN_or_Address', 'PermitType', 'Status', 'FirstSeenDate']);
  await ensureSheetWithHeaders(auth, config.SHEET_NAMES.DIGEST_LOG,
    ['RunDate', 'NewParcelsCount', 'NewPermitsCount', 'NewListingsCount', 'EmailSent', 'Errors']);
}

async function ensureSheetWithHeaders(auth, name, headers) {
  await sheetsApi.ensureSheetExists(auth, config.SPREADSHEET_ID, name);
  const existing = await sheetsApi.getValues(auth, config.SPREADSHEET_ID, `${name}!A1:Z1`);
  if (existing.length === 0) {
    await sheetsApi.updateValues(auth, config.SPREADSHEET_ID, `${name}!A1`, [headers]);
  }
}

module.exports = { ensureDigestSheetsExist };
