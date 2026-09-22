# KCS Kitchen

KCS Kitchen is the canteen domain application of the KCS Orbit Ecosystem.

## Data ownership

- Orbit remains the source of institutional identity.
- Nexus remains the institutional authentication provider.
- Kitchen stores only the Orbit person ID plus immutable business snapshots required to audit a transaction.
- Kitchen financial records are separate from school fees. A future EduPay connector may report Kitchen payments, but does not merge both ledgers without an explicit business rule.

## Guarantees

- Historical prices are frozen in KitchenTransactionItem.unitPriceAtPurchase.
- Confirmed transactions are never deleted silently.
- Corrections use reversal, refund or adjustment records.
- Inventory changes and discounts are audited.
- Notification failures do not roll back a sale; the outbox retries independently with bounded exponential backoff and an idempotent Nexus bridge.
- Credit is disabled until explicitly granted to an Orbit identity.
- Teacher threshold discount rules exist as configuration and are not active by default.

## Roles

| Role | Main access |
|---|---|
| KITCHEN_ADMIN | Full Kitchen configuration and operations |
| CASHIER | POS, person lookup, sales and payments |
| FINANCE | Finance dashboard, payments, disputes, periods and reports |
| AUDITOR | Read-only transactions, stock, reports and audit trail |
| TEACHER / STAFF / STUDENT | Own history, balance, receipts and disputes |

## Staging

The app is exposed only through /kitchen/ in ops/staging/Caddyfile.

Services and data are isolated:

- kitchen_db
- kitchen_api
- kitchen_web
- staging_kitchen_db_data

Production is intentionally not configured by this change.

## Required staging variables

See ops/staging/.env.example. Secrets must never be committed.

## Validation

Run the backend tests and builds, the frontend build, then validate the staging Docker compose file.
