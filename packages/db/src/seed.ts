/**
 * Seed data for local development and the `pnpm demo` happy-path script.
 *
 * Creates:
 *   - 1 demo partner (prints its API key + secret — copy them, they are shown once)
 *   - 2 ops users (admin + agent), default password printed
 *   - ~6 sample service requests across all four service types in mixed states
 *
 * Run with:  pnpm --filter @healthpay/db seed   (requires DATABASE_URL + PII_ENCRYPTION_KEY)
 */

import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import {
  validateNationalId,
  computeDiscountPct,
  type ServiceType,
  type Governorate,
} from "@healthpay/shared";
import { getDb, closeDb } from "./client.js";
import { encryptPii } from "./crypto.js";
import {
  partners,
  opsUsers,
  serviceRequests,
  pricingOptions,
  confirmations,
} from "./schema.js";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function token(prefix: string): string {
  return `${prefix}_${randomBytes(24).toString("base64url")}`;
}

/** Build a structurally valid Egyptian National ID from parts. */
function buildNid(
  century: 2 | 3,
  yy: string,
  mm: string,
  dd: string,
  gov: string,
  serial: string,
): string {
  const nid = `${century}${yy}${mm}${dd}${gov}${serial}`;
  if (nid.length !== 14) throw new Error(`Bad NID length: ${nid}`);
  const res = validateNationalId(nid);
  if (!res.ok) throw new Error(`Seed produced invalid NID ${nid}: ${res.reason}`);
  return nid;
}

interface SeedRequest {
  serviceType: ServiceType;
  governorate: Governorate;
  city?: string;
  nid: string;
  mobile: string;
  partnerReference: string;
  status: "pending_quote" | "quoted" | "confirmed" | "expired" | "cancelled";
}

const SAMPLES: SeedRequest[] = [
  {
    serviceType: "medical_clinic_visit",
    governorate: "Cairo",
    city: "Nasr City",
    nid: buildNid(3, "01", "01", "01", "01", "2345"),
    mobile: "+201001234501",
    partnerReference: "order_1001",
    status: "pending_quote",
  },
  {
    serviceType: "dental_clinic_visit",
    governorate: "Giza",
    city: "Dokki",
    nid: buildNid(2, "98", "06", "15", "21", "1234"),
    mobile: "+201112234502",
    partnerReference: "order_1002",
    status: "pending_quote",
  },
  {
    serviceType: "lab_investigation",
    governorate: "Alexandria",
    city: "Smouha",
    nid: buildNid(3, "00", "11", "20", "02", "3456"),
    mobile: "+201221234503",
    partnerReference: "order_1003",
    status: "quoted",
  },
  {
    serviceType: "radiology_investigation",
    governorate: "Dakahlia",
    city: "Mansoura",
    nid: buildNid(2, "95", "03", "10", "12", "4566"),
    mobile: "+201501234504",
    partnerReference: "order_1004",
    status: "quoted",
  },
  {
    serviceType: "lab_investigation",
    governorate: "Sharqia",
    city: "Zagazig",
    nid: buildNid(3, "02", "07", "07", "13", "1235"),
    mobile: "+201001234505",
    partnerReference: "order_1005",
    status: "confirmed",
  },
  {
    serviceType: "medical_clinic_visit",
    governorate: "Aswan",
    nid: buildNid(2, "90", "12", "31", "28", "1234"),
    mobile: "+201112234506",
    partnerReference: "order_1006",
    status: "expired",
  },
];

async function main() {
  const db = getDb();
  console.log("Seeding HealthPay Quote Engine…\n");

  // ── Partner ────────────────────────────────────────────────────────────────
  const apiKey = token("hp_live");
  const apiSecret = token("hps");
  const webhookSecret = token("whsec");
  const [partner] = await db
    .insert(partners)
    .values({
      name: "Demo Partner Co.",
      apiKeyHash: sha256(apiKey),
      apiSecretHash: sha256(apiSecret),
      webhookUrl: "https://example.com/healthpay/webhook",
      webhookSecret,
      status: "active",
    })
    .returning();
  if (!partner) throw new Error("Failed to insert partner.");

  // ── Ops users ────────────────────────────────────────────────────────────────
  const opsPassword = "ChangeMe123!";
  const passwordHash = await bcrypt.hash(opsPassword, 10);
  const [admin] = await db
    .insert(opsUsers)
    .values([
      { email: "admin@healthpay.test", passwordHash, name: "Ops Admin", role: "admin" },
      { email: "agent@healthpay.test", passwordHash, name: "Ops Agent", role: "agent" },
    ])
    .returning();

  // ── Service requests ──────────────────────────────────────────────────────────
  const validityHours = Number(process.env.QUOTE_VALIDITY_HOURS ?? 48);
  for (const s of SAMPLES) {
    const last4 = s.nid.slice(-4);
    const quoteToken = token("qt");
    const expiresAt = new Date(Date.now() + validityHours * 3600_000);
    // Expired sample: push expiry into the past.
    if (s.status === "expired") expiresAt.setTime(Date.now() - 3600_000);

    const [req] = await db
      .insert(serviceRequests)
      .values({
        partnerId: partner.id,
        serviceType: s.serviceType,
        governorate: s.governorate,
        city: s.city,
        nationalIdEncrypted: encryptPii(s.nid),
        nationalIdLast4: last4,
        mobileEncrypted: encryptPii(s.mobile),
        mobileE164: s.mobile,
        status: s.status,
        partnerReference: s.partnerReference,
        quoteTokenHash: sha256(quoteToken),
        quoteExpiresAt: expiresAt,
      })
      .returning();
    if (!req) continue;

    // Attach options for quoted/confirmed requests.
    if (s.status === "quoted" || s.status === "confirmed") {
      const optionRows = [
        { list: 800, disc: 560, provider: "Cairo Medical Center", desc: "Standard consultation" },
        { list: 800, disc: 480, provider: "Nile Diagnostics", desc: "Consultation + report" },
        { list: 800, disc: 360, provider: "Delta Health Hub", desc: "Premium package" },
      ];
      const inserted = await db
        .insert(pricingOptions)
        .values(
          optionRows.map((o) => ({
            requestId: req.id,
            providerName: o.provider,
            serviceDescription: o.desc,
            listPrice: o.list.toFixed(2),
            discountedPrice: o.disc.toFixed(2),
            discountPct: computeDiscountPct(o.list, o.disc).toFixed(2),
            currency: "EGP",
            validityNote: "Valid for 30 days at listed branch.",
            createdBy: admin?.id ?? null,
          })),
        )
        .returning();

      if (s.status === "confirmed" && inserted[0]) {
        await db.insert(confirmations).values({
          requestId: req.id,
          selectedOptionId: inserted[0].id,
          confirmedFrom: "hosted_page",
        });
      }
    }
  }

  console.log("✔ Seed complete.\n");
  console.log("─".repeat(60));
  console.log("Demo partner credentials (shown once — copy now):");
  console.log(`  API key:        ${apiKey}`);
  console.log(`  API secret:     ${apiSecret}`);
  console.log(`  Webhook secret: ${webhookSecret}`);
  console.log("Ops login:");
  console.log(`  admin@healthpay.test / ${opsPassword}  (admin)`);
  console.log(`  agent@healthpay.test / ${opsPassword}  (agent)`);
  console.log("─".repeat(60));
}

main()
  .then(() => closeDb())
  .catch(async (err) => {
    console.error("Seed failed:", err);
    await closeDb();
    process.exit(1);
  });
