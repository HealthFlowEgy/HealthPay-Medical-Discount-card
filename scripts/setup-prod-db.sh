#!/usr/bin/env bash
# Provision the production database: apply migrations and seed.
#
#   DATABASE_URL="postgres://...neon..." PII_ENCRYPTION_KEY="..." \
#     bash scripts/setup-prod-db.sh [--seed]
#
# - DATABASE_URL must be a Postgres (Neon) connection string.
# - PII_ENCRYPTION_KEY must match the value set in Vercel (used to encrypt PII +
#   the demo partner secret during seeding).
# - Pass --seed to also load the 3,386-provider directory + demo data.
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to your Neon Postgres connection string}"
: "${PII_ENCRYPTION_KEY:?Set PII_ENCRYPTION_KEY (same value as in Vercel)}"

cd "$(dirname "$0")/.."

echo "==> Applying migrations…"
pnpm --filter @healthpay/db migrate

if [[ "${1:-}" == "--seed" ]]; then
  echo "==> Seeding (providers directory + demo data)…"
  pnpm --filter @healthpay/db seed
fi

echo "==> Done."
