# Jury access, Parent loading and Eduplanner previews

This lot changes only Nexus API/Web, Jury Web and Eduplanner API/Web. No schema or credential changes are included.

## Behaviour

- Jury launch tickets last five minutes and remain single-use with explicit identity confirmation. Failed previews can be retried in the same page without putting the ticket in browser storage. Recovery after a lost exchange response accepts only the identity already confirmed.
- Jury requests use a bounded AbortController timeout on older browsers. Cryptographic UUID generation also supports browsers without randomUUID. Optional encrypted judge drafts unlock independently of the online workspace; failures are shown inline. Learners do not unlock judge evaluation drafts.
- The Jury top menu remains visible on mobile and tablet while the document scrolls.
- Parent children load independently of messages, contacts, notices and events. The searchable family picker supports name, class, student number and keyboard navigation. Connection failures offer retry and never claim that verified family links are missing.
- Eduplanner prepares PDF metadata once and transfers the PDF only through its private view. A short-lived, per-editor cache coalesces unchanged requests and is bound to actor, role, saved content, print settings and language. The existing server ownership and saved-hash verification remain mandatory. Background preparation is bounded.
- Nexus opens Eduplanner with the shared validated openerless handoff instead of replacing the Nexus window. Eduplanner keeps its own /lesson-plan/ identity and scope, declares an existing-window launch handler, and offers installation help on mobile too.

## Validation

Five affected service images build successfully. Eduplanner server tests and syntax checks pass (58 tests). Session tests cover single-use coalescing, failed preview retry, same-identity recovery, rejection of other-account recovery, and cryptographic UUID fallback.

Parent loading passed at 390, 768 and 1440 pixels (0.65–1.38 seconds in controlled fixtures), and all 12 timetable/theme/language variants passed. Jury passed at 390, 768 and 1024 pixels, including a real failed-preview retry and old-browser feature fallbacks. Eduplanner preview measured 2.54 seconds cold and 0.73 seconds repeated with no additional save.

Browser tests in this directory use synthetic accounts on an isolated Docker network. They cover the complete Parent timetable in FR/EN and both themes, independent family loading with slow secondary requests, searchable/keyboard selection and retry, real Jury confirmation/exchange, old-browser feature fallbacks, nonblocking optional device-draft errors, and a fixed mobile/tablet top menu. The learner ownership/persistence regression suite remains applicable.

Preview timings are controlled staging measurements, not a promise about every internet connection. Official lesson PDF design, QR content, pagination, grading and report-card designs remain unchanged.

## PWA verification

The built manifests retain distinct Nexus root and Eduplanner nested scopes. Native installation requires a trusted HTTPS origin; the private self-signed QA gateway cannot satisfy Chromium's install-info fetch even with a page certificate override. The native test therefore runs against the official HTTPS site after deployment, in a disposable Chromium profile with link capture explicitly enabled. Websites cannot override a user's browser link-handling preferences or silently replace a legacy installation.

## Deployment and recovery

Use the existing verified pre-deployment archive plus the private Eduplanner lesson/profile snapshot. Pin only the five affected service images, keep unrelated container IDs/images unchanged, and verify the academic fingerprints and health checks afterward. Rollback replaces only those images; it never resets a database or restores over concurrent academic work.
