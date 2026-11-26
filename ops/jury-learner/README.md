# Dedicated Nexus Jury learner workspace

Learners now receive their own home, project directory, portfolio entry points, and private result/document area. The overview shows six recent projects; the directory has twelve-card pages, search, school-year and phase filters. Organizer analytics, judge evaluations and rubric-management navigation remain reserved to their existing roles. Learner identity takes precedence for UI routing, including forged judge hashes.

Project pages show published instructions, objectives, dates in Kinshasa time, the learner's own individual/group assignments, teammates and rubric descriptors. Portfolio operations reuse the existing protected API, scope the view to one own candidate, confirm server receipts, preserve entered work when language changes, and disable edits after closure/deadline. Submitted work can be corrected and resubmitted without accidentally withdrawing it through a draft action.

Results come only from the existing release/visibility-enforced endpoint. No missing result becomes zero, unrelated rows are excluded, and individual assessment PDFs target the authenticated participant. Certificates are filtered to the same participant. No server permissions, migrations, grading calculations or publication rules change.

Validation:
- TypeScript and Vite production image.
- Real isolated staging API: institutional student login, denial of management/other portfolios, saved draft reread after reload, submission and revision-increasing resubmission, and hidden unreleased results.
- Explicit rendering fixtures: own group roster, exclusion of unrelated candidates, read-only closed submissions, own published score and PDF recipient targeting.
- Twelve actual-session UI variants: 390/768/1440 px, FR/EN, light/dark; no page overflow; criteria visible.
- Existing Teacher organizer workspace still exposes project creation and does not enter learner routing.

Test gateway and browser scripts use only the private jury_stage fixtures; do not mount production credentials. The web image needs the same writable nginx tmpfs mounts as the existing production service. Only jury_web is deployed for this correction.
