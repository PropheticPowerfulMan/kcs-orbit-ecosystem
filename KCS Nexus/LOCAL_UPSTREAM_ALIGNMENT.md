# KCS Nexus local/upstream alignment

Reference audited: `PropheticPowerfulMan/kcs-nexus-demo`, branch `main`, commit `ad3f9945a0c94b9bd7a5c5f14f4ba65c08616cae`.

The local application is intentionally the preservation base. It contains every frontend module present in the public reference and additional production work in the backend and portals.

Do not replace these local files wholesale with upstream copies:

- `frontend/src/pages/TeacherPortal/index.tsx`
- `frontend/src/components/gradebook/AdvancedGradebook.tsx`
- `frontend/src/components/shared/SuggestionBox.tsx`
- `frontend/src/components/layout/PortalSidebar.tsx`
- `frontend/src/pages/Admin/index.tsx`
- `frontend/src/pages/StudentPortal/index.tsx`
- `frontend/src/services/api.ts`
- `backend/src/routes/finance.routes.ts`
- `backend/src/routes/intelligence.routes.ts`
- `backend/src/routes/messages.routes.ts`
- `backend/src/utils/savanex-intelligence.ts`

Any future synchronization must be a feature-level merge. Preserve the local Suggestion Box registry/status workflow, official PDF output, Teacher settings/avatar workflow, dedicated gradebook window, student portal functions, EduPay integration routes, and Orbit/SAVANEX integrations.

Validation after audit: frontend TypeScript build passes with `tsc -p tsconfig.build.json`.
