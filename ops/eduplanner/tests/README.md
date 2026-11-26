# Eduplanner workflow regression checks

These fixtures contain synthetic school data only. Never point their reset/seed endpoints at production.

- `LessonPlanAPP/server`: `npm ci`, `npm run check`, `npm test` cover canonical role grants, identity binding, independent credentials, durable writes, offline retry, lost acknowledgements across reloads, simultaneous device edits, document hashes, PDF settings and private PWA cache exclusions.
- `role-and-document-browser.cjs`: verified Teacher, Principal, Senior Teacher and SuperAdmin workspaces, reconciliation of a legacy confirmed-email profile, save/reload, exact PDF preview and preservation of current fields.
- `persistence-browser.cjs`: Chromium, Firefox and WebKit; deliberately delayed old cloud replies, Ctrl+S, offline edits and reconnect/reload, preview without a prior manual save, French labels, responsive rendering and private-cache inspection. Each browser uses its own synthetic lesson so concurrent device conflicts are tested independently by the outbox tests.
- `attendance-bottom-browser.cjs`: complete 25-student save from the bottom button, English/French confirmation and a disabled save during an explicitly closed period. The fixture uses Nexus’s canonical `Semester 1 · Quarter 2` key.

Browser runners require Playwright 1.55 and an isolated HTTPS gateway named `planner-qa`, an isolated Nexus database and synthetic Supabase-compatible endpoints. `PLAYWRIGHT_RUNTIME` may identify an existing runtime module. The lesson fixture endpoint and personal test accounts are not part of any production image.

## Jury groups and Kitchen controls

`groupPlanning.test.mjs` covers precise authorized course filtering, unequal team sizes, preservation of saved identities, limits and duplicate detection. `group-integration.cjs` refuses any database other than the isolated `jury_stage` and tests save/readback, atomic duplicate rejection, portfolio protection, EN/FR PDFs and learner denial. `jury-groups-browser.cjs` exercises course search, heterogeneous allocations, member search and explicit confirmed saving. `kitchen-login-check.cjs` checks language/install control bounds and hit targets at 320, 390, 768 and 1440 pixels in FR/EN. These scripts use synthetic accounts only. Browser fixture tokens must be fresh at the start of a test run.
