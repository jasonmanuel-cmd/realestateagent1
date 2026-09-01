/**
 * Manual, human-in-the-loop schema checks (Step 1 of the original build
 * spec). Run these before trusting collectParcelData() output -- they only
 * print to the console, they never touch the spreadsheet or config.js,
 * because field names must be confirmed by a person reading the real
 * response, not inferred by this script.
 */
const config = require('./config');

async function inspectParcelSchema() {
  const res = await fetch(config.PARCEL_LAYER_METADATA_URL);
  if (!res.ok) {
    console.error(`inspectParcelSchema: HTTP ${res.status}`);
    console.error(await res.text());
    return;
  }

  const data = await res.json();
  if (data.error) {
    console.error('inspectParcelSchema error:', JSON.stringify(data.error));
    return;
  }

  console.log('Layer name:', data.name);
  console.log('Fields:');
  (data.fields || []).forEach((f) => {
    console.log(`  ${f.name}  (type=${f.type}, alias="${f.alias}")`);
  });

  if (data.editFieldsInfo) {
    console.log('editFieldsInfo (native last-edit tracking exists):', JSON.stringify(data.editFieldsInfo));
    console.log('-> Prefer filtering/sorting on this EditDate field over a full diff, once confirmed.');
  } else {
    console.log('No editFieldsInfo on this layer -- no native EditDate field. Full snapshot-diff (as built) is required.');
  }

  console.log('\nFull raw JSON for reference:');
  console.log(JSON.stringify(data, null, 2));
}

async function inspectAssessorLayers() {
  const res = await fetch(config.ASSESSOR_ROOT_URL);
  if (!res.ok) {
    console.error(`inspectAssessorLayers: HTTP ${res.status}`);
    console.error(await res.text());
    return;
  }

  const data = await res.json();
  if (data.error) {
    console.error('inspectAssessorLayers error:', JSON.stringify(data.error));
    return;
  }

  console.log('Layers on Assessor_Public MapServer:');
  (data.layers || []).forEach((l) => {
    console.log(`  id=${l.id}  name="${l.name}"  parentLayerId=${l.parentLayerId}`);
  });
  console.log('Pick the parcel layer id above, then run: npm run inspect:assessor-fields -- <id>');
}

async function inspectAssessorLayerFields(layerIndex) {
  if (layerIndex === undefined || layerIndex === null || Number.isNaN(layerIndex)) {
    console.log('Pass a layer index, e.g. `npm run inspect:assessor-fields -- 2`. Run inspect:assessor-layers first to find it.');
    return;
  }

  const url = `${config.ASSESSOR_QUERY_BASE_URL}/${layerIndex}?f=json`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`inspectAssessorLayerFields: HTTP ${res.status}`);
    console.error(await res.text());
    return;
  }

  const data = await res.json();
  if (data.error) {
    console.error('inspectAssessorLayerFields error:', JSON.stringify(data.error));
    return;
  }

  console.log(`Layer ${layerIndex} name:`, data.name);
  console.log('Fields:');
  (data.fields || []).forEach((f) => {
    console.log(`  ${f.name}  (type=${f.type}, alias="${f.alias}")`);
  });
  if (data.editFieldsInfo) {
    console.log('editFieldsInfo:', JSON.stringify(data.editFieldsInfo));
  }
}

module.exports = { inspectParcelSchema, inspectAssessorLayers, inspectAssessorLayerFields };
