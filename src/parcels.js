/**
 * Parcel collector + snapshot-diff against the Kern County Vacant Parcels
 * (Planning) ArcGIS layer.
 *
 * Field names come from config.PARCEL_FIELDS, which are UNVERIFIED
 * PLACEHOLDERS until inspectParcelSchema() has been run against the live
 * layer and config.js updated with the real names (see schemaInspector.js).
 * An ArcGIS query silently returns `undefined` for a field name it doesn't
 * recognize -- toSnapshotRows() below turns that into an 'UNVERIFIED' cell
 * instead of a blank one, and diffParcels() refuses to treat an
 * 'UNVERIFIED' APN as new signal, so a schema mismatch shows up as a wall
 * of UNVERIFIED rows in the sheet instead of a digest that's quietly wrong.
 */
const config = require('./config');
const { buildUrl, logError, formatDate } = require('./utils');
const sheetsApi = require('./sheets');

async function collectParcelData() {
  const outFields = [
    config.PARCEL_FIELDS.APN,
    config.PARCEL_FIELDS.ACREAGE,
    config.PARCEL_FIELDS.ZONING,
    config.PARCEL_FIELDS.STATUS
  ];
  if (config.PARCEL_FIELDS.EDIT_DATE) {
    outFields.push(config.PARCEL_FIELDS.EDIT_DATE);
  }

  const baseParams = {
    where: '1=1',
    outFields: outFields.join(','),
    f: 'json',
    resultRecordCount: config.PAGE_SIZE
  };

  let allFeatures = [];
  let offset = 0;

  while (true) {
    const url = buildUrl(config.PARCEL_QUERY_URL, { ...baseParams, resultOffset: offset });
    const res = await fetch(url);

    if (!res.ok) {
      logError('collectParcelData', `HTTP ${res.status} at offset ${offset}`);
      break;
    }

    const data = await res.json();
    if (data.error) {
      logError('collectParcelData', JSON.stringify(data.error));
      break;
    }

    const features = data.features || [];
    allFeatures = allFeatures.concat(features);

    if (features.length < config.PAGE_SIZE) break; // last page
    offset += config.PAGE_SIZE;
  }

  return allFeatures;
}

function toSnapshotRows(features) {
  const today = formatDate(new Date());
  const f = config.PARCEL_FIELDS;

  return features.map((feature) => {
    const attrs = feature.attributes || {};
    return [
      attrs[f.APN] !== undefined ? attrs[f.APN] : 'UNVERIFIED',
      attrs[f.ACREAGE] !== undefined ? attrs[f.ACREAGE] : 'UNVERIFIED',
      attrs[f.ZONING] !== undefined ? attrs[f.ZONING] : 'UNVERIFIED',
      attrs[f.STATUS] !== undefined ? attrs[f.STATUS] : 'UNVERIFIED',
      'SB2VP_VacantParcels_pub',
      today
    ];
  });
}

async function writeParcelSnapshot(features) {
  const sheetName = config.SHEET_NAMES.PARCELS_SNAPSHOT;
  const header = ['APN', 'Acreage', 'Zoning', 'Status', 'SourceLayer', 'PulledDate'];
  const rows = toSnapshotRows(features);

  await sheetsApi.clearSheet(sheetName);
  await sheetsApi.updateValues(sheetName, 'A1', [header, ...rows]);
}

/**
 * Diffs today's Parcels_Snapshot against the permanent Parcels_Seen record.
 * New APNs are appended to Parcels_Seen and returned. For APNs already on
 * record, LastSeenDate and LastStatus are kept current -- the sheet schema
 * has those columns specifically for that, so leaving them frozen at their
 * first-seen value would make them permanently stale.
 */
async function diffParcels() {
  const snapshotName = config.SHEET_NAMES.PARCELS_SNAPSHOT;
  const seenName = config.SHEET_NAMES.PARCELS_SEEN;

  const snapshot = await sheetsApi.getValues(snapshotName);
  const seenData = await sheetsApi.getValues(seenName);

  const seenRowIndexByApn = new Map();
  seenData.slice(1).forEach((row, i) => seenRowIndexByApn.set(row[0], i + 1)); // +1: skip header

  const today = formatDate(new Date());
  const newParcels = [];
  const newSeenRows = [];
  const batchUpdates = [];

  snapshot.slice(1).forEach((row) => {
    const apn = row[0];
    if (apn === 'UNVERIFIED') return; // never treat unverified rows as new signal

    if (!seenRowIndexByApn.has(apn)) {
      newParcels.push(row);
      newSeenRows.push([apn, today, today, row[3]]);
      seenRowIndexByApn.set(apn, -1); // avoid double-adding if the same APN appears twice in one pull
    } else {
      const seenIdx = seenRowIndexByApn.get(apn);
      if (seenIdx < 0) return; // already queued as new in this same pull

      const rowNum = seenIdx + 1; // account for header row in 1-indexed sheet rows
      batchUpdates.push({ sheetName: seenName, a1Range: `C${rowNum}`, values: [[today]] }); // LastSeenDate

      const currentStatus = seenData[seenIdx][3];
      if (currentStatus !== row[3]) {
        batchUpdates.push({ sheetName: seenName, a1Range: `D${rowNum}`, values: [[row[3]]] }); // LastStatus
      }
    }
  });

  await sheetsApi.appendValues(seenName, newSeenRows);
  await sheetsApi.batchUpdateValues(batchUpdates);

  return newParcels;
}

module.exports = { collectParcelData, writeParcelSnapshot, diffParcels };
