# Kern County Deal Finder

Standalone Node.js runner for the parcel collector, permit collector, and
digest/email pipeline. This replaces the earlier Google Apps Script version
of this extension — it runs as an ordinary script on your own machine or
server (via cron), reading and writing the same Google Sheet through the
Sheets API and sending the digest email through the Gmail API.

The Zillow/Redfin/Realtor.com email-alert parser that the original "Kern
County Deal Finder" concept assumed never actually existed in this repo —
it was empty when this build started, so there was nothing to port.
`src/emailAlerts.js` is stubbed the same way the permit collector is: it
returns `[]` and logs, rather than fabricating listing data. Wire in real
Gmail-alert parsing there when you're ready (see the comment in that file).

## Layout

| Path | Purpose |
| --- | --- |
| `src/config.js` | Sheet ID, URLs, sheet tab names, and the parcel field-name map. **Field names are unverified placeholders** — see "Before first real run" below. |
| `src/auth.js` | Google OAuth2 client. `getAuthenticatedClient()`: loads `credentials.json`, runs a one-time browser consent flow, caches the token in `token.json`, auto-refreshes and persists it on later runs (local/cron use). `getAuthenticatedClientFromEnv()`: builds a client from `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REFRESH_TOKEN` env vars with no filesystem access (Vercel use). |
| `src/sheets.js` | Thin wrapper over the Sheets API (`get`/`update`/`append`/`batchUpdate`/`ensureSheetExists`). |
| `src/schemaInspector.js` | `inspectParcelSchema()`, `inspectAssessorLayers()`, `inspectAssessorLayerFields()` — run these to get real ArcGIS field names before trusting the collector. |
| `src/sheetSetup.js` | `ensureDigestSheetsExist()` — creates the four tabs with headers if missing. Runs automatically at the top of every digest run. |
| `src/parcels.js` | `collectParcelData()`, `diffParcels()` — pages through the vacant-parcels ArcGIS layer, snapshots it, diffs against `Parcels_Seen`. |
| `src/permits.js` | `collectPermitData()` — **intentionally stubbed**. See "Finishing the permit collector" below. |
| `src/emailAlerts.js` | `collectEmailAlerts()` — **intentionally stubbed**. See above. |
| `src/digest.js` | `runDailyDigest()` — runs all three collectors, emails a summary via Gmail, logs the run. |
| `bin/setup-sheets.js` | CLI: `npm run setup:sheets` |
| `bin/inspect-schema.js` | CLI: `npm run inspect:parcel-schema` / `inspect:assessor-layers` / `inspect:assessor-fields` |
| `bin/run-digest.js` | CLI: `npm run digest` — this is what you put in cron for a self-hosted machine/server. |
| `bin/print-refresh-token.js` | CLI: `npm run print-refresh-token` — prints the client ID/secret/refresh token to paste into Vercel's env vars. Only needed for the Vercel hosting path below. |
| `api/digest.js` | Vercel serverless function version of `bin/run-digest.js`, triggered by Vercel Cron instead of your own cron. Only relevant if you're hosting on Vercel. |
| `vercel.json` | Vercel Cron schedule + function config. Only relevant if you're hosting on Vercel. |
| `index.html` | The leads dashboard — a single password-gated page, served at your Vercel deployment's root URL. See "Leads dashboard" below. |
| `src/session.js` | Signed-cookie session helper backing the dashboard's password gate (no session store — the cookie itself is self-verifying via an HMAC). |
| `api/login.js` / `api/logout.js` | Check `DASHBOARD_PASSWORD`, set/clear the session cookie. |
| `api/leads.js` | Read-only JSON feed the dashboard fetches: `Parcels_Snapshot` merged with `Parcels_Seen`, newest-first. Requires a valid session cookie. |
| `test/utils.test.js` | Checks for pure helpers only (`buildUrl`, `formatDate`), run with `npm test`. No fabricated parcel/permit/listing data, per spec. |

## One-time setup

1. **Install dependencies**
   ```
   npm install
   ```

