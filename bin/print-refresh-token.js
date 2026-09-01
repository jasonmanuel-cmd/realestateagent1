#!/usr/bin/env node
/**
 * Run this once locally (not on Vercel) to get the values you paste into
 * Vercel's Project Settings -> Environment Variables for the serverless
 * cron function (api/digest.js): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
 * GOOGLE_REFRESH_TOKEN. It reuses the same interactive consent flow as
 * `npm run digest` -- if you've already run that once, this just reads the
 * cached token.json instead of prompting again.
 */
const fs = require('fs');
const path = require('path');
const { getAuthenticatedClient } = require('../src/auth');

async function main() {
  const auth = await getAuthenticatedClient();
  const credsPath = path.join(__dirname, '..', 'credentials.json');
  const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
  const key = creds.installed || creds.web;

  console.log('\nPaste these into Vercel -> Project Settings -> Environment Variables:\n');
  console.log(`GOOGLE_CLIENT_ID=${key.client_id}`);
  console.log(`GOOGLE_CLIENT_SECRET=${key.client_secret}`);
  console.log(`GOOGLE_REFRESH_TOKEN=${auth.credentials.refresh_token}`);

  if (!auth.credentials.refresh_token) {
    console.warn(
      '\nWARNING: no refresh_token present. Delete token.json and re-run this so the ' +
      'consent flow requests one with access_type=offline+prompt=consent (already the ' +
      'default here) -- Google only issues a refresh token on first consent unless you ' +
      'force re-consent.'
    );
  }
}

main().catch((err) => {
  console.error('Failed to print refresh token:', err);
  process.exit(1);
});
