# Assembly groups, family notices and mobile navigation

## Value Word

Monday and Friday use the whole-school General Assembly. Tuesday, Wednesday and Thursday use two simultaneous programmes: K3–Grade 8 and Grade 9–12, in separate buildings. All default to 08:00–08:30 Africa/Kinshasa and use the same published school calendar. Locations remain configurable by school leadership. The automatic rotation uses teacher assignments for building groups, preserves already published turns and avoids scheduling one speaker in both buildings at the same time. The migration retains every existing assignment ID and speaker; only future Tuesday–Thursday assignments are classified into their building group. Historical records remain intact.

Students and parents can read the general programme plus the building groups linked to their children. General notifications reach everyone; building announcements target the relevant learners, parents and staff. Speaker reminders remain Nexus + email at seven, three and one day. Announcements remain Nexus only.

## Shining Student and email brand

The learner receives preparation instructions. Each linked parent/guardian receives a polite notice identifying the child as the presenter, with the child’s name, class, date and current topic. Registered additional family addresses are included and deduplicated. If a family address also appears as the learner address, it receives the parent copy. New individual notices use the durable email queue instead of waiting for SMTP in the request. The chosen Nexus interface language is explicitly passed to generation. Old messages already delivered to mailboxes cannot be edited retroactively.

The full horizontal wordmark from `KCS Nexus/frontend/public/images/kcs-logo.png` is used in the common Nexus email header, watermark and footer, without circular cropping. Narrow email layouts stack the brand and title.

## Mobile interfaces and nursery teachers

Jury project creation has bounded fieldset, legend, select and grid sizing, wrapping course labels/chips and reachable form actions. Its project workflow and grading rules are unchanged. The public Nexus dropdown navigation is redesigned only below 1280px, with compact navigation cards, keyboard dismissal/focus handling and internal scrolling. Desktop public navigation remains unchanged.

The nursery sidebar now initializes from its resolved account-scoped context cache and keeps that context while refreshing or during transient network failures. The desktop rail no longer animates from zero width on each route remount. Main teachers K3, K4 and K5 and the K3 assistant are tested across standalone routes. No teacher assignment or credential is modified.

## Validation and release

Tests run against the guarded synthetic staging database with fake Orbit and captured SMTP. They cover migration preservation, weekday/building rules, simultaneous assignments, family targeting, real Shining Student generation, bilingual email rendering, nursery menu stability, public mobile/tablet navigation and Jury project creation including long course names and advanced settings. Release targets are Nexus API, Nexus Web and Jury Web only, after verified production backup. Other applications, credentials and academic result calculations are outside the change.
