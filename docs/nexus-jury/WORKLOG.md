# Work log and resumption notes

Workspace: /opt/kcs-orbit/staging/workspaces/nexus-jury-20261125
Branch: feature/nexus-jury-staging-20261125
Baseline: official main 9306a969267d9d7a9013e04bc8c40be5d50a98e5
Evidence: /opt/kcs-orbit/staging/jury-evidence-20261125

IMPORTANT: production is not authorized for this lot. Do not write /opt/kcs-orbit/app or its Git metadata. The old /opt/kcs-orbit/staging working tree shares /opt/kcs-orbit/app/.git, hence the independent clone above. No production code, container, database, volume, environment or DNS change has been made.

## Scope to retain

1. Full KCS Nexus Jury requirements from the user's pasted master prompt: all 28 sections and 30 acceptance tests, staging only, real Gradebook publication, reports and professional PDF documentation.
2. Bidirectional native-PWA-compatible Nexus/election handoffs, also on staging.
3. Kitchen visual-only modernization. No auth, prices, discounts, transactions or order behavior changes.
4. SuperAdmin, Student and Teacher HOME/dashboard pages adopt the newly modernized Principal visual language. Preserve their functionality and data/visibility rules.
5. Jury must have a fully distinct installable PWA, manifest identity, icon, scope and service worker.

## Completed and tested

- Independent clean clone created, Academy submodule initialized at official 4605119ff282d2ca831e749681e616cf44c93c82.
- Existing Nexus, Eduplanner and Academy architecture/styles inspected.
- Real Gradebook stores audited. advancedGradebookByCycle key is courseId::academicYear; assignments store quarter; score key is columnId:StudentProfile.id. Legacy sources remain active for 2026-2027. See ARCHITECTURE.md.
- 36 additive Jury Prisma models appended. First migration generated and validated, not applied to any database. IMPORTANT: schema subsequently made JuryDraftKey.userId optional and added invitationId, so regenerate the migration before applying. Preserve manual new-table-only CHECK constraints and add the draft-key identity XOR check.
- src/jury/scoring.ts uses an isolated Prisma.Decimal clone (precision 40), zero/missing distinction, nested criterion weights, optional NA, comments, five consolidation methods, hybrid scoring, discrepancy flags and tie handling. 17 unit tests PASS; evidence scoring-unit-tests.log.

## Written but not compiled/integrated/tested yet

- src/jury/security.ts: opaque tokens, checksums, origin validation, cookies, AES-GCM wrapping, safe links/filenames/CSV cells.
- src/jury/policy.ts: actors, project object authorization, revision/reason guards, audit helper. Null owner/null guest equality was fixed; keep explicit non-null ownership checks.
- src/jury/auth.ts: database-backed single-use Nexus handoff, guest exchange, revocable sessions, CSRF/account-binding checks, protected device draft-key endpoint. NOT mounted yet. Add final revoked-key check after a concurrent key-creation race. No Jury UI or full controllers exist yet.

## Next technical tasks

- Implement complete project/group/jury/rubric lifecycle, evaluation/save/submit/reopen, scoring consolidation/approval, safe Gradebook preview/idempotent publication/read-back/cancellation/reconciliation, attachments, portfolio, reports/awards/certificates, notification/outbox, permissions and optional AI configuration.
- Mount Jury router and add configured Jury origin to Nexus CORS (no wildcard).
- Build dedicated frontend, vector Jury logo and raster PWA icons; use real pages and working actions, not placeholders.
- Stage under existing HTTPS gateway with separate sibling scopes, e.g. /jury/ and /jury-nexus/, rather than nesting Nexus inside Jury's SW scope. Existing staging routes must be preserved.
- Dedicated synthetic staging services can use one NEW PostgreSQL container with separate Nexus/Orbit/Kitchen databases. Schema-only snapshots and migration-history metadata may be read from prior verified backups; never copy production school records/passwords for tests. Use synthetic canonical Nexus accounts shared by Jury, not a Jury identity database. All outbound email should go to a staging capture service and test networks should block external providers.
- Existing staging gateway is kcs-orbit-staging-gateway-1, connected to kcs-orbit-production_kcs_staging and kcs-orbit-staging_staging_internal. It mounts /opt/kcs-orbit/builds/kcs-kitchen-20260922/ops/staging/Caddyfile. Production proxy already routes STAGING_DOMAIN to staging_gateway:8080. To add previews, write new config inside staging and modify only the staging gateway; never production proxy/production-staging_web.
- ~7.8 GB disk and ~6.7 GB available RAM at audit. Keep resource limits. Do not prune volumes or delete existing backups.
- Complete all tests, build, restart/persistence checks, genuine screenshots and 3 PDF documents + README. PDF skill read at local C:/Users/user/.codex/plugins/cache/openai-primary-runtime/pdf/26.1123.11515/skills/pdf/SKILL.md; user informed. Render/inspect PDFs, use actual app screenshots.
- Final report must use every requested STATUS= key and READY_FOR_PRODUCTION_REVIEW; do not claim unfinished/untested parts work.

