# Daylight electives and explicit application sign-in

The SuperAdmin elective workspace owns its hero. The general admin theme must not turn an empty catalogue into a dark heading. Its daylight labels, empty states, placeholders, status controls and disabled actions use the matte Nexus palette. No elective workflow or API changed.

Nexus opens the corresponding electoral or Academy login through an independent openerless navigation. URLs contain display preferences, a validated return hint and (for Academy) the selected academic workspace, never a session ticket or credentials. The hint is not authorization: Academy forwards it to the existing Nexus launch validator after successful institutional login. An unsupported or ungranted role fails closed. Entering Academy sign-in clears its previous local session cookie. Error redirects use the configured public origin. Browser/OS app-link capture remains an installation/browser setting.

Electoral greetings use a verified login/session name and the Africa/Kinshasa clock, with FR/EN salutations. Role checks remain server-side: management for SuperAdmin, read-only leadership access, and the correct parent/student electorate. Parent and student PWA identities remain separate.

Eduplanner daily/weekly labels and the selected-day caption follow the chosen plan type without deleting the other stored teaching days. Preview uses the existing reliable outbox without creating an unnecessary manual revision every time. A freshly verified server identity is reused only inside the same request, avoiding a redundant remote read; permission checks and document hash/RLS checks still run. No authentication cache was added.

Official PDFs have an institutional masthead, compact metadata, visible emblem watermarks, timing in the Teaching sequence column, repeatable table headers, footer QR and Page X / Y on every page. The school emblem is embedded once and reused to keep long PDFs small. Portrait/landscape, font sizes and multi-page content remain supported.

Validation is performed with isolated synthetic accounts. Tests cover 16 daylight combinations, six electoral profiles, explicit Teacher/Principal/ST handoffs and sign-ins, invalid role denial, daily/weekly switching and repeat previews, 12 persistence/preview cases across three browser engines, unit tests and rendered English/French PDF samples including a 20-page document. Preview timing is measured in staging and is not a guarantee for an unreliable internet connection.

Targeted VPS rollout: nexus_web, lessonplan_api, lessonplan_web and academy. The electoral static site is published separately from KCSParentElection. No schema migration or production proxy change is required.
