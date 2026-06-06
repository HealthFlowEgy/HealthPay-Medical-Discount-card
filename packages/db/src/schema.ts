/**
 * Drizzle schema for the HealthPay Quote Engine.
 *
 * PII NOTE: `national_id` and `mobile` are stored ONLY in their encrypted
 * columns (AES-256-GCM). The plaintext never touches the database. Non-sensitive
 * derivatives — `national_id_last4`, `mobile_e164` — are stored separately for
 * display and search. See `crypto.ts`.
 *
 * Enum value lists are imported from @healthpay/shared so the database and the
 * application can never drift apart.
 */

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  timestamp,
  integer,
  numeric,
  jsonb,
  doublePrecision,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
// Enum value lists come straight from @healthpay/shared — single source of
// truth. The migration toolchain (drizzle-kit) resolves this at runtime via the
// package's compiled `dist`, so `@healthpay/shared` must be built before
// `db:generate` / `db:migrate` (wired into those scripts).
import {
  SERVICE_TYPES,
  GOVERNORATES,
  REQUEST_STATUSES,
  PROVIDER_TYPES,
  SPECIALTIES,
  GENDERS,
  MARITAL_STATUSES,
} from "@healthpay/shared";

// ── Enums ───────────────────────────────────────────────────────────────────
export const serviceTypeEnum = pgEnum("service_type", SERVICE_TYPES);
export const governorateEnum = pgEnum("governorate", GOVERNORATES);
export const requestStatusEnum = pgEnum("request_status", REQUEST_STATUSES);
export const providerTypeEnum = pgEnum("provider_type", PROVIDER_TYPES);
export const specialtyEnum = pgEnum("specialty", SPECIALTIES);
export const genderEnum = pgEnum("gender", GENDERS);
export const maritalStatusEnum = pgEnum("marital_status", MARITAL_STATUSES);
export const partnerStatusEnum = pgEnum("partner_status", ["active", "suspended"]);
export const opsRoleEnum = pgEnum("ops_role", ["admin", "agent"]);
export const actorTypeEnum = pgEnum("actor_type", ["partner", "ops", "user", "system"]);
export const confirmedFromEnum = pgEnum("confirmed_from", ["hosted_page", "sdk"]);
export const webhookStatusEnum = pgEnum("webhook_status", [
  "pending",
  "delivered",
  "failed",
  "exhausted",
]);

// ── Partners ──────────────────────────────────────────────────────────────────
export const partners = pgTable(
  "partners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    // API key is a bearer credential → stored one-way (sha256) for lookup.
    apiKeyHash: text("api_key_hash").notNull(),
    // API secret is the HMAC signing key → must be recoverable to verify
    // signatures, so it is stored ENCRYPTED at rest (AES-256-GCM), never hashed.
    apiSecretEncrypted: text("api_secret_encrypted").notNull(),
    webhookUrl: text("webhook_url"),
    webhookSecret: text("webhook_secret"),
    status: partnerStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    apiKeyHashIdx: uniqueIndex("partners_api_key_hash_idx").on(t.apiKeyHash),
  }),
);

// ── Providers (service directory) ─────────────────────────────────────────────
export const providers = pgTable(
  "providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    governorate: governorateEnum("governorate"),
    governorateAr: text("governorate_ar"),
    area: text("area"),
    address: text("address"),
    providerType: providerTypeEnum("provider_type"),
    specialty: specialtyEnum("specialty"),
    // Original Arabic specialty string from the source directory (lossless).
    specialtyRaw: text("specialty_raw"),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    governorateIdx: index("providers_governorate_idx").on(t.governorate),
    areaIdx: index("providers_area_idx").on(t.area),
    providerTypeIdx: index("providers_provider_type_idx").on(t.providerType),
    specialtyIdx: index("providers_specialty_idx").on(t.specialty),
  }),
);

