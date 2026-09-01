/**
 * Checks for pure helper functions only. Per the build spec, these must
 * never fabricate example parcel/permit/listing data -- there is no mock
 * ArcGIS or Gmail response standing in for a real one here.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildUrl, formatDate } = require('../src/utils');

test('buildUrl encodes params', () => {
  const url = buildUrl('https://example.invalid/query', { a: '1', b: 'two words' });
  assert.equal(url, 'https://example.invalid/query?a=1&b=two%20words');
});

test('formatDate produces yyyy-MM-dd', () => {
  const formatted = formatDate(new Date(2026, 0, 15));
  assert.match(formatted, /^\d{4}-\d{2}-\d{2}$/);
});
