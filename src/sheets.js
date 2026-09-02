/**
 * Talks to the Google Apps Script "Web App" bound to the spreadsheet (see
 * apps-script/Code.gs) instead of the Google Sheets REST API -- no Google
 * Cloud Console project, OAuth client, or billing account needed. Every
 * call is one POST carrying a shared secret (SHEETS_WEBAPP_SECRET) that the
 * Apps Script side checks before touching the sheet.
 */
const config = require('./config');

async function callWebApp(payload) {
  const res = await fetch(config.SHEETS_WEBAPP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: config.SHEETS_WEBAPP_SECRET, ...payload })
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    // Most common cause: the deployment's "Who has access" isn't set to
    // "Anyone", so this POST hit a Google login page (HTML) instead of the
    // script.
    throw new Error(
      `Sheets Web App returned non-JSON (HTTP ${res.status}). Check that the Apps Script ` +
      `deployment's "Who has access" is set to "Anyone". Response started: ${text.slice(0, 200)}`
    );
  }

  if (!data.ok) {
    throw new Error(data.error || `Sheets Web App request failed (HTTP ${res.status})`);
  }
  return data.result;
}

async function getValues(sheetName, a1Range) {
  const result = await callWebApp({ op: 'get', sheetName, a1Range: a1Range || null });
  return result || [];
}

async function clearSheet(sheetName) {
  await callWebApp({ op: 'clear', sheetName });
}

async function updateValues(sheetName, a1Range, values) {
  await callWebApp({ op: 'update', sheetName, a1Range, values });
}

async function appendValues(sheetName, values) {
  if (values.length === 0) return;
  await callWebApp({ op: 'append', sheetName, values });
}

async function batchUpdateValues(updates) {
  if (updates.length === 0) return;
  await callWebApp({ op: 'batchUpdate', updates });
}

async function ensureSheetExists(sheetName) {
  await callWebApp({ op: 'ensureSheet', sheetName });
}

module.exports = { getValues, clearSheet, updateValues, appendValues, batchUpdateValues, ensureSheetExists };
