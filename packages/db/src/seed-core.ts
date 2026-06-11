/**
 * Programmatic seeding shared by the CLI seed script and the one-shot
 * `/api/v1/internal/db/setup` route. Takes already-parsed provider rows (the
 * caller decides whether they came from the gzipped file or the embedded data),
 * so this module has no filesystem dependency.
 */

import { createHash, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  validateNationalId,
  computeDiscountPct,
  serviceTypeToProviderType,
  type ServiceType,
  type Governorate,
  type ProviderType,
  type Specialty,
} from "@healthpay/shared";
import type { Database } from "./client.js";
import { encryptPii } from "./crypto.js";
import { SERVICE_CATALOG_DATA } from "./embedded.js";
import {
  partners,
  providers,
  opsUsers,
  serviceRequests,
  pricingOptions,
  confirmations,
  serviceCatalog,
} from "./schema.js";

/** Fallback service catalog by provider type (used until per-provider data is imported). */
async function insertServiceCatalog(db: Database): Promise<number> {
  for (let i = 0; i < SERVICE_CATALOG_DATA.length; i += 1000) {
    await db.insert(serviceCatalog).values(SERVICE_CATALOG_DATA.slice(i, i + 1000));
  }
  return SERVICE_CATALOG_DATA.length;
}

export interface ProviderSeedRow {
  governorate: Governorate | null;
  governorateAr: string | null;
  area: string | null;
  address: string | null;
  providerType: ProviderType | null;
  specialty: Specialty | null;
  specialtyRaw: string | null;
  name: string;
}

export interface SeedResult {
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
  opsPassword: string;
  providerCount: number;
  requestCount: number;
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const token = (p: string) => `${p}_${randomBytes(24).toString("base64url")}`;

function buildNid(
  century: 2 | 3,
  yy: string,
  mm: string,
  dd: string,
  gov: string,
  serial: string,
): string {
  const nid = `${century}${yy}${mm}${dd}${gov}${serial}1`;
  if (nid.length !== 14) throw new Error(`Bad NID length: ${nid}`);
  const res = validateNationalId(nid);
  if (!res.ok) throw new Error(`Seed produced invalid NID ${nid}: ${res.reason}`);
  return nid;
}

interface SampleRequest {
  serviceType: ServiceType;
  governorate: Governorate;
  city?: string;
  nid: string;
  mobile: string;
  partnerReference: string;
  status: "pending_quote" | "quoted" | "confirmed" | "expired" | "cancelled";
}

const SAMPLES: SampleRequest[] = [
  { serviceType: "medical_clinic_visit", governorate: "Cairo", city: "Nasr City", nid: buildNid(3, "01", "01", "01", "01", "2345"), mobile: "+201001234501", partnerReference: "order_1001", status: "pending_quote" },
  { serviceType: "dental_clinic_visit", governorate: "Giza", city: "Dokki", nid: buildNid(2, "98", "06", "15", "21", "1234"), mobile: "+201112234502", partnerReference: "order_1002", status: "pending_quote" },
  { serviceType: "lab_investigation", governorate: "Alexandria", city: "Smouha", nid: buildNid(3, "00", "11", "20", "02", "3456"), mobile: "+201221234503", partnerReference: "order_1003", status: "quoted" },
  { serviceType: "radiology_investigation", governorate: "Dakahlia", city: "Mansoura", nid: buildNid(2, "95", "03", "10", "12", "4566"), mobile: "+201501234504", partnerReference: "order_1004", status: "quoted" },
  { serviceType: "lab_investigation", governorate: "Sharqia", city: "Zagazig", nid: buildNid(3, "02", "07", "07", "13", "1235"), mobile: "+201001234505", partnerReference: "order_1005", status: "confirmed" },
  { serviceType: "medical_clinic_visit", governorate: "Aswan", nid: buildNid(2, "90", "12", "31", "28", "1234"), mobile: "+201112234506", partnerReference: "order_1006", status: "expired" },
];

const SAMPLE_NAMES: Array<[string, string, string]> = [
  ["Ahmed Mansour", "أحمد منصور", "Acme Corp"],
  ["Sara Ali", "سارة علي", "Nile Tech"],
  ["Mohamed Hassan", "محمد حسن", "Delta Foods"],
  ["Mona Ibrahim", "منى إبراهيم", "Cairo Bank"],
  ["Omar Khaled", "عمر خالد", "Giza Pharma"],
  ["Laila Fouad", "ليلى فؤاد", "Suez Logistics"],
];

/** Sync the service catalog from the reference data (replace when it differs). */
export async function ensureServiceCatalog(db: Database): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(serviceCatalog);
  if ((row?.count ?? 0) === SERVICE_CATALOG_DATA.length) return 0;
  await db.delete(serviceCatalog);
  return insertServiceCatalog(db);
}

