const fs = require('fs');
const path = require('path');
const http = require('http');
const { google } = require('googleapis');

const TOKEN_PATH = path.join(__dirname, '..', 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, '..', 'credentials.json');
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

// spreadsheets: read/write the Parcels_*/Permits_Seen/Digest_Log tabs.
// gmail.send: send the digest email as the authenticated account.
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.send'
];

function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      `Missing credentials.json at ${CREDENTIALS_PATH}. In Google Cloud Console, ` +
      `create an OAuth client ID of type "Desktop app" (APIs & Services > Credentials), ` +
      `download it, and save it at that path.`
    );
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
}

function createOAuth2Client() {
  const creds = loadCredentials();
  const key = creds.installed || creds.web;
  if (!key) {
    throw new Error('credentials.json is missing an "installed" or "web" client config.');
  }
  return new google.auth.OAuth2(key.client_id, key.client_secret, REDIRECT_URI);
}

function persistTokensOnRefresh(oAuth2Client) {
  oAuth2Client.on('tokens', (tokens) => {
    const current = fs.existsSync(TOKEN_PATH) ? JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8')) : {};
    const merged = { ...current, ...tokens };
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
  });
}

async function getAuthenticatedClient() {
  const oAuth2Client = createOAuth2Client();
  persistTokensOnRefresh(oAuth2Client);

  if (fs.existsSync(TOKEN_PATH)) {
    oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8')));
    return oAuth2Client;
  }

  const tokens = await runConsentFlow(oAuth2Client);
  oAuth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log(`Token saved to ${TOKEN_PATH}`);
  return oAuth2Client;
}

function runConsentFlow(oAuth2Client) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, REDIRECT_URI);
        if (url.pathname !== '/oauth2callback') {
          res.writeHead(404);
          res.end();
          return;
        }

        const code = url.searchParams.get('code');
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Authorization complete. You can close this tab and return to the terminal.');
        server.close();

        const { tokens } = await oAuth2Client.getToken(code);
        resolve(tokens);
      } catch (err) {
        reject(err);
      }
    });

    server.listen(3000, () => {
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
      });
      console.log('One-time setup: open this URL in a browser and grant access:\n' + authUrl);
    });
  });
}

/**
 * Stateless variant for serverless hosts (Vercel, etc.) whose filesystem is
 * read-only/ephemeral and can't run an interactive browser consent flow.
 * Needs GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN as
 * env vars -- generate the refresh token once locally (getAuthenticatedClient()
 * above, or `npm run print-refresh-token`) and paste it into the host's
 * environment variable settings. googleapis exchanges it for a short-lived
 * access token in memory on each call; nothing needs to be written to disk.
 */
function getAuthenticatedClientFromEnv() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  const missing = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN']
    .filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required env var(s) for serverless auth: ${missing.join(', ')}`);
  }

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oAuth2Client.setCredentials({ refresh_token: refreshToken });
  return oAuth2Client;
}

module.exports = { getAuthenticatedClient, getAuthenticatedClientFromEnv, SCOPES };
