# EduPay performance — focused check

## Parent payment tracking
The screen previously requested `/api/parents`. With Orbit enabled this awaits `readOrbitRegistryMirror`, whose cold refresh updates the whole school mirror and runs `syncAutomaticFamilyTuitionPlan` for every family. The screen only needs identity and child selector fields already supplied by the existing authorized `/api/parents/options` endpoint. Use that lightweight endpoint and reuse its account-scoped memory response. Financial snapshots remain live, independently fetched for the selected parent; financial formulas, money writes and authorization are unchanged.

## Learner list
The main directory was withheld by `Promise.allSettled` until classes AND finance catalog completed. Render the directory on its own completion, while ancillary requests finish independently. Reuse account-scoped memory data, deduplicate overlapping focus/timer refreshes and protect unmounted/stale requests. No financial result is fabricated to accelerate rendering.

## Validation pending
TypeScript build, browser delayed-catalog test, isolated API timing/payload measurements and authorization checks are required before declaring the improvement verified. Production remains untouched.
