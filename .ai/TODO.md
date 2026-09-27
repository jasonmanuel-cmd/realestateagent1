# TODO / Unfinished Work

Ordered by priority. Each item states what's missing, why, and how to
verify it's actually done (not just "looks done").

## 1. BLOCKING: Set the required environment variables in the live Vercel project

**Verified broken as of this audit.** The production Vercel project
(`realestateagent1`, project id `prj_80YGTOJX31xJCVHCQ6Lkp4Xh1zMw`, team id
`team_MewQepiRM85jQWZihGhBeiWt`) only has two env vars set --
`SPREADSHEET_ID` and `DIGEST_TO_EMAIL`, both empty, both leftovers from a
prior architecture this repo no longer uses. None of the seven env vars
the current code requires are set:
`SHEETS_WEBAPP_URL`, `SHEETS_WEBAPP_SECRET`, `SMTP_USER`,
`SMTP_APP_PASSWORD`, `CRON_SECRET`, `DASHBOARD_PASSWORD`, `SESSION_SECRET`.

Every scheduled `/api/digest` cron run from 2026-09-02 through at least
2026-09-27 has failed with the same error
(`Missing required env var SHEETS_WEBAPP_URL`), confirmed via Vercel's
`get_runtime_errors` API repeatedly across several days.

**To fix:** in Vercel -> `realestateagent1` project -> Settings ->
Environment Variables, add all seven (see `README.md` "Hosting on Vercel"
and "Leads dashboard" sections for what each one is and how to obtain its
value -- do not put real values in this repo's tracked files). Redeploy
after setting them (env var changes don't apply to an already-running
deployment).

**To verify it's actually fixed** (don't just assume): check Vercel's
runtime logs/errors for a *new* successful (200/207) invocation of
`/api/digest`, or manually trigger it with
`curl -H "Authorization: Bearer <CRON_SECRET>" https://realestateagent1.vercel.app/api/digest`
and confirm a 200/207 JSON response, then check the spreadsheet's
`Digest_Log` tab for a row with `EmailSent = TRUE`.

## 2. Confirm real ArcGIS field names for the parcel collector

`src/config.js`'s `PARCEL_FIELDS` (`APN`, `ACREAGE`, `ZONING`, `STATUS`) are
explicitly unverified placeholders -- every session that's touched this repo
has had its outbound network blocked from reaching
`maps.kerncounty.com`/`maps.co.kern.ca.us`, so these have never been checked
against the live ArcGIS schema. Run `npm run inspect:parcel-schema` (this
must be run somewhere with real network access -- e.g. locally on the
user's machine, not a sandboxed build session) and update `PARCEL_FIELDS`
with the real field names it prints. Until this is done, expect
`Parcels_Snapshot` to fill with the literal string `'UNVERIFIED'` in every
cell instead of real data.

## 3. Determine the parcel layer's actual refresh cadence

`PARCEL_REFRESH_CADENCE_CONFIRMED` in `src/config.js` is hardcoded `false`.
Check the `editFieldsInfo` block that `inspectParcelSchema()` prints (task
#2) for a native EditDate field, or ask Kern County GIS directly, then flip
this to `true` once actually known. Until then, every digest email carries
a disclaimer that "new" parcels are relative to the last successful pull,
not necessarily new since yesterday.

## 4. Finish the permit collector (`src/permits.js`)

Currently returns `[]` and logs, by design -- not a bug. Accela Citizen
Access (`aca-prod.accela.com`) has no confirmed JSON API; the Building
module search is an ASP.NET postback form. Finishing this requires a human
with a browser to inspect the live rendered form (view-source/devtools),
capture the real field names, extract `__VIEWSTATE`/`__EVENTVALIDATION`
from the GET response, POST a date-range search with them, parse the
results table into `[RecordNumber, APN_or_Address, PermitType, Status]`
rows, and diff those against `Permits_Seen` the same way `diffParcels()`
diffs against `Parcels_Seen`. This cannot be done from a sandboxed session
that can't reach the live portal.

## 5. Build the real email-alert parser (`src/emailAlerts.js`)

Currently returns `[]` and logs, by design. The Zillow/Redfin/Realtor.com
email-alert parser referenced by the original project concept never
existed anywhere in this repository's history -- there was nothing to
port. Building it requires a decision the repo doesn't currently make for
you: how to read Gmail. Options noted in README.md: the Gmail API with its
own OAuth setup (reintroduces a Cloud Console dependency, scoped to just
this piece), IMAP with another App Password (stays off Cloud Console,
consistent with decision #6 in `DECISIONS.md`), or extending
`apps-script/Code.gs` with a `GmailApp`-based op (also stays off Cloud
Console). Whichever is chosen, the output must be an array of row-arrays
shaped like what `buildDigestBody()` in `src/digest.js` expects for
listings.

## 6. Resolve the duplicate Vercel project

A second Vercel project, `realestateagent1-claude-kern-county-extensions-2xy3zq`
(different `.vercel.app` domain, also deployed and `READY`), is pointed at
the same GitHub repository. This was flagged to the user in conversation
but never confirmed as intentional or resolved. It will have the identical
missing-env-var problem as the main project once/if anyone tries to use
it. Someone should either configure it properly (if it's meant to be a
separate/staging deployment) or delete it (if it was created by accident)
to avoid confusion about which URL is "the" site.

## 7. Confirm the Apps Script Web App deployment is actually live

The user was walked through pasting `apps-script/Code.gs` into
script.google.com, setting a Script Property `WEBAPP_SECRET`, and deploying
it as a Web App with "Execute as: Me" / "Who has access: Anyone". Whether
this was actually completed has not been confirmed from this side -- the
persisting `SHEETS_WEBAPP_URL` error in Vercel is consistent with either
"Vercel env vars never set" or "Apps Script Web App never deployed" (or
both); item #1's verification step will help distinguish once the env vars
are set.

## 8. Extend the dashboard once permits/listings are real

`api/leads.js` and `index.html` only show parcels today (see
`DECISIONS.md` #5 for why). Once items #4 and/or #5 are done, add sections
for permits/listings following the same pattern: a `/api/*.js` JSON
endpoint gated by `isValidSession()`, rendered as a table in `index.html`.

## 9. No CI/CD

There is no `.github/workflows` or other CI configuration anywhere in this
repo. `npm test` only runs when a human runs it manually. Consider adding
a CI workflow if/when that becomes worth the setup cost -- not urgent given
the project's current size and single-maintainer usage.

## Explicitly NOT on this list

Do not "fix" the stubs in `src/permits.js` or `src/emailAlerts.js` by
having them return fabricated example rows to make the digest "look
complete" -- this is a hard constraint carried through the entire project
history (see `DECISIONS.md`), not an oversight to correct.
