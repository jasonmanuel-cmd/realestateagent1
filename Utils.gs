/**
 * Small shared helpers used by the parcel, permit, and digest collectors.
 */

function logError_(source, message) {
  Logger.log('[ERROR][' + source + '] ' + message);
}

function formatDate_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function buildUrl_(base, params) {
  var query = Object.keys(params)
    .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
    .join('&');
  return base + '?' + query;
}
