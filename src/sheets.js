const { google } = require('googleapis');

function getSheetsClient(auth) {
  return google.sheets({ version: 'v4', auth });
}

async function getValues(auth, spreadsheetId, range) {
  const sheets = getSheetsClient(auth);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return res.data.values || [];
}

async function clearRange(auth, spreadsheetId, range) {
  const sheets = getSheetsClient(auth);
  await sheets.spreadsheets.values.clear({ spreadsheetId, range, requestBody: {} });
}

async function updateValues(auth, spreadsheetId, range, values) {
  const sheets = getSheetsClient(auth);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: { values }
  });
}

async function appendValues(auth, spreadsheetId, range, values) {
  if (values.length === 0) return;
  const sheets = getSheetsClient(auth);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values }
  });
}

// Batches many single-cell/row updates (e.g. per-parcel LastSeenDate bumps)
// into one API call instead of one round trip per update.
async function batchUpdateValues(auth, spreadsheetId, data) {
  if (data.length === 0) return;
  const sheets = getSheetsClient(auth);
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'RAW', data }
  });
}

async function ensureSheetExists(auth, spreadsheetId, title) {
  const sheets = getSheetsClient(auth);
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = (meta.data.sheets || []).some((s) => s.properties.title === title);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] }
    });
  }
}

module.exports = {
  getSheetsClient,
  getValues,
  clearRange,
  updateValues,
  appendValues,
  batchUpdateValues,
  ensureSheetExists
};
