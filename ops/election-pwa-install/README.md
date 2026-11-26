# Targeted electoral PWA handoff

Only Nexus Web changes on the VPS. Electoral static-site changes are maintained and deployed from KCSParentElection.

Nexus emits a real openerless anchor to the audience-specific election login. This preserves the user's navigation activation for installed-app capture, avoids asynchronous popup fallbacks, and never includes credentials. Existing role eligibility and server authentication remain unchanged. Academy and Eduplanner launchers are unchanged.

Build and staged browser validation passed. Both electoral apps launched independently in an isolated Chromium 140 profile. Capture from an installed Nexus window passed with the destination app link-handling preference enabled. Browser settings and iOS restrictions remain outside website control.
