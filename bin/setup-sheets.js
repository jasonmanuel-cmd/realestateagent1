#!/usr/bin/env node
const { getAuthenticatedClient } = require('../src/auth');
const { ensureDigestSheetsExist } = require('../src/sheetSetup');

async function main() {
  const auth = await getAuthenticatedClient();
  await ensureDigestSheetsExist(auth);
  console.log('Sheets verified/created: Parcels_Snapshot, Parcels_Seen, Permits_Seen, Digest_Log.');
}

main().catch((err) => {
  console.error('Failed to set up sheets:', err);
  process.exit(1);
});
