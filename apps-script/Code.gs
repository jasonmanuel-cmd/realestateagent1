/**
 * Kern County Deal Finder -- Sheets Web App
 *
 * This is NOT part of the Node project's file tree that runs on Vercel/your
 * machine -- it's meant to be copy-pasted into the Apps Script project
 * bound to your spreadsheet. It exists so the Node side can read/write the
 * sheet over a plain HTTP POST, without ever touching Google Cloud
 * Console, OAuth, or any billing/credit-card screen. It's just a script
 * attached to your own free Google account, talking to your own
 * spreadsheet -- Apps Script deployment has always been free.
 *
 * SETUP (do this once):
 * 1. Open your spreadsheet -> Extensions -> Apps Script.
 * 2. Delete whatever's in the default Code.gs and paste this entire file
 *    in its place. Save (the disk icon, or Ctrl+S).
 * 3. Set your secret. Either:
 *      a) Run the setWebAppSecret() function below once (pick it from the
 *         function dropdown at the top, click Run, approve the
 *         permissions prompt) after editing the placeholder value in it, or
 *      b) Project Settings (gear icon, left sidebar) -> Script Properties
 *         -> Add script property -> name: WEBAPP_SECRET, value: any long
 *         random string you make up.
 *    Either way, remember this value -- it's what SHEETS_WEBAPP_SECRET
 *    must match on the Node side. Treat it like a password: anyone who has
 *    it can read/write your sheet through this Web App.
 * 4. Deploy -> New deployment -> gear icon next to "Select type" -> Web app.
 *      Description: anything
 *      Execute as: Me
 *      Who has access: Anyone
 *    Click Deploy. It'll ask you to authorize the script to access your
 *    spreadsheet -- that's you granting your own script permission to edit
 *    your own sheet, which is normal and expected (you may see an
 *    "unverified app" warning since this script isn't published publicly;
 *    click Advanced -> Go to (project name) to continue).
 * 5. Copy the "Web app" URL it gives you (ends in /exec). That's
 *    SHEETS_WEBAPP_URL for the Node project's .env / Vercel env vars.
 *
 * If you ever need to redeploy after editing this file, use Deploy ->
 * Manage deployments -> edit (pencil icon) -> New version, rather than
 * creating a whole new deployment -- that keeps the same URL.
 */

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ ok: false, error: 'Invalid JSON body' });
  }

  var expectedSecret = PropertiesService.getScriptProperties().getProperty('WEBAPP_SECRET');
  if (!expectedSecret) {
    return jsonResponse_({ ok: false, error: 'WEBAPP_SECRET is not set in Script Properties. See setup step 3.' });
  }
  if (body.secret !== expectedSecret) {
    return jsonResponse_({ ok: false, error: 'Unauthorized' });
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var result = handleOp_(ss, body);
    return jsonResponse_({ ok: true, result: result });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.toString() });
  }
}

function handleOp_(ss, body) {
  switch (body.op) {
    case 'get':
      return getValues_(ss, body.sheetName, body.a1Range);
    case 'clear':
      return clearSheet_(ss, body.sheetName);
    case 'update':
      return updateValues_(ss, body.sheetName, body.a1Range, body.values);
    case 'append':
      return appendValues_(ss, body.sheetName, body.values);
    case 'batchUpdate':
      return batchUpdate_(ss, body.updates);
    case 'ensureSheet':
      return ensureSheet_(ss, body.sheetName);
    default:
      throw new Error('Unknown op: ' + body.op);
  }
}

function getSheetOrThrow_(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('No sheet named "' + sheetName + '"');
  return sheet;
}

function getValues_(ss, sheetName, a1Range) {
  var sheet = getSheetOrThrow_(ss, sheetName);
  if (a1Range) {
    return sheet.getRange(a1Range).getValues();
  }
  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    return [];
  }
  return sheet.getDataRange().getValues();
}

function clearSheet_(ss, sheetName) {
  getSheetOrThrow_(ss, sheetName).clearContents();
  return null;
}

function updateValues_(ss, sheetName, a1Range, values) {
  var sheet = getSheetOrThrow_(ss, sheetName);
  var startRange = sheet.getRange(a1Range);
  var startRow = startRange.getRow();
  var startCol = startRange.getColumn();

  var numRows = values.length;
  var numCols = 0;
  values.forEach(function (row) { numCols = Math.max(numCols, row.length); });

  var padded = values.map(function (row) {
    var copy = row.slice();
    while (copy.length < numCols) copy.push('');
    return copy;
  });

  sheet.getRange(startRow, startCol, numRows, numCols).setValues(padded);
  return null;
}

function appendValues_(ss, sheetName, values) {
  var sheet = getSheetOrThrow_(ss, sheetName);
  values.forEach(function (row) {
    sheet.appendRow(row);
  });
  return null;
}

function batchUpdate_(ss, updates) {
  updates.forEach(function (u) {
    updateValues_(ss, u.sheetName, u.a1Range, u.values);
  });
  return null;
}

function ensureSheet_(ss, sheetName) {
  if (!ss.getSheetByName(sheetName)) {
    ss.insertSheet(sheetName);
  }
  return null;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Edit the placeholder value below, then run this once (function dropdown
// at the top of the editor -> setWebAppSecret -> Run) as an alternative to
// setup step 3b. Re-run it any time you want to rotate the secret.
function setWebAppSecret() {
  var secret = 'REPLACE_WITH_A_LONG_RANDOM_STRING';
  if (secret === 'REPLACE_WITH_A_LONG_RANDOM_STRING') {
    throw new Error('Edit the secret value in this function before running it.');
  }
  PropertiesService.getScriptProperties().setProperty('WEBAPP_SECRET', secret);
  Logger.log('WEBAPP_SECRET set. Use this exact value for SHEETS_WEBAPP_SECRET on the Node side.');
}
