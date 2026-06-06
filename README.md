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
| 2 | Partner REST API (auth/HMAC, encryption, audit) | ✅ done |
| 3 | Ops auth + dashboard live queue (SSE) + quote builder | ✅ done |
| 4 | Hosted tokenized quote page + confirm + SMS provider | ✅ done |
| 5 | Webhooks (delivery + retries) + SSE on transitions | ✅ done |
| 6 | `@healthpay/quote-sdk` (+ embed helper) + docs | ✅ done |
| 7 | Tests, seed/demo script, deploy notes (Vercel + Neon) | ✅ done |

Docs: [`docs/api.md`](docs/api.md) · [`docs/integration.md`](docs/integration.md) ·
[`docs/openapi.json`](docs/openapi.json) · SDK: [`packages/sdk/README.md`](packages/sdk/README.md)

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

## End-to-end demo

With `DATABASE_URL` + `PII_ENCRYPTION_KEY` set, run the full happy path
(create → ops attaches 3 options → hosted quote → confirm → signed webhooks):

```bash
pnpm db:migrate          # once
pnpm --filter @healthpay/web demo
# or: pnpm demo          # seeds first, then runs the walkthrough
```

It starts an in-process webhook receiver and prints each lifecycle step plus the
delivered `request.quoted` / `request.confirmed` webhooks (with signature checks).

## Running the apps

```bash
pnpm db:migrate && pnpm db:seed   # prints demo partner creds + ops logins
pnpm dev                          # Next.js on http://localhost:3000
#   /              landing
#   /ops           operations dashboard (login: admin@healthpay.test / ChangeMe123!)
#   /quote/:token  hosted quote page (token from the SMS log / quote_url)
```

## Deploying (Vercel + Neon)

1. **Database** — create a Neon Postgres project; copy its pooled connection
   string into `DATABASE_URL`. Run `pnpm db:migrate` against it (CI or locally).
2. **Vercel project** — import the repo, set the project root to `apps/web`.
   Vercel builds with `pnpm` workspaces automatically.
3. **Environment variables** (Vercel → Settings → Environment Variables) — set
   everything from `.env.example`: `DATABASE_URL`, `PII_ENCRYPTION_KEY`,
   `OPS_SESSION_SECRET`, `APP_BASE_URL` (your deployed URL), `SMS_PROVIDER` (+ the
   chosen vendor's credentials), `PARTNER_ALLOWED_ORIGINS`, `CRON_SECRET`,
   `RATE_LIMIT_PER_MINUTE`, `QUOTE_VALIDITY_HOURS`.
4. **Cron** — `apps/web/vercel.json` registers a 5-minute cron that hits
   `/api/v1/internal/webhooks/process` to drain webhook retries.
5. **Scale notes** — the SSE bus and the rate limiter are per-instance (best
   effort across serverless instances); the dashboard also polls as a fallback.
   For global realtime/limits, swap `lib/events.ts` (e.g. Postgres LISTEN/NOTIFY)
   and `lib/rate-limit.ts` (e.g. Upstash) — both are isolated behind one module.

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
