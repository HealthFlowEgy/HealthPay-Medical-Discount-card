# HealthPay Quote Engine

A system that lets third-party platforms request **medical-discount pricing** on
behalf of their users via an SDK/API, routes those requests to a HealthPay
operations dashboard where staff manually attach pricing options, delivers those
options to the end user as selectable "pricing cards," captures the user's
confirmation, and surfaces the confirmed request back to operations.

> **This is a discount-pricing quote tool, not insurance.** HealthPay is a
> medical discount card (15%–70% off medical services). There is no pooled
> payout and no coverage decision — every request is a quote-for-discount-pricing
> flow, never a claim. **No clinical or diagnosis data is collected**; the only
> medical attribute captured is a service category.

## Monorepo layout (pnpm workspaces)

```
apps/
  web/        # Next.js: REST API, ops dashboard, hosted quote page   (upcoming)
packages/
  sdk/        # @healthpay/quote-sdk — publishable TypeScript SDK      (upcoming)
  db/         # Drizzle schema + migrations + seed + PII encryption
  shared/     # shared types, zod schemas, validators, state machine
docs/         # api.md, integration.md                                 (upcoming)
```

## Status

| Milestone | Scope | State |
| --- | --- | --- |
| 1 | Monorepo scaffold, `db` (schema + migrations + seed), `shared` validators + tests | ✅ done |
| 2 | Partner REST API (auth/HMAC, encryption, audit) | ⏳ pending review |
| 3 | Ops auth + dashboard live queue (SSE) + quote builder | ⏳ |
| 4 | Hosted tokenized quote page + confirm + SMS provider | ⏳ |
| 5 | Webhooks (delivery + retries) + SSE on transitions | ⏳ |
| 6 | `@healthpay/quote-sdk` (+ embed helper) + docs | ⏳ |
| 7 | Tests, seed/demo script, deploy notes (Vercel + Neon) | ⏳ |

## Develop

```bash
pnpm install
pnpm -r test         # run all unit tests
pnpm -r typecheck    # type-check every package
pnpm db:generate     # generate Drizzle migration SQL from the schema
pnpm db:migrate      # apply migrations (needs DATABASE_URL)
pnpm db:seed         # seed demo data (needs DATABASE_URL + PII_ENCRYPTION_KEY)
```

Copy `.env.example` to `.env` and fill in secrets. Generate a PII key with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Security & compliance highlights

- **PII at rest:** national ID and mobile are encrypted with AES-256-GCM
  (`PII_ENCRYPTION_KEY`). Only non-sensitive derivatives (`national_id_last4`,
  `mobile_e164`) are stored in the clear. Decryption happens only on
  authenticated ops reads and is audit-logged.
- **Single state-machine choke point:** every status change passes through
  `assertTransition` in `@healthpay/shared`; illegal transitions are rejected.
- **Validation:** Egyptian National ID, mobile (E.164), governorate, service
  type and pricing band (15–70%) are validated in `@healthpay/shared` and reused
  by the API, SDK and OpenAPI spec.
