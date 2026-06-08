# Deploying to Vercel + Neon

The app is `apps/web` (Next.js 14) inside a pnpm monorepo. It needs a Postgres
database (Neon) and a few secrets. Two parts: **(A) database** and **(B) the
Vercel app**.

## A. Database (Vercel Postgres / Neon)

1. In the Vercel project → **Storage → Create Database → Postgres**, then
   **Connect** it to the project. This auto-injects the connection env vars
   (`DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, …) into the
   project — the app reads whichever is present, so no manual `DATABASE_URL`
   wiring is needed.
2. Initialize the schema + data once. From the Storage tab copy a connection
   string (use the **non-pooling** one for migrations if offered), then from a
   checkout of this repo:

   ```bash
   DATABASE_URL="<copied connection string>" \
   PII_ENCRYPTION_KEY="<your base64 32-byte key>" \
     bash scripts/setup-prod-db.sh --seed
   ```

   `--seed` loads the 3,386-provider directory + a demo partner (prints its API
   key/secret once) + ops logins. Omit it for an empty (migrated-only) database.

   > Use the **same** `PII_ENCRYPTION_KEY` here and in Vercel — PII and the demo
   > partner secret are encrypted with it.

## B. Vercel project

### Option 1 — Dashboard import (recommended, one-time)

1. **New Project → Import** the GitHub repo
   `HealthFlowEgy/HealthPay-Medical-Discount-card`.
2. **Root Directory:** `apps/web` (Vercel auto-detects Next.js + the pnpm
   workspace and installs from the repo root).
3. **Environment Variables** (Production) — see the table below.
4. **Deploy.** After the first deploy, set `APP_BASE_URL` to the assigned URL
   (e.g. `https://<project>.vercel.app`) or your custom domain, then redeploy so
   SMS quote links use the right host.
5. Webhook retries run via the cron in `apps/web/vercel.json`
   (`/api/v1/internal/webhooks/process`, every 5 min), authorized by `CRON_SECRET`.

### Option 2 — CLI (headless)

With a Vercel access token:

```bash
npm i -g vercel
cd apps/web
vercel link --yes --token "$VERCEL_TOKEN"          # creates/links the project
# set Root Directory to apps/web in project settings, then add env vars:
for kv in DATABASE_URL PII_ENCRYPTION_KEY OPS_SESSION_SECRET CRON_SECRET \
          APP_BASE_URL SMS_PROVIDER SMS_SENDER_ID PARTNER_ALLOWED_ORIGINS \
          RATE_LIMIT_PER_MINUTE QUOTE_VALIDITY_HOURS; do
  printf '%s' "${!kv}" | vercel env add "$kv" production --token "$VERCEL_TOKEN"
done
vercel deploy --prod --token "$VERCEL_TOKEN"
```

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | auto | Injected by the Vercel Postgres integration (also accepts `POSTGRES_URL`) |
| `PII_ENCRYPTION_KEY` | ✓ | base64 32-byte AES-256-GCM key (same as DB setup) |
| `OPS_SESSION_SECRET` | ✓ | random secret for ops session JWTs |
| `CRON_SECRET` | ✓ | bearer secret protecting the webhook-retry cron |
| `APP_BASE_URL` | ✓ | deployed URL; used to build SMS quote links |
| `SMS_PROVIDER` | ✓ | `console` (dev) \| `cequens` \| `twilio` \| `smsmisr` |
| `SMS_SENDER_ID` |  | default `HealthPay` |
| `CEQUENS_API_KEY` | if cequens | CEQUENS API token (Bearer) |
| `CEQUENS_SENDER_NAME` |  | approved CEQUENS sender ID, default `HealthPay` |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` |  | if `SMS_PROVIDER=twilio` |
| `SMSMISR_USERNAME` / `SMSMISR_PASSWORD` |  | if `SMS_PROVIDER=smsmisr` |
| `PARTNER_ALLOWED_ORIGINS` |  | comma-separated origins allowed to embed the quote page |
| `RATE_LIMIT_PER_MINUTE` |  | default `60` |
| `QUOTE_VALIDITY_HOURS` |  | default `48` |

Generate the three secrets with:

```bash
node -e "console.log('PII_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log('OPS_SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('CRON_SECRET=' + require('crypto').randomBytes(24).toString('hex'))"
```

## Notes

- SMS defaults to the `console` provider (links are logged, not sent). Switch to
  `twilio`/`smsmisr` with credentials for real delivery.
- The SSE bus and rate limiter are per-instance (best-effort on serverless); the
  dashboard polls as a fallback. Swap `lib/events.ts` / `lib/rate-limit.ts` for a
  shared backend (Postgres LISTEN/NOTIFY, Upstash) for global behavior.
