# Project State

**Audited:** 2026-09-27, by a Claude Code session, from the repository at
`/home/user/realestateagent1` on branch `claude/kern-county-extensions-2xy3zq`
(in sync with `origin/main`). This document reflects the repository as it
existed at commit `9d8dca0a4897feaa75c8cd67679646f0151cb932` plus live
production state observed via the Vercel API in this same session.

**Note on this audit's inputs:** the task instructions said to read
`AGENTS.md` and `CLAUDE.md` first. Neither file exists anywhere in this
repository (verified: `find` over the full tree, both root and all
subdirectories). This document does not assume or invent their contents.

## What this project is

"Kern County Deal Finder" — a small automation pipeline for tracking real
estate leads in Kern County, CA:
1. Pull vacant-parcel data from a public Kern County ArcGIS layer.
2. (Planned, not built) Pull building-permit filings from Kern County's
   Accela Citizen Access portal.
3. (Planned, not built) Parse Zillow/Redfin/Realtor.com email alerts.
4. Track what's new (vs. previously seen) in a Google Sheet.
5. Email a daily digest of new items.
6. Serve a small password-gated web dashboard listing current leads.

## Technology stack (verified from package.json / actual files)

- **Runtime:** Node.js >= 18 (engines field in package.json; `node --version`
  in this environment reports v22.22.2).
- **Dependencies (installed, per `npm ls --depth=0`):** `dotenv@17.4.2`,
  `nodemailer@9.1.1`. No other npm dependencies. No frontend framework/build
  step — `index.html` is a single hand-written static page (vanilla
  HTML/CSS/JS, no bundler).
- **Data store:** a Google Sheet, accessed via a **Google Apps Script Web
  App** (`apps-script/Code.gs`) over plain HTTP POST — not the Google
  Sheets REST API, not OAuth. This is a deliberate architecture choice (see
  `.ai/DECISIONS.md`) to avoid any Google Cloud Console / OAuth / billing
  dependency.
- **Email:** Gmail SMTP via `nodemailer`, authenticated with a Gmail **App
  Password** (a feature of a regular Google account's 2-Step Verification
  settings) — not the Gmail API, not OAuth.
- **Hosting (two supported, mutually exclusive per-function paths):**
  - Self-hosted: any machine/server running `node bin/run-digest.js` on a
    cron schedule.
  - Vercel: `api/digest.js` as a serverless function, triggered by Vercel
    Cron (`vercel.json`, schedule `0 13 * * *` UTC = 6am Pacific Daylight
    Time). Also hosts the dashboard (`index.html`, `api/login.js`,
    `api/logout.js`, `api/leads.js`) at the deployment's root URL.
- **Testing:** Node's built-in test runner (`node --test`, via `npm test`).
  Two tests exist, both pure-function checks with synthetic (non-domain)
  input — verified passing as of this audit (`# pass 2`, `# fail 0`).
- **No CI/CD:** no `.github/workflows`, no other CI config found anywhere
  in the repo. Tests only run when someone runs `npm test` manually.

## Directory / file map (every file in the repo, verified by `find`)

