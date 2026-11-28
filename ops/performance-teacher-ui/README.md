# Nexus learning experience and Value Word — 28 November 2026

## Published grades and teacher tools

Published grades use compact searchable cards and the existing result values. Missing results remain neutral; zero remains a real result. A shared presentation palette is used by the student course overview, teacher live performance and parent results. No grading, GPA, report-card or transcript formula is changed.

The teacher assistant uses an accessible centred dialog with six existing task endpoints, refinement, error/retry and restored focus. Its inline result replaces the generic success popup for this endpoint only. Classroom-pass selection starts with actual teacher courses and verified enrolments, with class/section/name filters and an explicit selected learner. Server issuance authorization remains in force.

## Assembly · Value Word

All Nexus dashboards have an Assembly · Value Word entry. Everyone can read the published programme and its academic-year history. A scheduled speaker can update only their own future topic and scripture. The SuperAdmin and Principal in the direction workspace can configure the rotation, exclude people from future automatic turns, adjust individual assignments, cancel with a reason and confirm completion after an assembly.

Defaults: 08:00–08:30 Africa/Kinshasa. Teachers rotate fairly; Friday is initially the configurable staff turn, with teacher fallback. A five-minute persistent worker fills the next six weeks starting at least seven days ahead, using the published central calendar, non-school days and public-holiday policy. It preserves existing assignments, history and manually cancelled dates. It does not mark an intervention as completed without confirmation. Pausing automatic planning preserves published turns and their reminders.

The speaker receives Nexus plus email reminders at seven, three and one day before the assembly. Everyone receives the week’s programme in Nexus only: no community email campaign or SMS is created. Delivery rows and deterministic notification identifiers prevent duplicates across restarts/concurrent passes. A late recovery sends the latest due reminder instead of three obsolete reminders together. Missing email is visible, Nexus delivery still works, and an email added later is picked up automatically. The existing durable mail queue performs sending/retries; a queued email is not shown as proof of reading.

The SuperAdmin session is resolved to its actual database account for reading and acknowledging its own notifications. Media can read and manage only its own notifications; website permissions do not grant direction controls.

A change increments the assignment revision, invalidates obsolete queued reminders and publishes an updated Nexus notice. The outbound recipient gate also rejects stale, cancelled or elapsed assignment mail. Lost calendar availability fails safely instead of cancelling all assignments. Compare-and-save versions reject stale edits. User-linked speaker rows become snapshots on account deletion; previous years remain searchable.

## Release boundaries

Only Nexus API/Web are release targets. One additive Prisma migration creates ValueWordAssignment, ValueWordDelivery and ValueWordSettings. Existing grades, attendance, report cards, courses, enrolments and archive tables are not modified by this migration. No other application image, password, credential or PWA manifest is changed.

Tests live in `tests/`. They run against the explicitly guarded synthetic staging database with fake Orbit and captured SMTP. No real school accounts or mail recipients are used. Browser coverage includes light/dark, FR/EN, mobile/tablet/desktop, student/teacher/parent/direction and the course-scoped learner picker. The production procedure requires these checks, matching tested images, an exact GitHub source tree, a verified production backup and Nexus-only health checks. The previous Nexus images and environment pins are retained for rollback; additive tables can remain if the application images are rolled back.
