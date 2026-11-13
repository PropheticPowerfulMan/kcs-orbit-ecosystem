# Nexus official documents and Sentinel staff attendance

Certificate/transcript parent delivery uses the persisted correspondence queue, shared PDF attachments and linked-parent checks. Email language is chosen independently (FR/EN); attached official documents are always English. Delivery retries reuse the request identifier. The UI sends at most ten learners per request.

Transcripts include approved Nexus results and verified Grade 9–12 legacy imports. Historical approval grade snapshots take precedence; unknown historical classes require verification. Summary credits are counted once per course/year. Annual results take precedence; otherwise the existing report-card quarter/semester aggregation is used. QR codes resolve to the KCS verification register; SHA-256 references are not a qualified external PKI signature or third-party accreditation.

## Staff synchronization

Configure one dedicated random secret of at least 32 characters in private deployment environment files:
- Sentinel API: `NEXUS_ATTENDANCE_SYNC_KEY`
- Nexus API: `SENTINEL_ATTENDANCE_SYNC_KEY`
- Nexus API: `SENTINEL_API_URL=http://sentinel_api:4000`

Do not reuse the Orbit registry key or a login password. Do not commit secrets. The key authorizes only the read-only employee attendance export, using `x-kcs-nexus-key`. Students, parents and visitors are excluded.

Nexus refreshes current-day data every five seconds and backfills the active published academic year in seven-day batches on startup and every six hours. The admin screen refreshes every ten seconds, pausing while manual edits are unsaved. Actual first entry and last exit are shown in Africa/Kinshasa time. Approved absence justifications are imported as EXCUSED; missing scans do not imply ABSENT. School-day and explicit closed-period guards apply. Existing manual records remain authoritative; failures preserve saved records. Sync state is retained under audit id `nexus-sentinel-staff-attendance-sync`.

Deployment scope: Nexus API/Web and Sentinel API only. No schema migration, grade data rewrite, Sentinel Web or Kitchen release is required. Back up both affected databases and protected deployment configuration before replacing these services; keep previous containers for rollback.

Runtime regression contracts are in `ops/staging/tests/nexus-sentinel-staff-sync-contract.cjs` (run from the compiled Nexus backend image) and `ops/staging/tests/sentinel-nexus-export-contract.cjs` (run from the Sentinel API image). They use synthetic data and mock database adapters; never supply a production environment file. Pure transcript aggregation tests are compiled from `backend/src/utils/transcriptRecords.test.ts`.

Main-teacher report-card visibility is refreshed after each hide/restore operation without discarding typed comments. Submission excludes hidden courses from readiness checks and the credit-weighted average, preserves saved visibility when old clients omit the field, and re-reads the saved selection/average. The hidden-course runtime contract is `ops/staging/tests/nexus-hidden-report-submission-contract.cjs`.
