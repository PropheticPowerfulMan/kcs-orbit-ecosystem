> Release update25November2026: targeted production deployment has now been explicitly authorized. The staging results below remain historical validation evidence. See `ops/jury/production/README.md` and the final deployment record for the actual rollout result.

# KCS Nexus Jury

**Evaluate fairly. Empower excellence.**

Kinshasa Christian School · KCS Orbit Ecosystem  
**Project Designer & Initiator: LOKALA LOMBOTO Jonathan.**

An assessment workspace for individual, group and hybrid projects. It reuses canonical Nexus identities, courses, enrollments, academic periods and the real `TeacherWorkspace` Gradebook. It is a separate PWA and user interface, with an opt-in module inside the existing Nexus API. It does not establish a second student registry or a second institutional password database.

## Current delivery boundary

- Work branch: `feature/nexus-jury-staging-20261125`.
- Official code baseline: `9306a969267d9d7a9013e04bc8c40be5d50a98e5`.
- Staging application: https://staging.kinshasachristianschool.org/jury/
- Corresponding isolated Nexus preview: https://staging.kinshasachristianschool.org/jury-nexus/
- Validation uses synthetic accounts and records in an isolated database; it never edits school production records.
- **No production deployment, production database migration, production DNS change or main-branch merge is authorized by this delivery.**
- The proposed production hostname is a review proposal only: `jury.kinshasachristianschool.org`.
- See `../docs/nexus-jury/IMPLEMENTATION_STATUS.json` and the staging status report for actual evidence, remaining checks and the final Git revision. Native OS installation must not be inferred from manifest validation alone.

## Capabilities

Projects progress through registration, submissions, scheduling, independent evaluation, consolidation, approval, release and archival. Controlled reopening and sensitive decisions require reasons and leave an audit trail. Rubrics are versioned and locked when assessment starts. Criteria support relative weights, individual/group applicability, mandatory requirements, explicit N/A, performance levels and required evidence comments.

Organizers select existing KCS staff or parents, and may personally invite external non-learner judges. Known learner accounts and learner-email bypass attempts are rejected by the server. Invitations expire, are revocable and can be exchanged once; guest sessions remain limited to their project. Each organizer controls their own jury. **Three judges is an example, not a membership limit.** Total memberships have no configured cap; the configurable required quorum is 1–30 and assignment batches are bounded to 50 members per request.

Judges have independent assignments, autosaving drafts, Ctrl+S, explicit submission, optimistic revisions and a reconciliation dialog. Where configured, device drafts are encrypted with AES-GCM and a non-extractable browser key. An encrypted local save is clearly distinguished from a server acknowledgement. Reconnecting synchronizes queued operations; a newer server revision is never silently overwritten. A cold offline restart cannot unlock private drafts until the institutional session reconnects.

Results support decimal arithmetic, mean/weighted mean/median/eligible trimmed mean/president decisions and configurable group/individual blends. Zero is a real result; a missing mandatory assessment remains incomplete. Rankings stay private unless explicitly released and permitted by Nexus result-visibility policy.

Management analytics use real server records, read-only repeatable-read snapshots and precise year/quarter/class/course/project filters. Six selectable views cover assessment progress, score distribution, criterion means, group comparison, project check-in and paired between-judge dispersion. Historical failed synchronization attempts are labelled as history, including recovered retries. They are not a claim that current Gradebook cells are broken; the publication receipt performs the current read-back check.

## Roles and access

| Identity | Jury authority |
|---|---|
| Configured SuperAdmin | Application administration, role grants and project oversight. |
| Principal / Senior Teacher | Academic administration derived from their verified Nexus workspace permissions or an explicit Jury academic grant. |
| Teacher / project owner | Own projects and authorized source courses, rosters, rubrics, juries, results and explicit Gradebook publication. |
| Internal judge, including a selected parent | Assigned project and scoring sheets only; no access to another judge's private marks. |
| Jury President | A role within that panel; it does not itself grant global administration or project ownership. |
| External invited judge | A revocable, expiring, project-scoped guest session. No institutional account is fabricated. |
| Learner | Own authorized portfolio and explicitly released results, further gated by Nexus visibility controls. Never a judge. |

Sensitive endpoints enforce server-side object authorization. Hiding a button is not a permission check. Ordinary ADMIN accounts, for example media accounts, do not automatically become Jury academic administrators.

## Real Gradebook publication

1. Consolidate current submitted evaluations into a new immutable result version.
2. Review incomplete records, quorum, group rules and judge discrepancies.
3. Explicitly approve that result version.
4. Select an authorized course, period, category and new/existing assessment column.
5. Prepare the exact-cell preview. The server records the result version, enrollment identities, destination maximum and expected workspace revision.
6. Explicitly confirm publication, including existing-cell overwrite acknowledgement where required.
7. The backend locks the canonical workspace, checks academic-period access and revisions, writes only the previewed cells, preserves unrelated state, commits and reads the actual Gradebook back.
8. Retain the publication receipt and verify its current reconciliation result.