// ── Service requests ──────────────────────────────────────────────────────────
export const serviceRequests = pgTable(
  "service_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "restrict" }),
    // `serviceType` is retained (derived) for back-compat; `providerType` +
    // `specialty` are the richer matching axes from the directory.
    serviceType: serviceTypeEnum("service_type").notNull(),
    providerType: providerTypeEnum("provider_type"),
    specialty: specialtyEnum("specialty"),
    governorate: governorateEnum("governorate").notNull(),
    area: text("area"),
    city: text("city"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    // Optional pre-selected directory provider.
    providerId: uuid("provider_id").references(() => providers.id, {
      onDelete: "set null",
    }),
    // PII — encrypted at rest (AES-256-GCM payloads).
    nationalIdEncrypted: text("national_id_encrypted").notNull(),
    nationalIdLast4: varchar("national_id_last4", { length: 4 }).notNull(),
    mobileEncrypted: text("mobile_encrypted").notNull(),
    mobileE164: varchar("mobile_e164", { length: 20 }).notNull(),
    // Member intake (from the "أسئلة اساسية" sheet).
    memberNameEn: varchar("member_name_en", { length: 200 }),
    memberNameAr: varchar("member_name_ar", { length: 200 }),
    company: varchar("company", { length: 200 }),
    gender: genderEnum("gender"),
    maritalStatus: maritalStatusEnum("marital_status"),
    status: requestStatusEnum("status").notNull().default("pending_quote"),
    partnerReference: varchar("partner_reference", { length: 255 }),
    note: text("note"),
    // Hosted quote page: only the token HASH is stored.
    quoteTokenHash: text("quote_token_hash").notNull(),
    quoteExpiresAt: timestamp("quote_expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    partnerIdx: index("service_requests_partner_idx").on(t.partnerId),
    statusIdx: index("service_requests_status_idx").on(t.status),
    governorateIdx: index("service_requests_governorate_idx").on(t.governorate),
    serviceTypeIdx: index("service_requests_service_type_idx").on(t.serviceType),
    mobileLast4Idx: index("service_requests_mobile_e164_idx").on(t.mobileE164),
    quoteTokenIdx: uniqueIndex("service_requests_quote_token_hash_idx").on(
      t.quoteTokenHash,
    ),
    createdAtIdx: index("service_requests_created_at_idx").on(t.createdAt),
  }),
);

// ── Pricing options ───────────────────────────────────────────────────────────
export const pricingOptions = pgTable(
  "pricing_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "cascade" }),
    // Optional link to a directory provider; providerName is the display value.
    providerId: uuid("provider_id").references(() => providers.id, {
      onDelete: "set null",
    }),
    providerName: varchar("provider_name", { length: 200 }).notNull(),
    providerAddress: text("provider_address"),
    serviceDescription: text("service_description").notNull(),
    listPrice: numeric("list_price", { precision: 12, scale: 2 }).notNull(),
    discountedPrice: numeric("discounted_price", { precision: 12, scale: 2 }).notNull(),
    // Computed & validated to 15–70 on write; stored for display/audit.
    discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("EGP"),
    validityNote: text("validity_note"),
    extraInfo: jsonb("extra_info"),
    createdBy: uuid("created_by").references(() => opsUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    requestIdx: index("pricing_options_request_idx").on(t.requestId),
  }),
);

// ── Confirmations ─────────────────────────────────────────────────────────────
export const confirmations = pgTable(
  "confirmations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "cascade" }),
    selectedOptionId: uuid("selected_option_id")
      .notNull()
      .references(() => pricingOptions.id, { onDelete: "restrict" }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedFrom: confirmedFromEnum("confirmed_from").notNull(),
  },
  (t) => ({
    // A request can be confirmed exactly once.
    requestIdx: uniqueIndex("confirmations_request_idx").on(t.requestId),
  }),
);

// ── Ops users ─────────────────────────────────────────────────────────────────
export const opsUsers = pgTable(
  "ops_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    role: opsRoleEnum("role").notNull().default("agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex("ops_users_email_idx").on(t.email),
  }),
);

// ── Audit log ─────────────────────────────────────────────────────────────────
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorType: actorTypeEnum("actor_type").notNull(),
    actorId: text("actor_id"),
    action: varchar("action", { length: 100 }).notNull(),
    requestId: uuid("request_id").references(() => serviceRequests.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    requestIdx: index("audit_log_request_idx").on(t.requestId),
    actionIdx: index("audit_log_action_idx").on(t.action),
    createdAtIdx: index("audit_log_created_at_idx").on(t.createdAt),
  }),
);

// ── Webhook deliveries ────────────────────────────────────────────────────────
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    requestId: uuid("request_id").references(() => serviceRequests.id, {
      onDelete: "set null",
    }),
    event: varchar("event", { length: 100 }).notNull(),
    payload: jsonb("payload").notNull(),
    status: webhookStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    partnerIdx: index("webhook_deliveries_partner_idx").on(t.partnerId),
    statusIdx: index("webhook_deliveries_status_idx").on(t.status),
    nextRetryIdx: index("webhook_deliveries_next_retry_idx").on(t.nextRetryAt),
  }),
);

// Re-export the timestamp default helper for migrations that need it.
export const nowSql = sql`now()`;

// ── Inferred types ────────────────────────────────────────────────────────────
export type Partner = typeof partners.$inferSelect;
export type NewPartner = typeof partners.$inferInsert;
export type Provider = typeof providers.$inferSelect;
export type NewProvider = typeof providers.$inferInsert;
export type ServiceRequest = typeof serviceRequests.$inferSelect;
export type NewServiceRequest = typeof serviceRequests.$inferInsert;
export type PricingOption = typeof pricingOptions.$inferSelect;
export type NewPricingOption = typeof pricingOptions.$inferInsert;
export type Confirmation = typeof confirmations.$inferSelect;
export type NewConfirmation = typeof confirmations.$inferInsert;
export type OpsUser = typeof opsUsers.$inferSelect;
export type NewOpsUser = typeof opsUsers.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
