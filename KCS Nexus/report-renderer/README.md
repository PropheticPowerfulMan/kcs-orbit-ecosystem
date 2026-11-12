# Nexus official report renderer

This private worker renders the same HTML document used by the Teacher and SuperAdmin print actions. Email messages may be French or English; the attached school report is always English.

The API connects through `REPORT_PDF_RENDERER_SOCKET=/run/kcs-report/renderer.sock`. Production Compose shares only the `nexus_report_socket` volume. The worker runs as UID 1000, with no network, no published port, a read-only root filesystem, a temporary Chromium profile, dropped capabilities and bounded memory/processes. It receives escaped, data-only HTML; scripts and external requests are disabled. It has no application environment file, database mount or school credentials.

Build from the repository root:

```sh
docker build -t kcs/nexus-report-renderer:COMMIT 'KCS Nexus/report-renderer'
```

Deploy this component alongside the corresponding Nexus API/Web release after staging tests and a Nexus database/configuration backup. Set `NEXUS_REPORT_RENDERER_RELEASE` to the exact commit. Do not recreate other applications. The renderer socket volume contains no school records. Keep the prior Nexus containers for rollback.

If the worker is unavailable, PDF delivery fails before any parent delivery is queued. Retry the same delivery request after health is restored; the delivery idempotency key prevents duplicate sends. Browser printing uses the same server document and remains independent of the PDF worker.

Typography: Selawik regular/bold from Microsoft release 1.01, embedded in every document under the included SIL Open Font License. Fonts and school artwork are local assets; no remote font request is needed.
