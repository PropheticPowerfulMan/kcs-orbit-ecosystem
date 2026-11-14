# Super Administration: access, public website and verified presence

## Access control

SuperAdmin → Ecosystem access. Search by name, class, email, Orbit ID or role. Select the exact entity, enter a reason and retype its name or email. Blocking preserves records and passwords. Existing supported institutional API sessions are checked against the central policy, with a maximum five-second policy cache. Registry outages return a temporary verification error rather than allowing an unverified session. The configured SuperAdmin, the acting account and archive restoration are protected.

Every change is audited. The directory displays incomplete propagation explicitly and offers Retry. Restoring access preserves any pre-existing inactive source-account state; it does not resurrect an archived school profile.

**Eduplanner limitation:** its Supabase account ban and browser session guard are implemented, but immediate database enforcement for previously issued JWTs requires applying `LessonPlanAPP/supabase.access-control.sql` in the correct Supabase project after backup. This step was explicitly deferred by the owner. Until its readiness RPC confirms all three restrictive RLS policies, affected access changes remain marked as pending. Do not claim immediate complete revocation for that source.

## Public website

SuperAdmin → Website management provides Pages, News & Events and Gallery & media. Existing news and media actions remain available inside these sections and their existing URLs.

Open a page in the visual editor; choose Text, Photo/background or Link, then click the element. Uploaded photographs use the existing media library. Apply to preview, Save draft, then explicitly Publish. English and French drafts/publications are independent. Public visitors see published values only. The shared editor manages the header/footer. Restore published version restores a draft; it does not publish silently. Concurrent edits require reloading the latest revision. Scripts/arbitrary HTML are never accepted.

## Sentinel presence

Verified school calendars, closure overrides and Kinshasa dates determine expected school days. A confirmed entry counts one presence per school day. An exit without an entry does not prove presence. A justified absence remains an absence, displayed separately as excused. Future dates, weekends and school closures do not create absences. Before the arrival deadline, the day remains pending. Parent/visitor-only identities are not assigned mandatory daily attendance. If the official calendar cannot be verified, statistics remain unavailable instead of inventing absences.

Personal dashboards and operational reports include present days, absences, excused absences, expected days and attendance rate. The personal view refreshes every 30 seconds. Existing movement timestamps and raw ledger records are preserved.

## Release verification

Only affected authentication services and the Nexus/Sentinel/Eduplanner web changes are released. No database schema reset, business-data deletion, password rotation or automatic real-account block is performed. Back up affected databases and release configuration before replacing containers; preserve rollback containers and unrelated services. Run unit/integration tests with synthetic accounts, real isolated API workflows, responsive FR/EN browser checks and official-PDF checks before deployment.
