# Active academic workspace and resilient editing

A Nexus account with a teaching role/profile opens its Teacher dashboard by default. The configured SuperAdmin retains its native administration home. Academic application launches carry the current workspace selected in Nexus; the server verifies it against current grants before issuing a single-use ticket. An explicit Principal or ST selection is required to enter their management workspace. Missing/revoked grants fail closed.

Academy receives an independent, revocable Nexus session bound to the selected workspace; every validation rechecks current grants. Existing Orbit sign-in remains supported. Eduplanner defaults to teaching for linked multi-role teachers and stores the active view in tab-local session storage. A Teacher tab and a Principal tab therefore do not replace each other’s view. The Supabase profile retains verified granted capability rather than oscillating between view roles. No password is changed by these transitions.

Lesson acknowledgements store revision markers, not another full copy of every plan. Legacy acknowledgement snapshots are compacted without modifying drafts or server content. All three New lesson plan entry points report storage failures explicitly and permit retry. Transient role lookup failures preserve the saved credentials and pending work. Server images syntax-check their entry point during build.

SuperAdmin elective management is restored, including database-bound actor attribution. Teacher proposals, six ranked learner preferences, approval, allocation and publication retain their existing safeguards. The teacher directory reacts to confirmed management permissions; duplicate actions are serialized.

Official portraits remain authoritative in the registry/database. Students keep server readback confirmation; employees now use the shared bounded photo preparation/camera component and cannot save an unfinished photo. Confirmed learner portraits also use a bounded, account-scoped IndexedDB cache, independent of personal dashboard avatars. A lightweight roster cannot erase cached images; an explicit removal clears the cache and a late cache read cannot overwrite a newer server value. Cache failures do not invalidate a successful server save.

The EduPay password dialog is rendered in a body portal, outside the filtered header, with viewport centering, internal scrolling, focus trapping, Escape handling, explicit labels, stable visibility buttons and responsive styling. Its account/password endpoint and existing security rules are unchanged.

Targeted VPS deployment: Nexus API/Web, LessonPlan API/Web, EduPay Web. No schema migration or production Caddy change is required. Electoral PWA changes are maintained and deployed separately in KCSParentElection.

Tests use isolated synthetic accounts and refuse production database URLs. Browser fixtures exercise actual components and request flows; no real passwords or personal records are included.
