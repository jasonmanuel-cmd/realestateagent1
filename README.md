# Kern County Deal Finder -- Parcel/Permit/Digest Extension

This repo currently contains only the new extension pieces described below.
The existing Gmail-alert parser (`collectEmailAlerts()` and friends) is
assumed to already exist in the target Apps Script project and is not
reproduced here -- these files are meant to be added alongside it (e.g. via
`clasp push` or by copying into the Apps Script editor), not to replace it.

## What's here

| File | Purpose |
| --- | --- |
| `appsscript.json` | Manifest (timezone, V8 runtime). If merging into an existing project, don't blindly overwrite its manifest -- merge just the parts you need. |
| `Config.gs` | URLs, sheet names, and the parcel field-name map. **Field names are unverified placeholders** -- see "Before first real run" below. |
| `Utils.gs` | `buildUrl_`, `formatDate_`, `logError_` shared helpers. |
| `SchemaInspector.gs` | `inspectParcelSchema()`, `inspectAssessorLayers()`, `inspectAssessorLayerFields()` -- run manually to get real ArcGIS field names before trusting the collector. |
| `SheetSetup.gs` | `ensureDigestSheetsExist()` -- creates the four new tabs with headers if missing. Runs automatically at the top of `runDailyDigest()`. |
| `Parcels.gs` | `collectParcelData()`, `diffParcels()` -- pulls the vacant-parcels ArcGIS layer, paginates, snapshots it, and diffs against `Parcels_Seen`. |
| `Permits.gs` | `collectPermitData()` -- **intentionally stubbed**, returns `[]` and logs. See "Finishing the permit collector" below. |
| `Digest.gs` | `runDailyDigest()`, `buildDigestBody()` -- runs all three collectors, emails a summary, logs the run. |
| `Triggers.gs` | `setDailyTrigger()` -- installs the daily 6am trigger, idempotently. |
| `Tests.gs` | `runSelfTests_()` -- checks pure helpers only (`buildUrl_`, `formatDate_`) against synthetic, non-domain input. No fabricated parcel/permit/listing data, per spec. |

## Before first real run: confirm the parcel schema (Step 1)

**This build session could not reach `maps.kerncounty.com`, `maps.co.kern.ca.us`,
or `aca-prod.accela.com` -- the sandbox's network egress policy blocks all
three hosts.** So the field names in `Config.gs` (`APN`, `ACREAGE`, `ZONING`,
`STATUS`) are unverified placeholders, not values read off a live response.
Do not run a real daily digest until someone has:

1. Opened this project in the Apps Script editor (where `UrlFetchApp` runs
   on Google's infrastructure, not through whatever network you're
   developing on -- so it *can* reach these hosts even if your dev sandbox
   can't).
2. Run `inspectParcelSchema()` and read the logged field list (View > Logs,
   or the Executions panel).
3. Updated `CONFIG.PARCEL_FIELDS` in `Config.gs` with the real names.
4. Checked whether the logged `editFieldsInfo` includes an `EditDate` field.
   If it does, that's the closest thing to a native "what changed recently"
   signal -- set `CONFIG.PARCEL_FIELDS.EDIT_DATE` to it, and consider
   whether it changes the diffing strategy.
5. Determined the layer's actual refresh cadence (from `editFieldsInfo`, or
   by asking Kern County GIS directly) and set
   `CONFIG.PARCEL_REFRESH_CADENCE_CONFIRMED = true` once known. Until that
   flag is true, the digest email appends a note that "new" parcels are new
   relative to the last successful pull, not necessarily new since
   yesterday -- **do not remove that note or claim "daily new parcels" in
   any user-facing text until the cadence is actually confirmed.**
6. Optionally run `inspectAssessorLayers()` / `inspectAssessorLayerFields(id)`
   to confirm the Assessor layer index (source #3 in the spec). No collector
   currently queries it -- the spec only asked for it to be confirmed, not
   wired into a query -- so this is only needed if/when that's built.

If a field name is wrong, ArcGIS returns `undefined` for it rather than an
error. `writeParcelSnapshot_` in `Parcels.gs` turns any such `undefined`
into the literal string `'UNVERIFIED'` in the sheet, and `diffParcels()`
refuses to treat an `'UNVERIFIED'` APN as new signal. That means a schema
mismatch shows up as a wall of `UNVERIFIED` rows in `Parcels_Snapshot`
instead of a digest that's silently wrong -- if you see that, the field
names in `Config.gs` are wrong; go re-run `inspectParcelSchema()`.

## Finishing the permit collector (Step 5)

`collectPermitData()` in `Permits.gs` is intentionally unfinished, per spec.
Accela Citizen Access has no confirmed JSON API; the Building-module search
is an ASP.NET postback form. Finishing it requires:

1. Loading `https://aca-prod.accela.com/KERNCO/Cap/CapHome.aspx?module=Building`
   in a browser and inspecting the rendered search form (view-source /
   devtools) to get the real field names for a date-range search.
2. Extracting `__VIEWSTATE` / `__EVENTVALIDATION` from the GET response and
   POSTing the search with them.
3. Parsing the results table HTML into
   `[RecordNumber, APN_or_Address, PermitType, Status]` rows.
4. Diffing those against `Permits_Seen` the same way `diffParcels()` diffs
   against `Parcels_Seen` (append new `RecordNumber`s with `FirstSeenDate`).

This has to be done against the live portal by a human with a browser --
it can't be guessed from this codebase, and this build session couldn't
reach `aca-prod.accela.com` to even inspect it. Until it's finished,
`collectPermitData()` returns `[]` and logs a note (visible in
`Digest_Log`'s Errors column) rather than fabricating permit rows.

## Setup

1. Add these files to the existing Kern County Deal Finder Apps Script
   project (merge `appsscript.json` carefully -- don't overwrite existing
   scopes/settings if the project already has some).
2. Run `ensureDigestSheetsExist()` once (or just run `runDailyDigest()`,
   which calls it automatically) to create `Parcels_Snapshot`,
   `Parcels_Seen`, `Permits_Seen`, and `Digest_Log`.
3. Complete "Before first real run" above.
4. Run `setDailyTrigger()` once to install the daily 6am trigger. It checks
   `ScriptApp.getProjectTriggers()` first, so re-running it won't create
   duplicates.
5. Finish the permit collector per "Finishing the permit collector" above
   whenever someone has time at a browser against the live Accela portal.

## Reliability notes

- Every collector (parcels, permits, listings) runs in its own `try/catch`
  in `runDailyDigest()`. A failure in one never blocks the others.
- Every collector failure is pushed into an `errors` array that both shows
  up in the digest email body ("COLLECTOR ERRORS") and gets written to
  `Digest_Log`'s `Errors` column with `EmailSent`/error-count context. A
  broken collector should never look like a quiet "0 new" -- check
  `Digest_Log` if a digest looks suspiciously empty.
