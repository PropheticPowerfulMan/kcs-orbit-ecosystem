# Implementation review notes — staging candidate

This is a repository delivery note, not a canonical Codex Security scan report. The security host refused scan registration with `Review changes requires a non-bare Git worktree with a resolvable HEAD`, although its setup inspection validated HEAD and the worktree. No scanId, sealed result or complete automated scan is claimed.

## Source review

Three independent read-only assignments reviewed (1) Jury authentication, project/evaluation policy and workflow, (2) publication, scoring, uploads, exports, analytics, schema and deployment templates, and (3) Jury client/offline/PWA plus Nexus family-email and receipt logic. Parent review covered the small Nexus/EduPay/Kitchen diffs, document HTML generation and fixture safety. Supporting canonical auth, workspace, period, family-recipient and mail-worker source was followed where relevant. The review was bounded to this change set; it was not an ecosystem-wide audit or live production penetration test. Package-lock structure was inspected; no external vulnerability-advisory audit was performed.

## Corrected and retested

- Malformed submission identifiers were parsed after streaming but before the cleanup function. Parsing now occurs inside its try/catch; actual HTTP requests with malformed metadata leave no new file and no database row. Other authorization/signature/quota/concurrency tests still pass.
- A fresh internal SSO link previously exchanged automatically. Preview now identifies the target without consuming the ticket or replacing a cookie. The modern FR/EN confirmation names the target and explains replacement of a live different session. Exchange repeats expiry/access checks and requires the matching reference. Real browser tests prove Cancel preserves the current identity and explicit switching works. This is user-intent acknowledgement, not cryptographic proof of a gesture. Intentional one-use external guest invitations remain separate.
- Eligibility changes during pending validation now advance the project revision and return it to evaluation-closed status. Previous runs remain historical; approval requires a new consolidation. Candidate and participant cases have runtime coverage; the member branch was inspected statically.

## Retained limits

A completed hosted security scan is unavailable. Native Windows installation/app-link capture, production-provider delivery capacity, off-server backup configuration and real-account institutional acceptance remain operational checks. File signatures are checked, but antivirus scanning is not configured. A receipt token holder's explicit email/PDF acknowledgement does not establish authenticated parental identity or prove a provider opened a mailbox. No absolute security or zero-regression guarantee is claimed.
