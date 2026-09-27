# Decisions Log

Reconstructed from git history (`git log --stat`, 6 commits total, all on
this repo's only real branch lineage) and this session's own verified
context. Ordered chronologically. Each entry states the decision, the
verifiable evidence for it, and the reasoning given at the time (from
commit messages, which were written by the same agent-driven process that
made the decisions).

## 1. Build the parcel/permit/digest pipeline as Google Apps Script (commit `8f11183`)

The project started from an empty repository (verified: this repo had zero
commits and zero branches before this work began). The first implementation
was a set of `.gs` files (`Config.gs`, `Parcels.gs`, `Permits.gs`,
`Digest.gs`, `Triggers.gs`, `SheetSetup.gs`, `SchemaInspector.gs`,
`Tests.gs`, `Utils.gs`, `appsscript.json`) meant to be pasted into the
Apps Script editor bound to the target spreadsheet, per an external build
spec referenced in the commit message. Key constraints set at this point,
which persisted through every later rewrite:
- Never fabricate placeholder/example domain data (parcels, permits,
  listings) to make output look complete.
- A collector that can't get real data must return `[]` and log the gap,
  not fail silently or invent data.
- ArcGIS field names were unverified placeholders from the start (the
  build sandbox couldn't reach the county's ArcGIS endpoints), with an
  explicit `'UNVERIFIED'` sentinel value used to make a schema mismatch
  visible instead of silently wrong.
- The permit collector (Accela Citizen Access) was left intentionally
  stubbed because Accela has no confirmed JSON API and requires manual
  ASP.NET form reverse-engineering against the live portal.

## 2. Replace Apps Script with a standalone Node.js runner (commit `93d2074`)

All `.gs` files were deleted and replaced with an equivalent Node.js
project (`src/`, `bin/`, `test/`). Stated reason (commit message): running
outside the Apps Script sandbox allows hosting on any machine/server via
ordinary cron, rather than being limited to Apps Script's own trigger
system. At this point the architecture used the Google Sheets REST API
(via the `googleapis` npm package) with a full OAuth2 flow
(`src/auth.js`: `credentials.json` + browser consent + cached
`token.json`), and the Gmail API (also OAuth) for sending the digest email.
`src/emailAlerts.js` was introduced as a new stub at this point specifically
because the Zillow/Redfin/Realtor.com email-alert parser referenced by the
original project concept never actually existed anywhere in this repository
(the repo was empty at the start) -- there was nothing to port, so it was
stubbed the same way permits was, rather than invented.

## 3. Add Vercel Cron as a second hosting path (commit `2349b43`)

Vercel serverless functions have a read-only, per-invocation filesystem, so
the file-based OAuth token caching from decision #2 cannot work there, and
there is no way to run an interactive browser consent flow from a scheduled
cron trigger. Rather than replacing the self-hosted cron path, a second,
stateless auth path was added (`getAuthenticatedClientFromEnv()`, building
an OAuth client from `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/
`GOOGLE_REFRESH_TOKEN` env vars), alongside `api/digest.js` (the same
digest logic wrapped as an HTTP handler) and `vercel.json` (cron schedule +
function config). `CRON_SECRET` was introduced here to stop the endpoint
being triggerable by anyone who found the URL, since Vercel automatically
attaches it as a bearer token on cron-triggered requests.

## 4. Fix a crash-vs-error handling gap in `api/digest.js` (commit `21d2b67`)

`src/config.js` throws at module *require-time* if a required env var is
missing. Because `api/digest.js` originally required `src/config.js`
(transitively, via `src/digest.js`) at the top of the file -- outside the
handler's own `try/catch` -- a missing env var crashed the entire Vercel
function invocation (`FUNCTION_INVOCATION_FAILED`, no useful message)
instead of returning the readable JSON error the `try/catch` was written to
produce. Fixed by moving the `require()` calls inside the handler. This bug
was discovered because it was actually hit in production (the user reported
a blank crash page), not found by inspection -- i.e. this was a live
incident, not a design review finding.

## 5. Add a password-gated leads dashboard (commit `78e7839`)

A single static page (`index.html`) plus three new serverless functions
(`api/login.js`, `api/logout.js`, `api/leads.js`) and a signed-cookie
session helper (`src/session.js`). Explicit choices made at this point,
per the commit message and the conversation's earlier clarifying questions:
read-only (no status/notes/archive tracking -- that was deferred), a single
shared password rather than per-user accounts, and parcels-only content
since permits/listings were (and still are) stubs with nothing real to show.
The session mechanism was chosen specifically to avoid needing a database
or session store: the cookie itself carries an expiry timestamp plus an
HMAC keyed by `SESSION_SECRET`, so validation is a pure signature check.

## 6. Replace Google Cloud OAuth entirely with a free Apps Script Web App + Gmail SMTP (commit `9d8dca0`)

The single largest architectural change in the project's history. Driven
directly by the user stating they could not afford (and did not want to
provide payment information for) Google Cloud Console, which the OAuth-based
architecture from decisions #2/#3 required for API access (even though the
Sheets/Gmail API usage itself is free, Google Cloud Console's project/
billing-account setup flow was itself a blocker for this user). Replaced:
- The Sheets REST API + OAuth -> a Google Apps Script "Web App"
  (`apps-script/Code.gs`, new file, meant to be pasted into
  script.google.com directly -- a feature of a regular free Google account,
  not Google Cloud Platform) exposing a small JSON-over-HTTP-POST protocol
  (`get`/`clear`/`update`/`append`/`batchUpdate`/`ensureSheet`), gated by a
  shared secret (`SHEETS_WEBAPP_SECRET`) checked against a Script Property
  on the Apps Script side.
- The Gmail API + OAuth -> plain SMTP via `nodemailer`, authenticated with
  a Gmail App Password (also a regular-account feature, requiring only
  2-Step Verification, no Cloud Console).
- `src/auth.js` and `bin/print-refresh-token.js` were deleted outright --
  nothing in the new architecture needs an OAuth2 client, browser consent
  flow, or refresh token.
- `src/sheets.js` was rewritten to talk to the Web App instead of
  `googleapis`; the `googleapis` dependency was removed from `package.json`
  entirely.
- A deliberate defensive addition at this point: SMTP connect/greeting/
  socket timeouts were capped at 15 seconds (nodemailer's default runs up
  to ~2 minutes), specifically so a misconfigured SMTP connection fails
  fast and still gets logged to `Digest_Log`, rather than hanging past
  Vercel's function duration cap and being killed before anything is
  recorded. This was verified directly: a full `runDailyDigest()` run with
  intentionally-wrong SMTP credentials completed in ~15 seconds and
  correctly logged the failure.

## Standing constraints observed across every decision above

These were never violated across any of the six commits, and should not be
violated going forward:
- No fabricated example/placeholder data for parcels, permits, or listings
  anywhere -- a stub returns `[]` and logs, it never invents rows.
- A schema/config mismatch must be *loud* (an `'UNVERIFIED'` sentinel, a
  thrown error with a specific env var name) rather than silently wrong.
- Every collector failure is isolated (its own `try/catch` in
  `runDailyDigest()`) so one broken piece never blocks or masks the others,
  and every failure is recorded in `Digest_Log`'s `Errors` column -- a
  broken collector must never look identical to "genuinely nothing new."
