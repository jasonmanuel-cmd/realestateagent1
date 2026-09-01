/**
 * Parcel collector + snapshot-diff against the Kern County Vacant Parcels
 * (Planning) ArcGIS layer.
 *
 * Field names come from CONFIG.PARCEL_FIELDS (Config.gs), which are
 * UNVERIFIED PLACEHOLDERS until inspectParcelSchema() (SchemaInspector.gs)
 * has been run against the live layer and CONFIG updated with the real
 * names. An ArcGIS query silently returns `undefined` for a field name it
 * doesn't recognize -- writeParcelSnapshot_ below turns that into an
 * 'UNVERIFIED' cell instead of a blank one, and diffParcels() refuses to
 * treat an 'UNVERIFIED' APN as new signal, so a schema mismatch shows up as
 * a wall of UNVERIFIED rows in the sheet instead of a digest that's quietly
 * wrong.
 */

function collectParcelData() {
  var outFields = [
    CONFIG.PARCEL_FIELDS.APN,
    CONFIG.PARCEL_FIELDS.ACREAGE,
    CONFIG.PARCEL_FIELDS.ZONING,
    CONFIG.PARCEL_FIELDS.STATUS
  ];
  if (CONFIG.PARCEL_FIELDS.EDIT_DATE) {
    outFields.push(CONFIG.PARCEL_FIELDS.EDIT_DATE);
  }

  var baseParams = {
    where: '1=1',
    outFields: outFields.join(','),
    f: 'json',
    resultRecordCount: CONFIG.PAGE_SIZE
  };

  var allFeatures = [];
  var offset = 0;

  while (true) {
    var url = buildUrl_(CONFIG.PARCEL_QUERY_URL, Object.assign({}, baseParams, { resultOffset: offset }));
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

    if (response.getResponseCode() !== 200) {
      logError_('collectParcelData', 'HTTP ' + response.getResponseCode() + ' at offset ' + offset);
      break;
    }

    var data = JSON.parse(response.getContentText());
    if (data.error) {
      logError_('collectParcelData', JSON.stringify(data.error));
      break;
    }

    var features = data.features || [];
    allFeatures = allFeatures.concat(features);

    if (features.length < CONFIG.PAGE_SIZE) break; // last page
    offset += CONFIG.PAGE_SIZE;
  }

  writeParcelSnapshot_(allFeatures);
  return allFeatures;
}

function writeParcelSnapshot_(features) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEET_NAMES.PARCELS_SNAPSHOT);
  sheet.clearContents();
  sheet.appendRow(['APN', 'Acreage', 'Zoning', 'Status', 'SourceLayer', 'PulledDate']);

  var today = new Date();
  var f = CONFIG.PARCEL_FIELDS;

  var rows = features.map(function (feature) {
    var attrs = feature.attributes || {};
    return [
      attrs[f.APN] !== undefined ? attrs[f.APN] : 'UNVERIFIED',
      attrs[f.ACREAGE] !== undefined ? attrs[f.ACREAGE] : 'UNVERIFIED',
      attrs[f.ZONING] !== undefined ? attrs[f.ZONING] : 'UNVERIFIED',
      attrs[f.STATUS] !== undefined ? attrs[f.STATUS] : 'UNVERIFIED',
      'SB2VP_VacantParcels_pub',
      today
    ];
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 6).setValues(rows);
  }
}

/**
 * Diffs today's Parcels_Snapshot against the permanent Parcels_Seen record.
 * New APNs are appended to Parcels_Seen and returned. For APNs already on
 * record, LastSeenDate and LastStatus are kept current -- the sheet schema
 * (Step 2) has those columns specifically for that, so leaving them frozen
 * at their first-seen value would make them permanently stale.
 */
function diffParcels() {
  var ss = SpreadsheetApp.getActive();
  var snapshot = ss.getSheetByName(CONFIG.SHEET_NAMES.PARCELS_SNAPSHOT).getDataRange().getValues();
  var seenSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.PARCELS_SEEN);
  var seenData = seenSheet.getDataRange().getValues();

  var seenAPNs = new Set(seenData.slice(1).map(function (r) { return r[0]; }));
  var today = new Date();
  var newParcels = [];

  snapshot.slice(1).forEach(function (row) {
    var apn = row[0];
    if (apn === 'UNVERIFIED') return; // never treat unverified rows as new signal

    if (!seenAPNs.has(apn)) {
      newParcels.push(row);
      seenSheet.appendRow([apn, today, today, row[3]]);
      seenAPNs.add(apn); // avoid double-counting if the same APN appears twice in one pull
    } else {
      updateSeenParcelStatus_(seenSheet, seenData, apn, row[3], today);
    }
  });

  return newParcels;
}

function updateSeenParcelStatus_(seenSheet, seenData, apn, currentStatus, today) {
  for (var i = 1; i < seenData.length; i++) {
    if (seenData[i][0] === apn) {
      var rowNum = i + 1; // account for header row
      seenSheet.getRange(rowNum, 3).setValue(today); // LastSeenDate
      if (seenData[i][3] !== currentStatus) {
        seenSheet.getRange(rowNum, 4).setValue(currentStatus); // LastStatus
      }
      return;
    }
  }
}
