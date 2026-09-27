# Handoff

Read this first if you are picking up this project cold. Then read
`.ai/PROJECT_STATE.md` (what exists and what's verified working/broken),
`.ai/DECISIONS.md` (why it's built this way, so you don't re-litigate
settled choices), and `.ai/TODO.md` (what's left, in priority order).

## This audit's scope and limits

This handoff and its sibling files (`PROJECT_STATE.md`, `DECISIONS.md`,
`TODO.md`) were created by an audit-only pass: read the repo, its full git
history (6 commits, all on the only branch lineage that exists), and this
conversation's own prior verified tool output (Vercel API responses
obtained directly in-session). **No application code was changed, redesigned,
or refactored to produce these files.** `AGENTS.md` and `CLAUDE.md` were
requested as reading material for this audit but do not exist anywhere in
this repository -- that gap is real, not an oversight in this handoff.

The task that requested this audit also said to commit "all six
project-memory files" but only named four (`PROJECT_STATE.md`,
`DECISIONS.md`, `TODO.md`, `HANDOFF.md`). Only those four were created.
If two more were actually intended, whoever gave that instruction should
clarify which, rather than have a future session guess and invent scope.

## The one thing to do first

**Do not start new feature work before checking the current Vercel
production state.** As of this audit, the live site has been silently
broken (well, loudly broken in the logs, silently broken to end users) for
over three weeks because required environment variables were never set in
Vercel's dashboard. This is `.ai/TODO.md` item #1. Concretely:

1. Check whether `SHEETS_WEBAPP_URL`, `SHEETS_WEBAPP_SECRET`, `SMTP_USER`,
   `SMTP_APP_PASSWORD`, `CRON_SECRET`, `DASHBOARD_PASSWORD`,
   `SESSION_SECRET` are now set on the `realestateagent1` Vercel project
   (project id `prj_80YGTOJX31xJCVHCQ6Lkp4Xh1zMw`, team id
   `team_MewQepiRM85jQWZihGhBeiWt` -- these are resource identifiers, not
   secrets, safe to reuse for lookups).
2. If you have Vercel MCP tools available, `get_runtime_errors` /
   `get_runtime_logs` on that project id will tell you directly whether
   `/api/digest` has succeeded recently, without needing to ask the user.
3. There is a standing monitoring Routine (scheduled trigger id
   `trig_011vRVXZyjAbhqGKRyJAegGP`) checking this exact thing every 4
   hours, self-bound to the Claude session that created it, instructed to
   go quiet unless something changes (success, or a new distinct error).
   If you are that session (or can message it), it already knows the
   current state -- check there before re-deriving it. If you are a
   different agent/session picking this up cold, that Routine keeps running
   independently; don't duplicate it with a second one.

## Working agreements this project has already settled (don't relitigate)

- **Never fabricate example/placeholder domain data** (parcels, permits,
  listings) anywhere, in code or in tests, to make something look more
  finished than it is. A stub returns `[]` and logs. This has held across
  every commit in this repo's history and is treated as non-negotiable.
- **A config/schema mismatch must fail loudly**, not silently: the
  `'UNVERIFIED'` sentinel for ArcGIS field mismatches, the required-env-var
  throw with the exact variable name, the per-collector `try/catch` that
  feeds a visible `errors` array -- all deliberate, all there so a broken
  piece is obviously broken rather than quietly producing wrong output.
- **No Google Cloud Console / OAuth / billing account**, by explicit user
  request over cost, not just convenience. Any future change that would
  reintroduce a Cloud Console dependency (e.g. building the email-alert
  parser via the Gmail API) should be raised with the user first, since
  it conflicts with a decision they specifically asked for. IMAP + App
  Password or an Apps Script `GmailApp` extension are the paths that don't
  have this conflict.
- **Never put secret values in tracked files.** Env var *names* appear
  throughout the code and docs (including these `.ai/` files); actual
  values never do, and `.gitignore` already excludes `.env`,
  `credentials.json`, and `token.json`. Keep it that way.

## Where the canonical human-facing docs live

`README.md` at the repo root is the maintained, detailed setup/ops guide
(one-time setup, both hosting paths, the dashboard, how to finish the
stubs). These `.ai/` files are oriented at an *agent* picking up mid-task;
they summarize and cross-reference, they don't replace README.md. If
something in README.md and something here ever disagree, treat README.md
as more likely current for user-facing setup steps, and treat these `.ai/`
files as more likely current for decision history and audit-time state --
then reconcile and fix whichever is stale.

## Recommended exact next step

Confirm live production state (per "The one thing to do first" above)
before touching anything else. If it's still broken on the missing env
vars, that's a Vercel dashboard configuration task for the user, not a code
task -- don't go looking for a code fix that doesn't exist. If it's fixed,
move to `.ai/TODO.md` item #2 (confirming real ArcGIS field names), since
everything downstream of the parcel collector depends on it.
