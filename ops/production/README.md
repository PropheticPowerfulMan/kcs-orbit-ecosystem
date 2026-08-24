# Production Docker stack

This stack publishes only Caddy on ports 80/443. PostgreSQL, Redis, APIs and frontends stay on the Docker network and have no host port binding.

Keep real environment files under `/etc/kcs-orbit/` with mode `600`; never commit them. Build every `kcs/*` image with the same immutable Git SHA and set `KCS_RELEASE` to that SHA. Validate with `docker compose --env-file /etc/kcs-orbit/domains.env -f ops/production/compose.yml config` before any start.

Every deployment must run `ops/backup/pre-deploy-backup.sh` first. Database migrations are deploy-only (`prisma migrate deploy`, Alembic `upgrade head`, Django `migrate`) and must never use reset/force-reset operations.

## Repeatable update workflow

1. Implement and test the correction locally on a dedicated Git branch.
2. Commit and push it, then merge the reviewed commit into `main`.
3. On the VPS, fetch `main` and check out the exact commit SHA.
4. Export `NEXUS_API_URL`, `EDUPAY_API_URL`, `EDUPAY_PUBLIC_URL`, `SAVANEX_API_URL` and `EDUSYNC_API_URL`, then run `./ops/production/build-images.sh <sha>`. All URLs must use their final HTTPS domains; API URLs must include the `/api` prefix when the client expects it.
5. Run `./ops/production/deploy.sh <sha>`. It verifies all images, creates a backup, validates Compose, starts the release and waits for health checks.
6. If deployment or health verification fails, the script automatically restores the previous application images. It never removes database or file volumes.

Manual application rollback remains available with `./ops/production/rollback.sh <previous-sha>`. Database migrations must always be backward-compatible (additive first, destructive cleanup only in a later release after verification); an application rollback intentionally does not reverse database migrations.

Never deploy a dirty worktree or a mutable `latest` tag. Never use `docker compose down -v`, `prisma migrate reset`, `db push --force-reset`, or volume pruning in this workflow.

## Required server files

Before the first deployment, create mode-600 files under `/etc/kcs-orbit/`:

- `domains.env`
- `orbit-db.env`, `nexus-db.env`, `edupay-db.env`, `savanex-db.env`, `edusync-db.env`
- `orbit-api.env`, `nexus-api.env`, `edupay-api.env`, `savanex-api.env`, `edusync-api.env`
- the backup environment file described by `ops/backup/backup.env.example`

Database URLs must use the private Compose service names (`orbit_db`, `nexus_db`, `edupay_db`, `savanex_db`, `edusync_db`), never `localhost`.

Set `NODE_ENV=production` for Node APIs, `APP_ENV=production` and `APP_DEBUG=false` for EduSync, and `DJANGO_SETTINGS_MODULE=config.settings.production` for Savanex. Disable every demo fallback. Use independent random secrets of at least 32 characters for JWT, refresh JWT, integration keys, Redis, Django and database passwords.
For authenticated LWS e-mail delivery, copy the corresponding blocks from
`smtp-service-env.example` into `nexus-api.env`, `edupay-api.env`, and
`savanex-api.env`. Replace `CHANGE_ME_LWS_MAILBOX_PASSWORD` only on the server,
keep these files mode 600, and restart the three API containers. Port 587 uses
STARTTLS (`SMTP_SECURE=false` for Nodemailer and `EMAIL_USE_TLS=True` for Django).
