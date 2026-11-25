# Staging acceptance — 25 November 2026

All school records in these tests are synthetic canonical fixtures. PASS describes observed test behavior, not a guarantee against every future failure. Staging fixtures never target production. The separately authorized production rollout is recorded below.

| # | Scenario | Result | Evidence |
|---|---|---|---|
| 1 | Individual project with three independent judges | PASS | [result](evidence/api-test-results.json) |
| 2 | Group assessment and member allocation | PASS | [result](evidence/extended-api-results.json) |
| 3 | Hybrid individual/group scoring | PASS | [result](evidence/extended-api-results.json) |
| 4 | Custom criteria and protected rubric versions | PASS | [result](evidence/api-test-results.json) |
| 5 | A genuine zero mark | PASS | [result](evidence/api-test-results.json) |
| 6 | Missing marks remain incomplete | PASS | [result](evidence/api-test-results.json) |
| 7 | Absent judges and required quorum | PASS | [result](evidence/extended-api-results.json) |
| 8 | Interrupted browser evaluation resumes | PASS | [result](evidence/jury-reliability-results.json) |
| 9 | Concurrent independent judges and stale revisions | PASS | [result](evidence/api-test-results.json) |
| 10 | Lost response after actual commit | PASS | [result](evidence/jury-reliability-results.json) |
| 11 | Saved draft resumes | PASS | [result](evidence/jury-reliability-results.json) |
| 12 | Repeated evaluation submission | PASS | [result](evidence/api-test-results.json) |
| 13 | Repeated publication does not duplicate | PASS | [result](evidence/api-test-results.json) |
| 14 | Create actual Gradebook assessment column | PASS | [result](evidence/api-test-results.json) |
| 15 | Publish to existing column with explicit preview | PASS | [result](evidence/extended-api-results.json) |
| 16 | Normalize /100 to /20 | PASS | [result](evidence/api-test-results.json) |
| 17 | Preserve old grades and comments | PASS | [result](evidence/api-test-results.json) |
| 18 | Preserve other courses | PASS | [result](evidence/api-test-results.json) |
| 19 | Preserve other years | PASS | [result](evidence/api-test-results.json) |
| 20 | TeacherWorkspace revision conflict is atomic | PASS | [result](evidence/extended-api-results.json) |
| 21 | Unauthorized user/object access denied | PASS | [result](evidence/api-test-results.json) |
| 22 | Controlled evaluation reopening | PASS | [result](evidence/api-test-results.json) |
| 23 | Synchronization failure leaves no partial cells | PASS | [result](evidence/extended-api-results.json) |
| 24 | Fresh preview then idempotent recovery | PASS | [result](evidence/extended-api-results.json) |
| 25 | Browser refresh persistence | PASS | [result](evidence/jury-reliability-results.json) |
| 26 | New institutional session persistence | PASS | [result](evidence/api-test-results.json) |
| 27 | Another genuine TeacherPortal PUT preserves marks | PASS | [result](evidence/extended-api-results.json) |
| 28 | All PDF types EN/FR, correct logo/footer QR | PASS | [result](evidence/roles-reports-results.json) |
| 29 | Independent PWA installation and native OS launch | PARTIAL | [result](evidence/pwa-modern-install.json) |
| 30 | Tablet and mobile evaluation | PASS | [result](evidence/jury-reliability-results.json) |

## Additional verified work

- 36 unit tests passed; 13 core API, 6 extended workflow, 3 role/report, 5 delivery inventory, 5 family-email, 6 private-file, 4 dashboard and 2 invitation workflow groups passed.
- Actual HTTPS browser tests exercise encrypted offline/reconnect, autosave/Ctrl+S, the lost-response-after-commit case, seven canonical roles, and responsive 320/390/820/1440 widths. Screenshots are real staging interfaces with synthetic training records.
- Twenty-two Jury PDFs (eleven types, EN/FR) plus four actual teacher downloads were rendered: 40 pages with one decodable QR each, in the footer. Three documentation PDFs add 33 rendered/inspected pages, each with one footer QR. Official emblem bytes match `KCS Nexus/frontend/public/images/kcs.jpg` exactly.
- Five real HTTP → private SMTP-capture flows produced twenty independent family-address messages. Each flow carried the same PDF bytes to four unique family addresses. No real parent mailbox was used. SMTP acceptance and explicit exact-PDF acknowledgement remain separate evidence.
- Kitchen changes are visual/wording only. The consumer credential regression test proves independent Kitchen and Nexus hashes. Actual CSS/build and read-only fixture views cover login, consumer and manager in both themes and four widths.
- EduPay controlled browser measurements: parent first record 3408→215 ms, learner 3358→215 ms, while unrelated catalog/classes take 3000 ms. These are controlled local comparisons, not production-network promises. Parents Management also passed both-theme/four-width layout checks.
- Synthetic backup restoration used a fresh isolated database and matched business counts, exact Gradebook/evaluation hashes and all private-file hashes. Off-server storage is not configured.

## Remaining manual/operational acceptance

PWA manifest identity, scope, public-only service-worker caching, offline shell and Chromium installability criteria passed. Native Windows install/launch and device-specific Nexus↔election/Academy capture remain manual: the Windows helper stopped before input because it could not verify the browser URL, and headless Chromium 140/156 did not expose an implemented PWA.install command. Public manifests are distinct and canonical openerless handoffs are preserved; the OS decides installed-app capture.

Production was deployed on 25 November 2026 using two additive Jury migrations and only the six reviewed services. No DNS change or real-account provisioning was required. Real-provider delivery capacity and the external backup destination remain operational acceptance items. Optional AI remains disabled until explicitly configured. Security review status is recorded separately after the immutable patch review.

## Final integrity follow-up

The current core suite also proves that a changed candidate/participant invalidates the pending result and prevents approval until reconsolidation. Private-file tests repeat malformed multipart metadata and compare actual private-directory contents and database counts: denied requests leave neither an orphan file nor a quota bypass. The real browser identity-intent test confirms that cancellation preserves the existing session and that an explicitly confirmed account switch still works. All fixture login helpers use the preview/confirmed-reference contract.

The hosted security scan could not be registered despite a validated Git worktree; no tool-owned scan or sealed report exists. Three independent source reviews and targeted runtime regressions were completed instead. See REVIEW_NOTES.md for the exact scope and limits; these are implementation review notes, not a substitute canonical scan artifact.

## Authorized production verification

Release `b0f6a15cea83e291bdcc8946ac1c7fc2bb7a1516` is deployed at https://kinshasachristianschool.org/jury/. Five immutable application images and the required proxy route were applied. All 22 other original active containers retain their IDs and image digests. All 21 teacher workspaces and 2,871 Grade records retain their exact pre-rollout fingerprints. Read-only Chromium checks pass for eight public application pages across desktop/mobile; Jury has its own manifest identity and /jury/ scope.

Complete verified backups preceded deployment. A verified post-deploy archive includes seven PostgreSQL databases, the private Jury volume and the exact protected wrapping-key file. Off-server storage is not configured. The first rollout safely restored target images when an early HTTPS probe preceded proxy readiness; the bounded readiness retry was tested and the second rollout passed. See [production evidence](evidence/production-targeted-release.json).