```
.env.example           Template for local env vars (no real values)
.gitignore              Ignores node_modules/, .env, credentials.json, token.json, *.log
README.md               Canonical human-facing setup/ops documentation (~307 lines)
index.html              Leads dashboard: login form + parcel table, served at Vercel deployment root
package.json / package-lock.json   npm manifest/lockfile
vercel.json             Vercel Cron schedule (0 13 * * * UTC) + function maxDuration (60s) for api/digest.js
apps-script/Code.gs     Google Apps Script Web App source (paste into script.google.com; NOT run by Node/Vercel)
api/digest.js           Vercel serverless function: runs runDailyDigest() on cron, gated by CRON_SECRET
api/leads.js            Vercel serverless function: read-only JSON feed of current leads, gated by session cookie
api/login.js            Vercel serverless function: checks DASHBOARD_PASSWORD, sets session cookie
api/logout.js           Vercel serverless function: clears session cookie
bin/run-digest.js       CLI entry point for self-hosted cron (`npm run digest`)
bin/setup-sheets.js     CLI: creates the four sheet tabs if missing (`npm run setup:sheets`)
bin/inspect-schema.js   CLI: prints live ArcGIS field names for parcels/assessor layers
src/config.js           Central config: required env vars, ArcGIS URLs, sheet tab names, parcel field-name map
src/sheets.js           Client for the Apps Script Web App (get/clear/update/append/batchUpdate/ensureSheet)
src/parcels.js          collectParcelData() (pages through ArcGIS), writeParcelSnapshot(), diffParcels()
src/permits.js          collectPermitData() -- INTENTIONALLY STUBBED, returns [] and logs (see TODO)
src/emailAlerts.js      collectEmailAlerts() -- INTENTIONALLY STUBBED, returns [] and logs (see TODO)
src/digest.js           runDailyDigest() orchestrator; buildDigestBody(); sendDigestEmail() via nodemailer; logDigestRun()
src/sheetSetup.js       ensureDigestSheetsExist() -- creates/verifies the four sheet tabs with headers
src/session.js          Signed-cookie session helper (HMAC via SESSION_SECRET) for the dashboard's password gate
src/schemaInspector.js  inspectParcelSchema()/inspectAssessorLayers()/inspectAssessorLayerFields() -- manual ArcGIS schema checks
src/utils.js            logError(), formatDate(), buildUrl() -- pure helpers
test/utils.test.js      2 tests covering buildUrl/formatDate only, synthetic input, no fabricated domain data
```

## Sheet schema (four tabs, created/verified by `ensureDigestSheetsExist()`)

- `Parcels_Snapshot`: `APN | Acreage | Zoning | Status | SourceLayer | PulledDate` (overwritten every run)
- `Parcels_Seen`: `APN | FirstSeenDate | LastSeenDate | LastStatus` (append-only permanent record)
- `Permits_Seen`: `RecordNumber | APN_or_Address | PermitType | Status | FirstSeenDate` (schema exists; nothing writes to it yet since the permit collector is stubbed)
- `Digest_Log`: `RunDate | NewParcelsCount | NewPermitsCount | NewListingsCount | EmailSent | Errors` (one row per run)

## Required environment variables (names only -- see `.env.example` for the authoritative list; no values recorded here or anywhere in this repo)

`SHEETS_WEBAPP_URL`, `SHEETS_WEBAPP_SECRET`, `SMTP_USER`, `SMTP_APP_PASSWORD`,
`DIGEST_TO_EMAIL` (optional), `CRON_SECRET` (Vercel-hosting only),
`DASHBOARD_PASSWORD` (dashboard only), `SESSION_SECRET` (dashboard only).

## What works (verified)

- **Parcel collector + diff logic**: `collectParcelData()`, `writeParcelSnapshot()`,
  `diffParcels()`, and `ensureDigestSheetsExist()` were verified end-to-end in
  an earlier session in this same conversation, against a mock HTTP server
  implementing the same op protocol as `apps-script/Code.gs` (get/clear/
  update/append/batchUpdate/ensureSheet). Two sequential runs correctly
  identified new APNs, updated `LastSeenDate`/`LastStatus` on repeat APNs,
  and left already-queued APNs alone within the same pull.