## Useful image and testing runtime

Existing tested production image kcs/nexus-api:9306a969267d9d7a9013e04bc8c40be5d50a98e5 contains Prisma CLI, TypeScript, tsx and dependencies. It may be RUN AS A NEW ISOLATED CONTAINER for offline compilation/tests, never modify the running production container. Source mounted read-only, network none. Current API image workdir /workspace/KCS Nexus/backend. `node node_modules/prisma/build/index.js validate --schema /source/prisma/schema.prisma` works. CLI migrate diff from base-schema.prisma can generate additive SQL without connecting to a DB. Separate class-only scoring tests transpiled into /tmp with node_modules symlink to existing runtime passed.

For remote scripts use PowerShell literal here-string piped to `ssh lws-kcs python3 -`; avoid nested Bash heredoc quoting (a read-only audit had a harmless trailing PY parsing error). All remote writes are confined to staging. Local shell writes/SSH require sandbox escalation as provided by tools.

## Added request — EduPay performance
Parent payment tracking and learner list have very slow initial display. Audit backend queries, request waterfalls, payload size and frontend rendering; optimize with measured staging evidence. Preserve financial logic/permissions. No new production authorization.

## Progress after continuation — 25 November
- Backend Jury modules now written: validation, projects, evaluations, publication, live, portfolio, attachments, outbox, reports, PDF layout, routes. API mounted opt-in through JURY_ENABLED in app.ts; configured origin added to CORS only when enabled.
- TeacherWorkspace actual Prisma field is `state` (not stateJson); publisher corrected after compilation. Existing Gradebook recovery behavior copied into Jury gradebookRecovery.ts, canonical term helper isolated; 5 preservation tests added in publication.test.ts, not run yet.
- Whole-backend TypeScript compile passed (COMPILE_EXIT=0) before staging-entry/new publication tests. See compile.log. Last Docker API build failed because production base omits tsconfig; COPY tsconfig added and build restarted. Check api-build.log.
- Migration SQL regenerated correctly from baseline. Initial test transaction rolled back fully because manual constraint extraction duplicated an FK. Fixed by explicitly appending only 7 new-table CHECKs. New staging DB schema applied successfully (STAGING_SCHEMA_APPLY_EXIT=0). No production migration.
- New isolated network kcs-jury-staging-20261125 (internal), container kcs-jury-db-20261125, volume kcs-jury-staging-20261125-db, database/user jury_stage. Private generated synthetic secrets, database.env, api.env under evidence directory, mode0600. Never print contents. No API service running yet. api.env staging domain must be verified against actual stage domain before exposing preview.
- API image build target kcs/jury-api:staging-20261125, Dockerfile ops/jury/staging/Dockerfile.api. New entry src/jury/staging-entry.ts runs app + Jury-only worker and refuses non-staging. Need normal future deployment worker docs/code when production requested later.
- Frontend KCS Nexus Jury/frontend created: package.json pinned existing validated Nexus versions, Vite config, manifest unique id ./kcs-nexus-jury, standalone launch handler, unique SVG logo, strict scoped SW public assets only. No PNG icons yet.
- Frontend src: api.ts, offline.ts (encrypted IDB draft operation queue), ui.tsx, styles.css, ProjectEditor.tsx. Main App/evaluation/project modules NOT written yet. No functional app or frontend build yet. npm install --ignore-scripts running in kcs-jury-frontend-deps-20261125; see frontend-install.log. Need .gitignore for node_modules/dist and lock committed. Distinct PWA still untested.
- API-only project/rubric/groups/notifications/report implementations need integration/security/authorization QA. Reports are not visually checked yet; Greek sigma with Helvetica may need embedded fonts. Certificate download for external judge was permitted with member match; student no-run result DTO minimized. Need test individual/group confidentiality.
- Potential fixes/tests to retain: timer resume must preserve QUESTIONS mode and reject restarting already running timer; EXCUSED candidate eligibility; per-project scope for IDs; offline multi-tab queue race protection (Web Locks or atomic IDB), account switch epoch protection; no local save should be labeled server-saved. Add membership resends/reopen UI and version locking checks.
- EduPay user added performance request. Read AGENTS.md in its root (session:save stages all; user's targeted commits override that broad helper). Source findings and unverified changes in EDUPAY_PERFORMANCE.md: FinanceParentAdminPage now reads existing lightweight /api/parents/options rather than school-wide mirror sync /api/parents; scoped memory initial view; staffRouteWarmup follows it and can warm student data on intent. StudentsDirectoryPage now renders directory independently from classes/catalog rather than awaiting Promise.allSettled, deduplicates refreshes, handles stale/unmounted results, StrictMode cleanup guard. Needs build, API and delayed-catalog browser timing tests. No financial calculation/backend modification for this request.
- No Git commit/push for this lot yet. Production entirely untouched. Still need Kitchen appearance only, 3 Nexus home pages, electoral PWA handoffs, all Jury implementation/tests/docs/delivery.

## Added request — Nexus Teacher and Student Timetable
Completely modernize both timetable page designs, attractive day/week views and mobile presentation; preserve published classes, times, courses and assignments. Staging and targeted Git changes only until explicit production review.

## Added request — EduPay Parents Management appearance
Modernize the legacy Parent Management page and its forms with the current refined finance theme, light/dark contrast and responsive layout. Preserve family records and financial behavior.

## API integration evidence update
The real isolated API test suite now passes 12 workflow groups (API_TEST_EXIT=0 in api-tests.log). It covered canonical Nexus SSO; project/roster; custom rubric/three judges; zero/missing/stale draft; concurrent independent evaluations and duplicate submissions; rubric protection/CSRF/grade secrecy; consolidation and approval; 100→20 preview; atomic publication/idempotent retry/real TeacherPortal workspace GET; unrelated grades/comments/courses/years preserved; reconnect persistence; controlled reopening; a genuine generated PDF. Important: the test formerly named “live teacher workspace conflict prevents stale publication” only tested controlled reopening and unchanged receipt; rename that step and implement a real stale-workspace publication test before claiming that scenario.
Dedicated PWA PNG icons rendered successfully with Playwright. Frontend JSX now parses; first type pass found one inferred navigation tuple issue, explicitly typed and compilation restarted. Check frontend-build.log. Jury API build succeeds, service kcs-jury-api-20261125 is running privately on the isolated network. Extra new API source (self refs, session polling, timer resume) is not yet rebuilt/restarted after that last test.

## Latest state and user clarification
User asked whether Jury is limited to three judges. Answered accurately: three is a test scenario; there is no configured total membership cap per project. minimumJudges 1–30 is the required quorum, not a maximum member count. Add a test with 12 judges/quorum8 before claiming practical capacity.
Frontend build now passes. New stage web kcs-jury-web-20261125 runs non-root/read-only with Nginx on isolated jury network, serving frontend/dist. ops/jury/staging/Caddyfile and gateway.compose.yml were prepared and validated. They preserve all existing routes; the gateway override has NOT yet been applied. Current stage gateway remains on original configuration. PNG icons are present. Need browser tests, including secure PWA installability. API build with new self/session/timer changes was started (see api-build.log) but may not yet be deployed to private Jury API.
Nexus Teacher/Student Timetable visual redesign added as TimetableStudio.tsx + CSS, selected only for those two audiences through WeeklyTimetable.tsx wrapper. Other audiences retain the existing implementation. Data/assignments are not changed. New visuals require Nexus build and browser tests. User also added EduPay Parents Management modernization; tracked, NOT done yet.
PRODUCTION checked: all 27 original containers are running; 26 have healthy Docker checks, proxy has no Docker healthcheck (running). Every container ID/image matches baseline exactly. A public HTTP probe is still needed for proxy. No production mutation, no Git commit/push yet.

## Added request — Student Course Attendance View sessions
Replace the long inline session history with a dedicated responsive dialog, all available attendance/session details, search/date filters and pagination. Preserve recorded data and the distinction between course regularity and official report-card attendance.

## Added request — Teacher course attendance and timetable PDFs
Upgrade Course Attendance Report/PDF and Timetable Export PDF with professional institutional design and QR codes. Timetable MUST place days on horizontal X axis and times on vertical Y axis, with legend/period and useful metadata. Do not change report card/transcript designs or academic records. Student session dialog must always be centered both horizontally and vertically; implemented via Radix portal, fixed50% positioning, inner scroll and visible header/footer; still needs visual tests.

## Teacher document upgrades implemented (unverified)
New dedicated teachingDocuments.ts builds Course Attendance PDF (teacher/learner view, real filtered rows and descriptive charts) and Timetable PDF (X days, Y time; overlapping slots placed in parallel; every slot retained in detailed appendix). QR is vector SVG and contains a document reference/SHA256 snapshot fingerprint without student identity; explicitly not falsely presented as a signature or public certificate. Existing preview/download controls retained. Report card/transcript sources unchanged. Needs compile, real PDF output, QR decoding and full visual review.

## Appearance additions implemented (validation pending)
Principal-style AcademicHomeWelcome and scoped palette/card finish on SuperAdmin, Teacher and Student home dashboards. Existing metrics/actions/visibility preserved. Kitchen CSS-only atelier finish; no auth/menu/discount/order/transaction logic changes. EduPay Parent Management gets a scoped refined hero, statistics, filters, table and modal finish; one duplicate option React key corrected. Needs production builds and real light/dark/mobile browser checks.

## User clarification — QR placement
The QR must remain in the FOOTER. Removed the temporary header placement. Both new teaching documents now reserve a 39mm bottom margin with a repeatable footer containing vector QR, reference, fingerprint, contact details, website and generation time. Re-rendering every page to verify no overlap, clipping or orphan QR page.

## User override — judges must be existing KCS accounts, never learners
This replaces the original master prompt’s external-judge invitations. Eligible: existing active canonical employees (teacher, staff, administrator) and parents. Excluded: any account with STUDENT role or a StudentProfile. The directory includes parents; member creation is now userId-only and rejects noncanonical/external/student identities; student access to evaluation assignments is blocked at runtime. External invitation exchange and old external sessions are disabled. Internal authorizations remain per project; being a parent does not grant Jury access automatically. Tests for employee/parent acceptance and student/external rejection are required before completion.

## FINAL judge-rule clarification (supersedes the preceding internal-only override)
Each teacher/project initiator chooses their own jury from existing KCS employees or parents AND may invite external non-learner people by personal expiring/revocable one-use link. Learners remain prohibited, including attempts to invite an existing learner’s email as an external judge. Internal accounts retain their existing credentials; external guests receive project-scoped access only. No three-judge limit; panel membership count is separate from quorum. No automatic membership/permission changes to other projects. UI supports both selection and invitations, with actual outbox delivery status and a private copyable link. Previous internal-only tests are obsolete for the external-invitation clause and must be replaced.

## Verification checkpoint
Jury scoring/publication unit tests:22 passed. Initial API12 groups and extended6 groups passed, including12judges/quorum8/fourabsent, hybrid74%, group-score allocation, real workspace revision conflict/no mutation, idempotent recovery, ordinary TeacherPortal save, existing-column overwrite acknowledgement. Final policy rerun underway. Browser12 checks passed (real HTTPS Nexus→Jury, public-only SW/offline shell, real documents EN/FR, 600-session modal centered at1440/820/390/320). Teacher document rendering was revised to measured per-page HTML pagination; every page has a true footer with vector QR; local decoding found exactly1QR on each of14test pages. All pages visually inspected, no overlapping footer. Timetable2pages incl detailed register; sample40-row attendance5pages. EduPay full build passed. Nexus build passed before final pagination/footer adjustment, final build still required. Current additions not deployed to production; no Git commit/push yet.

## Added request — SuperAdmin Report Card delivery inventory
Verify and correct real delivery tracking: named recipient, exact report card/PDF attachment, dates, attempts, waiting/sending/failure states, evidence of provider delivery versus parent access/acknowledgement. Never treat SMTP acceptance alone as proof of inbox delivery or reading. Preserve the existing report-card design and delivery targeting/language rules. Use isolated synthetic tests and a capture transport; no unsolicited production test emails.

## Added request — Kitchen consumer password shortcut
Verify the existing /application-access?app=KCS_KITCHEN shortcut, preserve independent application credentials, and retain it only if useful. If retained, replace the ambiguous naked link with explicit FR/EN wording and an integrated modern design. No Kitchen password/auth business behavior change is authorized by this appearance clarification.

## Added request — all linked family emails receive report cards and communiqués
Audit both actual delivery paths: primary parent email, additional emails, linked family-contact emails. Every intended valid address must receive the same message and attachments, with one independently traceable log per address and no duplicate within the same delivery. Preserve recipient targeting, inactive/archive exclusions, email FR/EN choice, and English report-card PDFs. Password-recovery/security notices are outside this fan-out scope. Test against an isolated capture service; no production test messages.

## Family email fan-out correction
Verified existing Report Card dispatch already creates one queue/evidence row per canonical family email with the same English PDF. Fixed the overlooked direct SuperAdmin-to-parent message path: all valid registered family emails are now recorded atomically in the persistent queue against the same internal message/attachment, rather than sending only to the primary address. Targeted parent communications now use verified Nexus/Orbit links instead of name-based email expansion. Shared communication recipients are deduplicated per normalized address/phone; report-card documents remain per child. Changes are staging only and require capture-transport verification.

## Family delivery verification — passed
Five actual HTTP/SMTP-capture flows passed: direct SuperAdmin→parent FR, targeted parent communiqué EN, parent broadcast FR, report card FR email, report card EN email. Each reached all four unique registered family addresses. Twenty real MIME messages were parsed; each contained the correct attachment and byte-identical PDF for its delivery; communiqué text and accented characters were preserved. Report-card retries created no extra deliveries; every address has its own SMTP message ID and acceptance evidence. No real email was sent. This proves our queue/SMTP handoff, not inbox delivery or reading. The parent acknowledgement workflow provides separate explicit confirmation of the email and exact PDF.

## Correct official KCS emblem — explicit user request
Use the exact existing KCS Nexus public asset `KCS Nexus/frontend/public/images/kcs.jpg`, copied byte-for-byte to Jury assets. The same emblem is now used for the PDF header and watermark; no invented/recreated logo. Regenerate all Jury PDFs and visually verify both placements, footer pagination and QR decoding.

## Management analytics and worker integration
Added manager-authorized, read-only analytics on real server records: exact period/course/class/project filters; progress, score distributions, criterion means, group comparisons, candidate check-in and properly paired between-judge dispersion. Counts and charts share a repeatable-read snapshot. Zero/missing distinction and official scoring are unchanged. Two additive indexes applied only to the synthetic database. Historical synchronization incidents are explicitly labelled as historical, including recovered retries. Added an opt-in Jury worker hook to the real Nexus entry point, preserving all existing deployments when JURY_ENABLED is absent/false. External invitation emails now use the organizer's FR/EN interface language and readable Kinshasa expiry dates. Builds and targeted tests required after these changes.

## Final staging verification

Official Nexus public/images/kcs.jpg is used byte-for-byte in Jury report headers/watermarks. Twenty-two Jury PDFs plus four real teacher downloads were rendered and QR-checked on40pages. Three manuals were rendered on33pages. All footer QRs decoded. Explicit SSO identity confirmation, rejected-upload cleanup and pending-result invalidation were added after independent review, rebuilt and retested.36unit tests,13coreAPI groups,6extended groups,3role/report groups,6private-file groups and the dedicated browser regressions pass. Family mail capture verified20messages across5flows, four unique linked addresses per flow. Production remains untouched; no main merge/DNS/release is authorized. Hosted security-scan registration failed; bounded manual review and runtime tests are recorded honestly. Native OS capture/off-server backup configuration remain explicit operational checks.

## 25 November 2026 — authorized targeted production rollout

- PR #87 merged the tested lot; PR #88 adds bounded proxy readiness checking after the first safe application rollback.
- Release b0f6a15cea83e291bdcc8946ac1c7fc2bb7a1516 applied only Nexus API/Web, new Jury Web, EduPay Web, Kitchen Web and the required proxy route. Two additive Jury migrations; no database-container restart or data reset.
- All 22 original unrelated active containers retain IDs/images; academic table row counts and exact ordered hashes match.
- Verified backups before and after deployment; the post-deploy archive includes the actual Jury private volume and wrapping-key file.
- Read-only production browser tests pass on desktop/mobile with no uncaught errors or horizontal overflow. PWA identity/scope is distinct; native OS acceptance remains manual.
- Updated three institutional manuals to the production URL while clearly identifying synthetic staging screenshots.

- Final visual follow-up: PR #90 corrects only Jury frontend emblem sizing. Jury Web release edfca7d731c7e08ef5af642a78823554379bb5b7 passed four staging/four production browser checks and preserved all 27 other active containers. Base lot remains b0f6a15cea83e291bdcc8946ac1c7fc2bb7a1516.
