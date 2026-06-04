# KCS Nexus Security And QuickSchools Roadmap

## Security Check-In

### KCS Nexus

- Password recovery is now a real backend workflow, not a placeholder.
- Reset links use one-time random tokens; only SHA-256 hashes are stored in the database.
- Reset tokens expire after 30 minutes and old active tokens are invalidated when a new reset is requested.
- Completing a reset invalidates existing refresh tokens.
- API responses for forgotten passwords are neutral to avoid account enumeration.
- Login/register/reset endpoints are protected by an in-memory rate limit.
- Reset requests and completions are written to the audit log.

### EduPay

- EduPay already includes hashed password reset tokens, expiry, rate limiting, email delivery, admin recovery, and parent password flows.
- The GitHub demo keeps backend-dependent reset actions as presentation-safe UI while the production backend remains the source of truth.

### SAVANEX

- Added public forgot-password and reset-password endpoints using Django's built-in secure password reset token generator.
- Added neutral forgot-password responses and Django password validation before accepting a new password.
- Added frontend login recovery UI.
- Added DRF anonymous/user throttling defaults.

### EduSync AI

- Production now refuses the default JWT secret.
- The demo admin password is no longer force-reset on startup in production.

### KCS Orbit

- Added rate limiting on `/api/auth` endpoints to reduce brute-force risk against the central integration service.
- Existing production JWT safety check is preserved.

## QuickSchools Feature Parity Target

Official QuickSchools materials emphasize these school-management capabilities: parent access, gradebook, attendance, admissions, communication, calendar, student and parent information, reports, billing, and file sharing.

References:

- https://www.quickschools.com/quickschools/features
- https://www.quickschools.com/quickschools/features/parent-access
- https://support.quickschools.com/hc/en-us/articles/115005734926-Parent-Portal-for-Admins

KCS Nexus should match those capabilities and improve them through the ecosystem:

- Admin dashboard: SIS records, admissions pipeline, staff permissions, reports, audit logs, billing summary from EduPay, Orbit sync health, and risk alerts.
- Teacher dashboard: attendance, gradebook, assignments, lesson planning, parent messaging, behavior notes, and AI tutoring support.
- Parent dashboard: children overview, grades, attendance, assignments, invoices, payment agreements, messages, calendar, announcements, and private teacher contact.
- Student dashboard: assignments, timetable, grades, attendance, learning recommendations, student forum, AI tutor, and school announcements.
- Staff dashboard: records, admissions, communications, attendance operations, document exports, and controlled permissions.

## Better Than QuickSchools Direction

- Use Orbit as the central identity and data spine across KCS Nexus, EduPay, SAVANEX, and EduSync AI.
- Add AI-assisted risk detection combining grades, attendance, behavior, finance pressure, and communication signals.
- Keep bilingual FR/EN controls consistent across public pages and all dashboards.
- Make parent finance tracking richer than a normal SIS by exposing receipts, debt, agreements, and payment history from EduPay.
- Keep every sensitive action auditable and role-controlled before production rollout.
