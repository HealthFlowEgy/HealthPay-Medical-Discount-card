/**
 * CLI seed: loads the provider directory + demo data into the database.
 *
 *   pnpm --filter @healthpay/db seed   (requires DATABASE_URL + PII_ENCRYPTION_KEY)
 *
 * Reads the gzipped directory from disk and delegates to `seedAll`.
 */

import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getDb, closeDb } from "./client.js";
import { seedAll, type ProviderSeedRow } from "./seed-core.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const db = getDb();
  console.log("Seeding HealthPay Quote Engine…\n");

  const file = join(__dirname, "seed-data", "providers.json.gz");
  const rows = JSON.parse(
    gunzipSync(readFileSync(file)).toString("utf8"),
  ) as ProviderSeedRow[];

  const r = await seedAll(db, rows, {
    validityHours: Number(process.env.QUOTE_VALIDITY_HOURS ?? 48),
  });

  console.log("✔ Seed complete.\n");
  console.log(`  Providers directory loaded: ${r.providerCount} rows`);
  console.log("─".repeat(60));
  console.log("Demo partner credentials (shown once — copy now):");
  console.log(`  API key:        ${r.apiKey}`);
  console.log(`  API secret:     ${r.apiSecret}`);
  console.log(`  Webhook secret: ${r.webhookSecret}`);
  console.log("Ops login:");
  console.log(`  admin@healthpay.test / ${r.opsPassword}  (admin)`);
  console.log(`  agent@healthpay.test / ${r.opsPassword}  (agent)`);
  console.log("─".repeat(60));
}

main()
  .then(() => closeDb())
  .catch(async (err) => {
    console.error("Seed failed:", err);
    await closeDb();
    process.exit(1);
  });
