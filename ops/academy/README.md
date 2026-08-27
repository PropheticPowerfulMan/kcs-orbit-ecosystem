# KCS Nexus Academy deployment preparation

These manifests isolate Academy by environment and do not mount or reuse any production volume or database.

Staging:
1. Copy .env.staging.example to .env.staging on the VPS and replace placeholders with staging-only values.
2. Set ACADEMY_STAGING_DOMAIN to the staging hostname in Caddy.
3. Run docker compose -f compose.staging.yml config, then start only this compose project.
4. Apply the Orbit and Nexus migrations in staging before testing SSO.

Production manifests are preparation only. They must not be started until explicit approval after staging validation.
