#!/usr/bin/env node
const { getAuthenticatedClient } = require('../src/auth');
const { runDailyDigest } = require('../src/digest');

async function main() {
  const auth = await getAuthenticatedClient();
  const result = await runDailyDigest(auth);

  console.log(
    `Digest run complete: ${result.newParcels.length} new parcels, ` +
    `${result.newPermits.length} new permits, ${result.newListings.length} new listings, ` +
    `emailSent=${result.emailSent}, errors=${result.errors.length}`
  );

  if (result.errors.length > 0) {
    console.error('Errors:', result.errors);
    process.exitCode = 1; // non-zero exit so cron's failure mail / a monitor notices
  }
}

main().catch((err) => {
  console.error('Fatal error running digest:', err);
  process.exit(1);
});