A 74/100 result becomes 14.8/20 in a column out of 20. Changing the destination maximum does not change the assessed percentage. Retried requests reuse their idempotency claim; repeated publication cannot create duplicate assessment columns. Later manual teacher edits are protected from blind reversal. Publishing a Jury assessment **does not automatically submit course averages or report cards**; existing Nexus workflows remain in charge of those decisions.

## Documents and exports

Eleven genuine institutional PDF formats are available: project evaluation, individual assessment, group assessment, jury scoring, deliberation, final ranking, project attendance, Gradebook synchronization, participation certificates, excellence certificates and jury appreciation certificates. PDF and CSV/XLSX exports enforce the same project permissions.

The official school emblem is copied byte-for-byte from `KCS Nexus/frontend/public/images/kcs.jpg` and appears in the PDF header and watermark. QR codes remain in the footer. Certificate QR links resolve to a revocable public registry record without revealing learner identities or scores. A document reference/fingerprint is not an accredited digital signature. Private report links and files must not be published publicly. Jury uploads stream to private disk, with signature checks, two concurrent streams per API process, an operational free-space reserve and transactionally enforced global/project/uploader quotas. Soft-deleted retained files remain included in storage accounting. Multiple API replicas share database quota checks; physical capacity must be reviewed before scaling.

## Architecture

- `frontend/`: React/TypeScript/Vite, local fonts, responsive sidebar, FR/EN UI and own PWA assets.
- `../KCS Nexus/backend/src/jury/`: authenticated module, policies, projects, decimal scoring, publication, private files, reports, analytics and notification worker.
- `../KCS Nexus/backend/prisma/`: 36 additive Jury models, referential constraints, uniqueness checks and two scoped analytics indexes.
- `../ops/jury/`: isolated staging configuration, reproducible web image and targeted production tooling and retained optional review templates.
- `../docs/nexus-jury/`: architecture, measured QA evidence and professional manuals.

The real Nexus startup calls Jury jobs only when `JURY_ENABLED=true`. Unchanged deployments do not start the Jury worker or expose its routes. Emails use the existing school transport; in-app notices have deterministic outbox identities. SMTP acceptance is not proof of inbox delivery or reading.

## Build and local development

Use the lockfile and an actively supported Node.js runtime. The reviewed web container builds with Node 24; deployment uses the resulting immutable image, not a floating release rebuilt without review.

```sh
cd 'KCS Nexus Jury/frontend'
npm ci --ignore-scripts
npm run build
```

The frontend development proxy expects the Nexus API on port 5000. A development Vite server must remain local/private and is never the production web server. Use `/jury/` as the staging base and `/` only on a separately approved Jury origin. Set `VITE_JURY_API_URL` only when overriding the relative same-origin API route intentionally.

From the repository root, the standalone static web image can be built for staging:

```sh
docker build --build-arg VITE_BASE_PATH=/jury/ -f ops/jury/Dockerfile.web -t kcs/jury-web:REVIEWED_COMMIT .
```

The existing Nexus backend build must include `src`, generated Prisma client/migrations and `assets/jury`. The staging check Dockerfile is an evidence helper pinned to the known Nexus base image; it is not a substitute for the established release pipeline.

## Configuration and secret handling

| Variable | Purpose |
|---|---|
| `JURY_ENABLED` | Explicit opt-in for API routes and notification/reminder worker. |
| `JURY_PUBLIC_URL` | Approved HTTPS application URL with its real path/scope. |
| `JURY_NEXUS_URL` | Canonical return destination in Nexus. |
| `JURY_STORAGE_DIR` | Private persistent attachment directory, never a public static folder. |
| `JURY_DRAFT_MASTER_KEY` | A unique 32-byte base64 wrapping key; keep and back it up outside Git. |
| `JURY_MAX_STORAGE_BYTES` / `JURY_MAX_PROJECT_BYTES` / `JURY_MAX_PERSON_PROJECT_BYTES` | Optional positive storage ceilings; defaults 20 GiB / 2 GiB / 512 MiB. |
| `JURY_MIN_FREE_BYTES` | Free-space safety reserve; default 1 GiB, plus active upload reservations. |
| `VITE_JURY_ENABLED` | Enables the Nexus frontend launcher only in the reviewed Nexus build. |
| `VITE_JURY_PUBLIC_URL` | Approved launcher destination, validated before navigation. |

