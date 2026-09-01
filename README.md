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
| `src/auth.js` | Google OAuth2 client: loads `credentials.json`, runs a one-time browser consent flow, caches the token in `token.json`, auto-refreshes and persists it on later runs. |
| `src/sheets.js` | Thin wrapper over the Sheets API (`get`/`update`/`append`/`batchUpdate`/`ensureSheetExists`). |
| `src/schemaInspector.js` | `inspectParcelSchema()`, `inspectAssessorLayers()`, `inspectAssessorLayerFields()` — run these to get real ArcGIS field names before trusting the collector. |
| `src/sheetSetup.js` | `ensureDigestSheetsExist()` — creates the four tabs with headers if missing. Runs automatically at the top of every digest run. |
| `src/parcels.js` | `collectParcelData()`, `diffParcels()` — pages through the vacant-parcels ArcGIS layer, snapshots it, diffs against `Parcels_Seen`. |
| `src/permits.js` | `collectPermitData()` — **intentionally stubbed**. See "Finishing the permit collector" below. |
| `src/emailAlerts.js` | `collectEmailAlerts()` — **intentionally stubbed**. See above. |
| `src/digest.js` | `runDailyDigest()` — runs all three collectors, emails a summary via Gmail, logs the run. |
| `bin/setup-sheets.js` | CLI: `npm run setup:sheets` |
| `bin/inspect-schema.js` | CLI: `npm run inspect:parcel-schema` / `inspect:assessor-layers` / `inspect:assessor-fields` |
| `bin/run-digest.js` | CLI: `npm run digest` — this is what you put in cron. |
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

## Scheduling

This is a plain script — schedule it with whatever your OS provides. A
crontab entry for a daily 6am run:

```
0 6 * * * cd /path/to/this/repo && TZ=America/Los_Angeles /usr/bin/node bin/run-digest.js >> digest.log 2>&1
```

`bin/run-digest.js` exits non-zero if any collector or the email send
failed, so cron's own failure-mail (or whatever wraps this) will notice a
bad run even before you check `Digest_Log`.

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
