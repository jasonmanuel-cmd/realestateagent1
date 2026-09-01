/**
 * Manual, human-in-the-loop schema checks (Step 1 of the build spec).
 *
 * Run these from the Apps Script editor (select the function, click Run) and
 * read the results in View > Logs (or Executions). They only log -- they
 * never write to the spreadsheet and never update CONFIG automatically,
 * because field names must be confirmed by a person reading the real
 * response, not inferred by this script.
 *
 * Why run these from Apps Script and not elsewhere: UrlFetchApp executes on
 * Google's servers, not through whatever network you're developing on, so
 * this is the reliable way to reach maps.kerncounty.com / maps.co.kern.ca.us
 * even from an environment (like a sandboxed build session) that can't
 * reach those hosts directly.
 */

function inspectParcelSchema() {
  var response = UrlFetchApp.fetch(CONFIG.PARCEL_LAYER_METADATA_URL, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) {
    Logger.log('inspectParcelSchema: HTTP ' + response.getResponseCode());
    Logger.log(response.getContentText());
    return;
  }

  var data = JSON.parse(response.getContentText());
  if (data.error) {
    Logger.log('inspectParcelSchema error: ' + JSON.stringify(data.error));
    return;
  }

  Logger.log('Layer name: ' + data.name);
  Logger.log('Fields:');
  (data.fields || []).forEach(function (f) {
    Logger.log('  ' + f.name + '  (type=' + f.type + ', alias="' + f.alias + '")');
  });

  if (data.editFieldsInfo) {
    Logger.log('editFieldsInfo (native last-edit tracking exists): ' + JSON.stringify(data.editFieldsInfo));
    Logger.log('-> Prefer filtering/sorting on this EditDate field over a full diff, once confirmed.');
  } else {
    Logger.log('No editFieldsInfo on this layer -- no native EditDate field. Full snapshot-diff approach (as built) is required.');
  }

  Logger.log('Full raw JSON for reference:');
  Logger.log(response.getContentText());
}

function inspectAssessorLayers() {
  var response = UrlFetchApp.fetch(CONFIG.ASSESSOR_ROOT_URL, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) {
    Logger.log('inspectAssessorLayers: HTTP ' + response.getResponseCode());
    Logger.log(response.getContentText());
    return;
  }

  var data = JSON.parse(response.getContentText());
  if (data.error) {
    Logger.log('inspectAssessorLayers error: ' + JSON.stringify(data.error));
    return;
  }

  Logger.log('Layers on Assessor_Public MapServer:');
  (data.layers || []).forEach(function (l) {
    Logger.log('  id=' + l.id + '  name="' + l.name + '"  parentLayerId=' + l.parentLayerId);
  });
  Logger.log('Pick the parcel layer id above, then run inspectAssessorLayerFields(id).');
}

function inspectAssessorLayerFields(layerIndex) {
  if (layerIndex === undefined || layerIndex === null) {
    Logger.log('Pass a layer index, e.g. inspectAssessorLayerFields(2). Run inspectAssessorLayers() first to find it.');
    return;
  }

  var url = CONFIG.ASSESSOR_QUERY_BASE_URL + '/' + layerIndex + '?f=json';
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) {
    Logger.log('inspectAssessorLayerFields: HTTP ' + response.getResponseCode());
    Logger.log(response.getContentText());
    return;
  }

  var data = JSON.parse(response.getContentText());
  if (data.error) {
    Logger.log('inspectAssessorLayerFields error: ' + JSON.stringify(data.error));
    return;
  }

  Logger.log('Layer ' + layerIndex + ' name: ' + data.name);
  Logger.log('Fields:');
  (data.fields || []).forEach(function (f) {
    Logger.log('  ' + f.name + '  (type=' + f.type + ', alias="' + f.alias + '")');
  });
  if (data.editFieldsInfo) {
    Logger.log('editFieldsInfo: ' + JSON.stringify(data.editFieldsInfo));
  }
}
