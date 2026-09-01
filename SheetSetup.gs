/**
 * Creates the four new tabs from Step 2 of the build spec if they don't
 * already exist. Safe to run repeatedly -- it never touches a sheet that
 * already has a header row.
 */

function ensureDigestSheetsExist() {
  var ss = SpreadsheetApp.getActive();
  ensureSheetWithHeaders_(ss, CONFIG.SHEET_NAMES.PARCELS_SNAPSHOT,
    ['APN', 'Acreage', 'Zoning', 'Status', 'SourceLayer', 'PulledDate']);
  ensureSheetWithHeaders_(ss, CONFIG.SHEET_NAMES.PARCELS_SEEN,
    ['APN', 'FirstSeenDate', 'LastSeenDate', 'LastStatus']);
  ensureSheetWithHeaders_(ss, CONFIG.SHEET_NAMES.PERMITS_SEEN,
    ['RecordNumber', 'APN_or_Address', 'PermitType', 'Status', 'FirstSeenDate']);
  ensureSheetWithHeaders_(ss, CONFIG.SHEET_NAMES.DIGEST_LOG,
    ['RunDate', 'NewParcelsCount', 'NewPermitsCount', 'NewListingsCount', 'EmailSent', 'Errors']);
}

function ensureSheetWithHeaders_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
}