2. **Create a Google OAuth client**
   In [Google Cloud Console](https://console.cloud.google.com/), create/select a
   project, enable the **Google Sheets API** and **Gmail API**, then under
   *APIs & Services → Credentials* create an OAuth client ID of type
   **Desktop app**. Download the JSON and save it as `credentials.json` in
   the repo root (it's gitignored — never commit it).

3. **Configure the environment**
   ```
   cp .env.example .env
   ```
   Fill in `SPREADSHEET_ID` (from the sheet's URL) and optionally
   `DIGEST_TO_EMAIL` (defaults to the authenticated Gmail account itself).

4. **Confirm the real ArcGIS field names (mandatory before a real run)**
   The field names in `src/config.js` (`APN`, `ACREAGE`, `ZONING`, `STATUS`)
   are placeholders — this build couldn't reach the county's ArcGIS server
   to verify them. Run:
   ```
   npm run inspect:parcel-schema
   ```
   The first run opens a browser consent URL — visit it, approve, and the
   token is cached in `token.json` (gitignored) for all future runs,
   including from cron. Read the field list it prints and update
   `PARCEL_FIELDS` in `src/config.js` with the real names. If it logs an
   `editFieldsInfo` block with an EditDate field, set `EDIT_DATE` too, note
   the refresh cadence, and flip `PARCEL_REFRESH_CADENCE_CONFIRMED: true`
   once you actually know how often the layer updates — until then, the
   digest email appends a note that "new" parcels are relative to the last
   pull, not necessarily new since yesterday.

   A wrong field name makes ArcGIS return `undefined` rather than an error.
   `src/parcels.js` turns that into the literal string `'UNVERIFIED'` in the
   sheet, and `diffParcels()` refuses to treat an `'UNVERIFIED'` APN as new
   signal — so a schema mismatch shows up as a wall of `UNVERIFIED` rows
   instead of a digest that's silently wrong.

5. **Create the sheet tabs**
   ```
   npm run setup:sheets
   ```
   Creates `Parcels_Snapshot`, `Parcels_Seen`, `Permits_Seen`, and
   `Digest_Log` with headers if they don't already exist. (This also runs
   automatically at the start of every digest run, so this step is mostly
   for a quick sanity check.)

6. **Do a manual test run**
   ```
   npm run digest
   ```
   Check your inbox for the digest email, `Parcels_Snapshot` for real data
   (not `UNVERIFIED` rows), and `Digest_Log` for a row with `EmailSent =
   TRUE` and an empty `Errors` column.

## Scheduling: option A — your own machine/server (cron)

This is a plain script — schedule it with whatever your OS provides. A
crontab entry for a daily 6am Pacific run:

```
0 6 * * * cd /path/to/this/repo && TZ=America/Los_Angeles /usr/bin/node bin/run-digest.js >> digest.log 2>&1
```

`bin/run-digest.js` exits non-zero if any collector or the email send
failed, so cron's own failure-mail (or whatever wraps this) will notice a
bad run even before you check `Digest_Log`.

## Scheduling: option B — hosting on Vercel

Vercel doesn't run long-lived scripts, and its functions have a read-only,
per-invocation filesystem — `token.json` caching (option A's approach)
doesn't work there. Vercel Cron instead makes an HTTP request to a
serverless function on a schedule, so this repo ships `api/digest.js` (the
same `runDailyDigest()`, wrapped as an HTTP handler) and `vercel.json` (the
schedule) as an alternative to `bin/run-digest.js` + your own cron — pick
one, you don't need both. Setup:

1. **Get a refresh token and client credentials to hand to Vercel.**
   You still need `credentials.json` locally for this one-time step (see
   "One-time setup" step 2 above if you haven't done it). Run:
   ```
   npm run print-refresh-token
   ```
   The first run opens a browser consent URL same as `npm run digest` does.
   It prints three values — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `GOOGLE_REFRESH_TOKEN`.

2. **Push this repo to a Git provider Vercel can import from** (GitHub,
   GitLab, Bitbucket), then [import it as a new Vercel
   project](https://vercel.com/new). No build command or output directory
   is needed — it's just serverless functions, not a frontend app.

3. **Set environment variables** in Vercel → Project Settings →
   Environment Variables (not in `.env` — that file never leaves your
   machine):
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` —
     from step 1.
   - `SPREADSHEET_ID` — same as local setup.
   - `DIGEST_TO_EMAIL` — optional, same as local setup.
   - `CRON_SECRET` — make up a long random string. Vercel automatically
     sends it as `Authorization: Bearer <value>` on cron-triggered
     requests; `api/digest.js` checks it and rejects anything else with
     401, so the endpoint can't be triggered by a random visitor who finds
     the URL. Generate one with `openssl rand -hex 32` or similar.

   Redeploy after setting these (or set them before the first deploy).

4. **Check the cron schedule's timezone.** Vercel Cron schedules run in
   **UTC**, not your local time, and don't auto-adjust for daylight saving.
   `vercel.json` ships with `"schedule": "0 13 * * *"`, i.e. 6am Pacific
   Daylight Time (UTC-7) — during Pacific Standard Time (UTC-8, roughly
   Nov–Mar) that becomes 5am local. Adjust the cron string, or accept the
   hour of drift twice a year, or convert to a timezone without DST.

5. **Verify the plan's cron/function limits before relying on this.**
   Vercel's cron frequency limits, function duration caps, and whether cron
   is available at all differ by plan (Hobby vs Pro vs Enterprise) and
   change over time — this build session couldn't reach vercel.com to
   confirm current numbers, so check
   [vercel.com/docs/cron-jobs](https://vercel.com/docs/cron-jobs) and your
   dashboard's plan details yourself. `vercel.json` requests
   `"maxDuration": 60` for the function; a large parcel pull with many
   paginated ArcGIS requests could run long, and if your plan caps function
   duration below that, either upgrade or expect occasional timeouts (which
   still show up as a failed run — nothing here would silently succeed with
   partial data).

6. **Test it manually** before trusting the schedule: from the Vercel
   dashboard, find the deployed function's URL (something like
   `https://<project>.vercel.app/api/digest`) and hit it with the header
   Vercel would send:
   ```
   curl -H "Authorization: Bearer <your CRON_SECRET>" https://<project>.vercel.app/api/digest
   ```
   A `200` (or `207` if a collector had errors, per the `errors` array in
   the JSON body) means it ran; check `Digest_Log` and your inbox same as
   the local test run.

## Leads dashboard

A single read-only page (`index.html`) showing the parcels that have come
in, newest-first — a friendlier view than opening the raw spreadsheet. It's
gated behind one shared password (env var `DASHBOARD_PASSWORD`), no
per-user accounts. Only relevant if you're hosting on Vercel (or otherwise
serving `index.html` + `/api/*` together) — it's not part of the local
CLI/cron path.

**What it shows today:** parcels only (`Parcels_Snapshot` merged with
`Parcels_Seen` by APN, so you get current acreage/zoning/status alongside
when each APN was first/last seen). Permits and email-alert listings aren't
included yet because both collectors (`src/permits.js`,
`src/emailAlerts.js`) are still stubs returning `[]` — there's nothing real
to show. Add sections to `api/leads.js` and `index.html` once those are
finished; the pattern (a `/api/*.js` JSON endpoint gated by
`isValidSession()`, rendered by a table in `index.html`) extends
directly.

**It's read-only.** No status/notes/archive tracking — nothing here writes
back to the sheet. Do that in the sheet itself for now (e.g. edit
`Parcels_Seen`'s `LastStatus` column by hand), or ask for it to be added
later as its own feature.

### Setup

Set two more env vars in Vercel (Project Settings → Environment Variables),
in addition to the ones from "Hosting on Vercel" above:

- `DASHBOARD_PASSWORD` — whatever password you want to gate the page with.
- `SESSION_SECRET` — a long random string used to sign the session cookie
  (`openssl rand -hex 32` or similar). Anyone who has this value could forge
  a valid session cookie without knowing the password, so treat it like a
  secret, not like `DASHBOARD_PASSWORD` itself.

Redeploy after setting them, then visit your deployment's root URL
(`https://<project>.vercel.app/`) — you'll land on the login form. After
entering the password, the page fetches `/api/leads` and stays signed in
for 7 days (via the session cookie) until you hit "Log out" or it expires.

### How the auth works, briefly

`api/login.js` compares the submitted password to `DASHBOARD_PASSWORD`
(constant-time comparison, not a naive `===`, to avoid a timing side
channel) and, on match, sets an `HttpOnly` cookie containing an expiry
timestamp plus an HMAC of it (keyed by `SESSION_SECRET`). `api/leads.js`
and any future protected endpoint call `isValidSession()`
(`src/session.js`) to verify that HMAC before returning anything — no
database or session store involved, and a request with no cookie, an
expired one, or a tampered one is rejected before it ever touches the
Sheets API.

## Finishing the permit collector (Step 5 of the original spec)

`collectPermitData()` in `src/permits.js` always returns `[]` and logs a
note right now. Accela Citizen Access has no confirmed JSON API — the
Building-module search is an ASP.NET postback form. Finishing it requires:

1. Loading `https://aca-prod.accela.com/KERNCO/Cap/CapHome.aspx?module=Building`
   in a browser and inspecting the rendered search form (view-source /
   devtools) to get the real field names for a date-range search.
2. Extracting `__VIEWSTATE` / `__EVENTVALIDATION` from the GET response and
   POSTing the search with them.
3. Parsing the results table HTML into
   `[RecordNumber, APN_or_Address, PermitType, Status]` rows.
4. Diffing those against `Permits_Seen` the same way `diffParcels()` diffs
   against `Parcels_Seen` (append new `RecordNumber`s with `FirstSeenDate`).

This has to be done against the live portal by a human with a browser — it
can't be guessed from this codebase. Until it's finished, permits just
won't show up in the digest, and that's expected, not a bug.

## Wiring in the real email-alert parser

`collectEmailAlerts()` in `src/emailAlerts.js` is stubbed the same way.
When you're ready to build it for real:

1. Add the `gmail.readonly` scope to the `SCOPES` array in `src/auth.js`.
2. Delete `token.json` and re-run any CLI command once to redo the consent
   flow with the new scope.
3. Use `google.gmail({ version: 'v1', auth })` (same pattern as
   `sendDigestEmail` in `src/digest.js`) to list/read the Zillow/Redfin/
   Realtor.com alert emails and parse them into row-arrays shaped like
   what `buildDigestBody()` in `src/digest.js` expects for listings.

## Reliability notes

- Every collector (parcels, permits, listings) and the email send itself
  run in their own `try/catch` in `runDailyDigest()`. A failure in one
  never blocks the others.
- Every failure is pushed into an `errors` array that both shows up in the
  digest email body ("COLLECTOR ERRORS") and gets written to
  `Digest_Log`'s `Errors` column alongside `EmailSent`. A broken collector
  should never look like a quiet "0 new" — check `Digest_Log` if a digest
  looks suspiciously empty, and check the process exit code / cron log if
  the email never arrived at all.
