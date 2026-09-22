# KCS Kitchen security and audit notes

## Threat boundaries

- Credentials are forwarded over the private staging network to Nexus and are never stored by Kitchen.
- Kitchen sessions use an independent short-lived signing key.
- QR codes contain only an opaque Orbit reference and expiry, protected by HMAC.
- CORS is restricted to the staging Kitchen origin.
- Authentication endpoints are rate limited.
- Input is validated with Zod.
- CSV cells that can trigger spreadsheet formulas are neutralized.
- Database operations that change transactions and stock use PostgreSQL transactions.

## Operational rules

1. Never delete a confirmed transaction.
2. Never recompute history with a current product price.
3. Never grant credit implicitly.
4. Never reopen a closed month through the standard API.
5. Never let notification delivery decide whether a sale succeeds.
6. Never expose another person's ledger to a personal role.
