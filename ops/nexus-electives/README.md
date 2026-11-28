# Nexus learner experience and classroom passes — 28 November 2026

This lot deploys **Nexus API and Nexus Web only**. Other ecosystem apps are audited for mandatory update behavior, without redeploying them. No gradebook, attendance calculation, existing official PDF layout or elective allocation algorithm is replaced.

## Delivered behavior
- Electives: role-specific catalogue, searchable course details, real course editing and approval, six ordered preferences, explicit server-save status, lifecycle confirmations, allocations and FR/EN guide. Unsaved changes survive view changes; leaving or changing cycles requires confirmation. Published allocations do not automatically rewrite academic enrollments.
- Student: bounded notifications, official report-card viewer using the canonical document engine, filtered/paged official attendance, private mailbox, explicit Nexus-only or Nexus+email channel and idempotent sends.
- Parent: modern official transcript using the shared PDF engine and RC-style filename; child-only read-only distance-learning presence based on the live media server, not stale connection events.
- Principal: Whole school selects all 15 classes; precise messaging search and role/class filters; redesigned teacher reports; centered read-only canonical report-card preview; remote learning retains the Principal workspace, including the historical ADMIN account.
- Administrative staff: modern role-specific home, shared organized report/message views and consistent light/dark layouts. No new permissions are granted by visual changes.
- Shining Student: teacher access restored, automatic main-teacher supervision or active KCS teacher selected by the learner/main teacher, persisted and audited; concurrent edits cannot silently overwrite one another.
- SuperAdmin distance-learning report: schoolwide filters, responsible teacher, course, status, resources, participants, verified current connection, connection history and completed durations. Connection is not official attendance or proof of attention.
- Three physical passes per teacher: Bathroom, Hallpass and Kitchen. Server-timed issue/return, active-badge and active-learner uniqueness, audited administrative returns, names/year/period snapshots and filters/statistics by learner, purpose, day, month and year. No grade or official absence is created.
- Light-mode legacy blue action buttons use the current muted blue; official documents and dark mode retain their own styles.

## Regression checks

Use an isolated synthetic QA database only. `workflow.mjs` and `extended.mjs` explicitly reject a non-QA database. They use `/evidence/fixtures.private.json` and private environment configuration mounted by the staging runner; these files must never be committed. No real school recipients are used. The browser scripts use `/qa/fixtures.private.json` and the bundled Playwright runtime at `/runtime`; resulting screenshots stay in the protected evidence directory.

- 14 unit tests: direct-recipient mailbox isolation, elective allocation, official transcript renderer and safe filename.
- 28 workflow API checks: student confidentiality, delivery channel/idempotence, elective proposal/approval/preference/allocation/publication cycle.
- 29 extended API checks: pass concurrency, permissions, return/audit/history/statistics, legacy Principal, supervision concurrency, family isolation and true LiveKit presence.
- 106 responsive/language/theme browser cases, 32 additional administrative-staff page checks and 8 discipline/report cases, plus direct parent transcript and save/reload tests.
- Mandatory update behavior verified on the 11 published applications, plus work/in-flight-write/offline-queue protection. An up-to-date client correctly shows no update prompt.

## Deployment and recovery

1. Test staging and build the two candidate images. Record their immutable image IDs.
2. Commit/push this scoped lot and merge the reviewed branch; verify the merged tree matches the tested tree.
3. Confirm production clean and healthy, record academic-data fingerprints and every service/image identity.
4. Create and verify the existing full pre-deployment backup.
5. Tag tested images with the merged SHA; run `ops/production/deploy-nexus.sh <sha>`. This changes only `nexus_api` and `nexus_web` with `--no-deps --no-build --wait`.
6. The API runs `prisma migrate deploy`. The sole new migration creates `ClassroomPassSession` and its indexes/constraints. Existing academic rows are untouched.
7. Verify migration state, academic data and public HTTPS; check every other service keeps its existing container and image. Retain the previous two image pins for rollback. The new additive table can remain if application images are rolled back.

External backup replication remains prepared but unconfigured until the school supplies its destination. This release does not claim off-server recovery is configured.

## Discipline Director integration

The Discipline Director has a Classroom passes menu entry, a school-year movement summary on Overview and Reports, and schoolwide supervision of every teacher’s issued/returned pass. Exact grade (K3–Grade 12), learner/teacher/course search, purpose, status and date filters apply to both the history and its PDF. Authorized leadership can confirm a return on a teacher’s behalf only with an audited reason.

The PDF endpoint uses a consistent database snapshot and exports all matching rows, not merely the visible page. Exports over 5,000 exits require narrower filters rather than silently losing rows. The document embeds the KCS logo and watermark, includes individual/purpose/date statistics, complete chronological details, page numbering, school contacts and a footer QR carrying the server snapshot fingerprint without learner personal data. The QR is an integrity reference, not an electronic signature or proof of official attendance.

Additional checks: 10 discipline API cases (including 65-row export completeness, exact grade matching, role restrictions and fingerprint correctness), 8 FR/EN responsive/light/dark browser cases, actual PDF download and rendered-page review.
