# KCS Nexus Jury — staging architecture

Baseline: official ecosystem main `9306a969267d9d7a9013e04bc8c40be5d50a98e5`.
Independent checkout: `/opt/kcs-orbit/staging/workspaces/nexus-jury-20261125`.
Feature branch: `feature/nexus-jury-staging-20261125`. No production authorization.

The dedicated React/TypeScript PWA calls a gated module of the existing Nexus Express/Prisma API. Canonical Nexus users, courses, enrollments and TeacherWorkspace remain authoritative. Thirty-six additive Jury models preserve panel, rubric, evaluation, result and publication versions. Internal access uses one-use Nexus tickets and revocable application sessions. Guest invitations are expiring one-use project capabilities, not new institutional passwords.

## Real Gradebook contract

A publication binds an approved immutable result, canonical roster, course, year, quarter, target assessment and workspace revision. The existing academic-period lock and TeacherWorkspace row lock protect the write. Only selected column/cells and compatible legacy mirrors are patched; unrelated comments, categories, courses, years and workspace state are preserved. The ledger claim, destination cells and receipt are committed atomically in one PostgreSQL transaction. Stale revisions abort; retries reuse the original claim; read-back proves actual cells. Controlled reversal refuses to erase later manual changes. Existing TeacherPortal saves are covered by integration tests.

## Scoring and roles

Decimal arithmetic distinguishes zero, missing and allowed N/A. Criteria/section weights, individual/group/hybrid scoring, mean, weighted mean, median, eligible trimmed mean and explicit president scoring are tested. Rubric and result versions remain immutable after protected transitions. The initiator chooses active employees, parents and permitted external non-learners; no three-member limit exists. Quorum is separately bounded 1–30 and assignment request batches at 50. Academic oversight, project ownership, panel roles and learner portfolio access are distinct permissions.

## Files, queues and PWA

Private files stream to disk with access control, signatures, hashes, 100 MiB file limits, per-process concurrency, free-space reserve and transactionally serialized quotas. Soft-deleted retained files count. Antivirus is not configured. Gated workers claim persistent notifications before network delivery. Jury caches only allowlisted public assets. Offline evaluation operations are account-bound and AES-GCM encrypted; acknowledgement, conflict and pending states remain distinct. Browser storage eviction/cold offline unlock are not guaranteed.

## Staging evidence and production boundary

HTTPS `/jury/` hosts the built standalone non-root static image; `/jury-nexus/` is a private synthetic Nexus preview. Labelled PostgreSQL/API/browser/SMTP fixtures are isolated. Tests send no real school mail. Restoring the synthetic backup into a fresh isolated database preserved table counts, exact workspace/grade/evaluation hashes and private-file hashes. Off-server backup storage is still unconfigured. Native Windows PWA installation remains a manual acceptance check: the desktop helper could not validate the browser URL and available headless CDP runtimes did not implement PWA.install.

Unapplied production templates in `ops/jury/production` are review material only. DNS, school databases, production containers, secrets and volumes remain unchanged. See the application README, acceptance matrix and technical PDF for complete contracts and operational limits.
