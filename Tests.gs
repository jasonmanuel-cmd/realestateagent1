/**
 * Lightweight self-checks for pure helper functions only. Per the build
 * spec, these must never fabricate example parcel/permit/listing data --
 * there is no mock ArcGIS or Accela response standing in for a real one
 * here. Run runSelfTests_() manually from the Apps Script editor.
 */
function runSelfTests_() {
  var failures = [];

  var url = buildUrl_('https://example.invalid/query', { a: '1', b: 'two words' });
  if (url !== 'https://example.invalid/query?a=1&b=two%20words') {
    failures.push('buildUrl_ produced unexpected output: ' + url);
  }

  var formatted = formatDate_(new Date(2026, 0, 15));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
    failures.push('formatDate_ did not produce yyyy-MM-dd: ' + formatted);
  }

  if (failures.length === 0) {
    Logger.log('runSelfTests_: all checks passed.');
  } else {
    Logger.log('runSelfTests_: FAILURES:\n' + failures.join('\n'));
  }
}