- **Digest orchestration + error isolation**: `runDailyDigest()` was verified
  to complete and log to `Digest_Log` even when the email send fails (SMTP
  connect timeout capped at 15s specifically to prevent this from hanging
  past Vercel's function duration cap).
- **Dashboard auth**: the full login -> signed cookie -> authorized
  `/api/leads` -> logout flow, plus rejection of missing/tampered cookies,
  was verified locally against mocked env vars.
- **Local test suite**: `npm test` passes (2/2) as of this audit.
- **Vercel deployment mechanics**: pushes to `main` do trigger an automatic
  Vercel production deployment (confirmed via the Vercel API: the current
  production deployment's Git metadata matches commit `9d8dca0`, state
  `READY`).

## What is currently broken in production (verified live, not inferred)

As of this audit (2026-09-27, ~13:00 UTC), the live Vercel deployment's
`/api/digest` cron function has failed **every single scheduled run since
2026-09-02**, with the identical error each time:

```
Fatal error running digest: Error: Missing required env var SHEETS_WEBAPP_URL.
```

This was confirmed directly via the Vercel API (`get_runtime_errors` /
`get_runtime_logs` on Vercel project `prj_80YGTOJX31xJCVHCQ6Lkp4Xh1zMw`,
team `team_MewQepiRM85jQWZihGhBeiWt`, which resolves to
`realestateagent1.vercel.app`), checked repeatedly through this same
conversation over several days. As of the last check, that project's
environment variables were confirmed to hold only two leftover entries,
`SPREADSHEET_ID` and `DIGEST_TO_EMAIL` (both empty) -- artifacts of an
earlier architecture (direct Google Sheets API + OAuth) that this repo no
longer uses. None of the seven env vars the current code actually requires
(`SHEETS_WEBAPP_URL`, `SHEETS_WEBAPP_SECRET`, `SMTP_USER`,
`SMTP_APP_PASSWORD`, `CRON_SECRET`, `DASHBOARD_PASSWORD`, `SESSION_SECRET`)
were present. This means, as of this audit:
- The daily digest has never successfully run since the Apps Script/SMTP
  rewrite (commit `9d8dca0`) went live.
- The dashboard (`/`, `/api/login`, `/api/leads`) is also almost certainly
  non-functional in production for the same reason (untested directly, but
  it depends on the same missing `SHEETS_WEBAPP_URL`/`SHEETS_WEBAPP_SECRET`,
  plus `DASHBOARD_PASSWORD`/`SESSION_SECRET` which are also unset).
- **This is a Vercel dashboard configuration gap, not a code defect** -- the
  code was rewritten specifically to fail with a readable error message in
  this exact situation, and it is doing so correctly.
- A monitoring Routine (a recurring scheduled check, id
  `trig_011vRVXZyjAbhqGKRyJAegGP`, every 4 hours, self-bound to this same
  Claude session) has been running throughout this gap specifically to
  detect the moment this is fixed. It has not yet reported success as of
  this audit.

There is also a second, seemingly duplicate Vercel project
(`realestateagent1-claude-kern-county-extensions-2xy3zq`, a different
`.vercel.app` domain) pointed at the same GitHub repository, also deployed
and `READY`. Its purpose/intent was raised with the user in this
conversation but never confirmed or resolved.

## Unverified / placeholder data (do not treat as confirmed)

- `src/config.js`'s `PARCEL_FIELDS` (APN/ACREAGE/ZONING/STATUS field names
  for the ArcGIS query) are explicitly marked as unverified placeholders in
  the code's own comments. The county's ArcGIS endpoints
  (`maps.kerncounty.com`, `maps.co.kern.ca.us`) were unreachable from every
  sandboxed session that touched this repo, so these have never been
  confirmed against the live schema.
- `PARCEL_REFRESH_CADENCE_CONFIRMED` is hardcoded `false` -- how often the
  county's vacant-parcels layer actually updates has never been determined.

## Related permanent context (not stored in files, worth knowing)

This entire project was built from an empty repository across one ongoing
conversation with a non-developer user (Linux Mint desktop) who does not
want to pay for Google Cloud or similar paid services. That constraint
directly drove the Apps Script Web App + Gmail SMTP architecture (see
`.ai/DECISIONS.md`). The user has been walked step-by-step through Google
Cloud Console setup (initially), then through undoing that in favor of the
free path, then through the Apps Script paste-and-deploy flow, but *actual
completion of the Vercel env var setup by the user has not been confirmed*
-- the persisting production error is the direct evidence that it has not
been completed (or was done incorrectly) as of this audit.