/** Idempotent full seed: clears app tables, loads providers + demo data. */
export async function seedAll(
  db: Database,
  providerRows: ProviderSeedRow[],
  opts: { validityHours?: number } = {},
): Promise<SeedResult> {
  // Clear in FK-safe order.
  await db.delete(confirmations);
  await db.delete(pricingOptions);
  await db.delete(serviceRequests);
  await db.delete(serviceCatalog);
  await db.delete(providers);
  await db.delete(partners);
  await db.delete(opsUsers);

  // Service catalog (reference data).
  await insertServiceCatalog(db);

  // Providers directory (batched).
  const batch = 500;
  for (let i = 0; i < providerRows.length; i += batch) {
    await db.insert(providers).values(providerRows.slice(i, i + batch));
  }

  // Demo partner.
  const apiKey = token("hp_live");
  const apiSecret = token("hps");
  const webhookSecret = token("whsec");
  const [partner] = await db
    .insert(partners)
    .values({
      name: "Demo Partner Co.",
      apiKeyHash: sha256(apiKey),
      apiSecretEncrypted: encryptPii(apiSecret),
      webhookUrl: "https://example.com/healthpay/webhook",
      webhookSecret,
      status: "active",
    })
    .returning();

  // Ops users.
  const opsPassword = "ChangeMe123!";
  const passwordHash = await bcrypt.hash(opsPassword, 10);
  const [admin] = await db
    .insert(opsUsers)
    .values([
      { email: "admin@healthpay.test", passwordHash, name: "Ops Admin", role: "admin" },
      { email: "agent@healthpay.test", passwordHash, name: "Ops Agent", role: "agent" },
    ])
    .returning();

  // Sample requests.
  const validityHours = opts.validityHours ?? 48;
  let idx = 0;
  for (const s of SAMPLES) {
    const quoteToken = token("qt");
    const expiresAt = new Date(Date.now() + validityHours * 3600_000);
    if (s.status === "expired") expiresAt.setTime(Date.now() - 3600_000);
    const parsed = validateNationalId(s.nid);
    const gender = parsed.ok ? parsed.parsed.gender : null;
    const [nameEn, nameAr, company] = SAMPLE_NAMES[idx % SAMPLE_NAMES.length]!;
    idx++;

    const [req] = await db
      .insert(serviceRequests)
      .values({
        partnerId: partner!.id,
        serviceType: s.serviceType,
        providerType: serviceTypeToProviderType(s.serviceType),
        governorate: s.governorate,
        city: s.city,
        nationalIdEncrypted: encryptPii(s.nid),
        nationalIdLast4: s.nid.slice(-4),
        mobileEncrypted: encryptPii(s.mobile),
        mobileE164: s.mobile,
        memberNameEn: nameEn,
        memberNameAr: nameAr,
        company,
        gender,
        status: s.status,
        partnerReference: s.partnerReference,
        quoteTokenHash: sha256(quoteToken),
        quoteExpiresAt: expiresAt,
      })
      .returning();
    if (!req) continue;

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

  return {
    apiKey,
    apiSecret,
    webhookSecret,
    opsPassword,
    providerCount: providerRows.length,
    requestCount: SAMPLES.length,
  };
}