Reuse the existing Nexus database, JWT security configuration, school SMTP/SMS transport and central calendar configuration. Do not copy production secrets into test fixtures. The `jury.env.example` file intentionally contains no usable key. No external AI provider is configured: suggestions remain explicitly disabled and no learner data is sent to an AI service.

## Staging tests

Fixtures under `ops/jury/staging/fixtures` must run only against the isolated synthetic database. Their database guard rejects a production connection. Test credentials live in a protected file outside the repository and are never committed.

The evidence covers scoring, multiple groups, hybrid weights, twelve judges/eight quorum/four absent judges, zero versus missing, interrupted drafts, concurrent writes, double submit/publish, real stale workspace revision, retry, old-grade/course/year preservation, another genuine TeacherPortal save, actual browser offline encryption/reconnect, private API cache exclusion, tablet/mobile layouts, 11 EN/FR PDF types and authenticated PDF downloads.

Additional scoped lot checks cover all registered family emails for report cards/communiqués, recipient-specific delivery evidence, independent Kitchen credentials, the student session-history dialog, new teacher PDFs, responsive home/timetable views and controlled EduPay loading comparisons. Timing measurements use documented synthetic network conditions and are not a promise about public internet latency.

Native Windows installation is a remaining manual check when the Windows helper cannot verify the browser URL. Chromium manifest/service-worker installability checks passed; that is recorded separately from an OS-installed launch.

## Backup and recovery

Back up **together** the canonical Nexus PostgreSQL database (including every Jury table and the real teacher workspaces), the private Jury file volume and the protected configuration/wrapping key. Keep an encrypted off-server copy with retention and access controls. Off-server storage has not been configured by this lot; a backup on the same VPS cannot cover total server loss.

Use the established production backup procedure and validate restore in a fresh isolated database before any production migration. Never reset/drop an existing school database to test recovery. Check restored schema, grades/workspace revisions, Jury record counts, attachment hashes and certificate references. Test account sessions/one-use invitations must not be assumed appropriate for restoration into a public production service; assess expiry/revocation during recovery.

For ordinary application rollback, restore prior immutable application images and disable the opt-in Jury flag as reviewed. Preserve additive data and private files. A database restore is an incident decision, not a routine way to roll back a web appearance change. See the Technical Documentation for the recovery checklist and actual test evidence.

## Production release and future review sequence

Verified release `b0f6a15cea83e291bdcc8946ac1c7fc2bb7a1516` is deployed at https://kinshasachristianschool.org/jury/. See [production evidence](../docs/nexus-jury/evidence/production-targeted-release.json). The six targeted services are Nexus API/Web, Jury Web, EduPay Web, Kitchen Web and the required proxy route; 22 other active containers are unchanged.

For future releases:

1. Review the branch, test evidence, manuals and the exact affected services.
2. Confirm DNS/TLS and the dedicated Jury URL; no DNS change is implied by this README.
3. Configure the private storage and wrapping key through the secret manager; confirm transport capacity and off-server backups.
4. Build/pin approved images and back up production before additive migrations.
5. Obtain explicit production authorization.
6. Apply only the reviewed migrations, Nexus API/launcher changes and the new Jury web/proxy route, plus separately reviewed Nexus/EduPay/Kitchen web changes from this lot. Preserve every unrelated service image/release setting.
7. Verify existing application health, authorized real-account SSO, canonical Gradebook read-back, receipts, private uploads, notifications and PWA isolation.

`ops/jury/production/compose.override.yml` and the Caddy fragment are review templates only. They were not applied: this release uses the canonical production Compose file and the existing Nexus /jury/ subpath. Existing GitHub Pages deployment runs on main, so this feature branch must not be merged as an implicit staging-only operation.

## Support

Kinshasa Christian School · Macampagne, Ngaliema, Kinshasa, DRC  
+243 895 326 011 · kinshasachristianschool@gmail.com  
https://kinshasachristianschool.org

## Downloadable institutional manuals

- [Project Presentation](../docs/nexus-jury/manuals/KCS_Nexus_Jury_Project_Presentation.pdf) — 7 pages.
- [Illustrated User Guide](../docs/nexus-jury/manuals/KCS_Nexus_Jury_Illustrated_User_Guide.pdf) — 15 pages, genuine staging screenshots.
- [Technical Documentation](../docs/nexus-jury/manuals/KCS_Nexus_Jury_Technical_Documentation.pdf) — 11 pages.
- [Acceptance matrix and operational limits](../docs/nexus-jury/ACCEPTANCE.md).

The official emblem is copied exactly from Nexus public/images/kcs.jpg and used in report headers and watermarks. Every generated report QR remains in the footer.

Final review notes: [bounded review and tested corrections](../docs/nexus-jury/REVIEW_NOTES.md). No hosted security-scan completion is claimed; native OS capture remains manual.
