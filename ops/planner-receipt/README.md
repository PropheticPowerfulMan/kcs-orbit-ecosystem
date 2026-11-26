# Work-plan exports and recipient acknowledgements

Scope: Nexus API/Web and Eduplanner API only. No schema migration, account change or academic-data rewrite.

The official lesson PDF now follows the visible teacher work plan and setup fields. Hidden automatic support notes remain saved but are no longer appended. Existing branding, QR integrity, watermark and pagination are preserved.

Report-card publication resolves the virtual configured SuperAdmin to an existing database actor before its atomic publication/audit transaction.

Public report-card, transcript and general-email acknowledgements share a same-origin external client script, compatible with both proxy and API CSP headers. Opening a link is read-only. An explicit email acknowledgement (and attachment acknowledgement when applicable) is required; a locked transaction creates one audit record. Reopening a confirmed link is read-only. A delivered email cannot be rewritten. A known mailbox provider can be reopened after a cancellable five-second countdown; unknown providers are not guessed.

Communications > Receipt tracking is restricted to the configured SuperAdmin. It distinguishes queue, SMTP acceptance, awaiting recipient acknowledgement, explicit acknowledgement, failure and legacy mail without a receipt request. General queued emails acquire a recipient/content/attachment-bound HMAC before SMTP. Existing sent emails are not resent.

Validation: 59 Eduplanner server tests and server check; receipt/HMAC tests; successful builds of all three affected images; synthetic publication rollback reproduction and corrected publication; 12 FR/EN receipt flows under simultaneous proxy/API CSP headers; repeat/concurrent acknowledgement creates one audit; captured SMTP MIME has the exact PDF and receipt link; real inventory/details API with teacher/anonymous access denied; paginated tracking UI in FR/EN, both themes, mobile/tablet/desktop. Landscape, portrait and daily PDFs were rendered and inspected on every page.

Browser/integration scripts in tests require an isolated synthetic database, capture-only SMTP and protected fixture JSON outside the repository. Never use production recipient links to simulate an acknowledgement. receipt-server.cjs runs from the Nexus API image working directory; browser scripts use Playwright via /runtime and fixture/results via /evidence. No private fixture, SMTP MIME or receipt token is committed.

Production deployment must back up first and replace only nexus_api, nexus_web and lessonplan_api with the tested images. Preserve all other release pins, including the report renderer; compare data and unchanged container identities afterward. Rollback replaces those images only and never overwrites teachers' newly saved work.
