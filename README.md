# Kern County Deal Finder

Standalone Node.js runner for the parcel collector, permit collector, and
digest/email pipeline. It runs as an ordinary script on your own machine or
server (via cron) — or as a Vercel Cron function — reading/writing a Google
Sheet and sending a daily digest email, **without ever needing Google Cloud
Console, an OAuth client, or a billing account.** Two free, no-Cloud-Console
Google features stand in for those:

- **Spreadsheet access:** a small [Google Apps Script](https://script.google.com)
  "Web App" bound to your spreadsheet (`apps-script/Code.gs`), talking to
  this project over plain HTTP with a shared secret — not the Sheets REST
  API.
- **Email:** Gmail SMTP with an [App Password](https://myaccount.google.com/apppasswords)
  (`src/digest.js`, via `nodemailer`) — not the Gmail API.

Both are features of a regular, free Google account (myaccount.google.com /
script.google.com), separate from Google Cloud Platform. No card on file,
ever.

The Zillow/Redfin/Realtor.com email-alert parser that the original "Kern
County Deal Finder" concept assumed never actually existed in this repo —
it was empty when this build started, so there was nothing to port.
`src/emailAlerts.js` is stubbed the same way the permit collector is: it
returns `[]` and logs, rather than fabricating listing data. Wire in real
Gmail-alert parsing there when you're ready (see the comment in that file).

## Layout

| Path | Purpose |
| --- | --- |
| `apps-script/Code.gs` | **Not part of this Node project's runtime** — paste this into the Apps Script editor bound to your spreadsheet. Implements the Web App that `src/sheets.js` talks to. See "One-time setup" below. |
| `src/config.js` | URLs, sheet tab names, the parcel field-name map, and required env vars. **Field names are unverified placeholders** — see "Before first real run" below. |
| `src/sheets.js` | POSTs to the Apps Script Web App (`get`/`update`/`append`/`batchUpdate`/`ensureSheetExists`), matching what `apps-script/Code.gs` implements. |
| `src/schemaInspector.js` | `inspectParcelSchema()`, `inspectAssessorLayers()`, `inspectAssessorLayerFields()` — run these to get real ArcGIS field names before trusting the collector. |
| `src/sheetSetup.js` | `ensureDigestSheetsExist()` — creates the four tabs with headers if missing. Runs automatically at the top of every digest run. |
| `src/parcels.js` | `collectParcelData()`, `diffParcels()` — pages through the vacant-parcels ArcGIS layer, snapshots it, diffs against `Parcels_Seen`. |
| `src/permits.js` | `collectPermitData()` — **intentionally stubbed**. See "Finishing the permit collector" below. |
| `src/emailAlerts.js` | `collectEmailAlerts()` — **intentionally stubbed**. See above. |
| `src/digest.js` | `runDailyDigest()` — runs all three collectors, emails a summary via Gmail SMTP, logs the run. |
| `bin/setup-sheets.js` | CLI: `npm run setup:sheets` |
| `bin/inspect-schema.js` | CLI: `npm run inspect:parcel-schema` / `inspect:assessor-layers` / `inspect:assessor-fields` |
| `bin/run-digest.js` | CLI: `npm run digest` — this is what you put in cron for a self-hosted machine/server. |
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

2. **Create the spreadsheet.** A blank Google Sheet at [sheets.google.com](https://sheets.google.com) — any account, no special setup. You don't need to create the tabs by hand; step 6 does that.

3. **Deploy the Apps Script Web App.** With that sheet open: **Extensions →
   Apps Script**. Delete the default `Code.gs` contents and paste in this
   repo's `apps-script/Code.gs` instead. Follow the setup comment at the top
   of that file — in short:
   - Set a secret (either run its `setWebAppSecret()` function once after
     editing the placeholder value, or add a Script Property named
     `WEBAPP_SECRET` by hand).
   - **Deploy → New deployment → Web app**, with **Execute as: Me** and
     **Who has access: Anyone**. Authorize when prompted (you're granting
     your own script permission to edit your own sheet).
   - Copy the resulting URL (ends in `/exec`).

   No Cloud Console project, no OAuth consent screen, no billing — Apps
   Script deployment has always been a free feature of a regular Google
   account.

4. **Get a Gmail App Password.** On the Google account you want the digest
   to send from: turn on **2-Step Verification** (myaccount.google.com →
   Security), then generate an **App Password** (Security → App Passwords →
   name it anything, e.g. "kern-county-digest"). Copy the 16-character
   password it shows you (spaces don't matter).

5. **Configure the environment**
   ```
   cp .env.example .env
   ```
   Fill in:
   - `SHEETS_WEBAPP_URL` — the `/exec` URL from step 3.
   - `SHEETS_WEBAPP_SECRET` — the secret you set in step 3.
   - `SMTP_USER` — the Gmail address from step 4.
   - `SMTP_APP_PASSWORD` — the app password from step 4.
   - `DIGEST_TO_EMAIL` — optional, defaults to `SMTP_USER` itself.

6. **Create the sheet tabs**
   ```
   npm run setup:sheets
   ```
   Creates `Parcels_Snapshot`, `Parcels_Seen`, `Permits_Seen`, and
   `Digest_Log` with headers if they don't already exist. (This also runs
   automatically at the start of every digest run, so this step is mostly
   for a quick sanity check that the Web App connection works.)

7. **Confirm the real ArcGIS field names (mandatory before a real run)**
   The field names in `src/config.js` (`APN`, `ACREAGE`, `ZONING`, `STATUS`)
   are placeholders — this build couldn't reach the county's ArcGIS server
   to verify them. Run:
   ```
   npm run inspect:parcel-schema
   ```
   Read the field list it prints and update `PARCEL_FIELDS` in
   `src/config.js` with the real names. If it logs an `editFieldsInfo` block
   with an EditDate field, set `EDIT_DATE` too, note the refresh cadence,
   and flip `PARCEL_REFRESH_CADENCE_CONFIRMED: true` once you actually know
   how often the layer updates — until then, the digest email appends a
   note that "new" parcels are relative to the last pull, not necessarily
   new since yesterday.

   A wrong field name makes ArcGIS return `undefined` rather than an error.
   `src/parcels.js` turns that into the literal string `'UNVERIFIED'` in the
   sheet, and `diffParcels()` refuses to treat an `'UNVERIFIED'` APN as new
   signal — so a schema mismatch shows up as a wall of `UNVERIFIED` rows
   instead of a digest that's silently wrong.

8. **Do a manual test run**
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

Vercel Cron makes an HTTP request to a serverless function on a schedule,
so this repo ships `api/digest.js` (the same `runDailyDigest()`, wrapped as
an HTTP handler) and `vercel.json` (the schedule) as an alternative to
`bin/run-digest.js` + your own cron — pick one, you don't need both. Since
neither the Sheets connection nor email sending needs any local file or
interactive login in this design, there's no extra "get a token for the
server" step like an OAuth-based setup would need — the same env vars from
"One-time setup" work here too. Setup:

1. **Push this repo to a Git provider Vercel can import from** (GitHub,
   GitLab, Bitbucket), then [import it as a new Vercel
   project](https://vercel.com/new). No build command or output directory
   is needed — it's just serverless functions, not a frontend app.

2. **Set environment variables** in Vercel → Project Settings →
   Environment Variables (not in `.env` — that file never leaves your
   machine):
   - `SHEETS_WEBAPP_URL`, `SHEETS_WEBAPP_SECRET`, `SMTP_USER`,
     `SMTP_APP_PASSWORD`, `DIGEST_TO_EMAIL` — same values as local setup.
   - `CRON_SECRET` — make up a long random string. Vercel automatically
     sends it as `Authorization: Bearer <value>` on cron-triggered
     requests; `api/digest.js` checks it and rejects anything else with
     401, so the endpoint can't be triggered by a random visitor who finds
     the URL. Generate one with `openssl rand -hex 32` or similar.

   Redeploy after setting these (or set them before the first deploy).

3. **Check the cron schedule's timezone.** Vercel Cron schedules run in
   **UTC**, not your local time, and don't auto-adjust for daylight saving.
   `vercel.json` ships with `"schedule": "0 13 * * *"`, i.e. 6am Pacific
   Daylight Time (UTC-7) — during Pacific Standard Time (UTC-8, roughly
   Nov–Mar) that becomes 5am local. Adjust the cron string, or accept the
   hour of drift twice a year, or convert to a timezone without DST.

4. **Verify the plan's cron/function limits before relying on this.**
   Vercel's cron frequency limits, function duration caps, and whether cron
   is available at all differ by plan (Hobby vs Pro vs Enterprise) and
   change over time — this build session couldn't reach vercel.com to
   confirm current numbers, so check
   [vercel.com/docs/cron-jobs](https://vercel.com/docs/cron-jobs) and your
   dashboard's plan details yourself. `vercel.json` requests
   `"maxDuration": 60` for the function; a large parcel pull with many
   paginated ArcGIS requests, or a slow SMTP handshake, could run long. The
   SMTP send in `src/digest.js` is capped at a 15-second connect/greeting/
   socket timeout specifically so a bad connection fails fast and still
   gets logged to `Digest_Log`, rather than hanging past Vercel's function
   cap and getting killed before anything is recorded.

5. **Test it manually** before trusting the schedule: from the Vercel
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
sheet.

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
Since this project no longer uses the Gmail API (SMTP + an App Password
only lets you *send* mail, not read it), reading the Zillow/Redfin/
Realtor.com alert emails needs its own decision — options include the
Gmail API with its own OAuth setup (bringing back a Cloud Console
dependency, just scoped to this one piece), IMAP with another App Password
(no Cloud Console, similar to how sending works here), or an Apps
Script-side approach (`GmailApp` inside a script tied to your account,
extending `apps-script/Code.gs` with a new op) if you'd rather keep
everything off Cloud Console entirely. Whichever you pick, land the result
in `collectEmailAlerts()` as an array of row-arrays shaped like what
`buildDigestBody()` in `src/digest.js` expects for listings.

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
- `src/sheets.js` talks to the Apps Script Web App over plain HTTP; if that
  deployment's "Who has access" setting isn't "Anyone", requests get
  redirected to a Google login page instead of hitting the script, which
  shows up as a "returned non-JSON" error pointing at that exact setting.
