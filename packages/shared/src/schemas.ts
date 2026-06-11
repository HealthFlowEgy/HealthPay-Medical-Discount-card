/**
 * Zod schemas for API inputs/outputs. These are the single source of truth for
 * request validation and are reused to generate the OpenAPI spec and the SDK
 * types. Domain rules (national ID, mobile, governorate, pricing) are delegated
 * to the dedicated validators so logic is not duplicated.
 */

import { z } from "zod";
import { GOVERNORATES } from "./governorates.js";
import { SERVICE_TYPES } from "./service-type.js";
import { PROVIDER_TYPES, specialtyRequiredFor } from "./provider-types.js";
import { SPECIALTIES } from "./specialties.js";
import { GENDERS, MARITAL_STATUSES } from "./member.js";
import { validateNationalId } from "./national-id.js";
import { normalizeEgyptianMobile } from "./mobile.js";
import { validateFullName } from "./name.js";
import { validatePricing, DEFAULT_CURRENCY } from "./pricing.js";
import { REQUEST_STATUSES } from "./state-machine.js";

export const governorateSchema = z.enum(GOVERNORATES);
export const serviceTypeSchema = z.enum(SERVICE_TYPES);
export const providerTypeSchema = z.enum(PROVIDER_TYPES);
export const specialtySchema = z.enum(SPECIALTIES);
export const genderSchema = z.enum(GENDERS);
export const maritalStatusSchema = z.enum(MARITAL_STATUSES);
export const requestStatusSchema = z.enum(REQUEST_STATUSES);

/** National ID: validated and transformed to expose only non-sensitive parts. */
export const nationalIdSchema = z
  .string()
  .transform((v) => v.trim())
  .superRefine((v, ctx) => {
    const res = validateNationalId(v);
    if (!res.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: res.reason });
    }
  });

/** Mobile: normalized to E.164 on success. The output IS the +20… string. */
export const mobileSchema = z.string().transform((v, ctx) => {
  const res = normalizeEgyptianMobile(v);
  if (!res.ok) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: res.reason });
    return z.NEVER;
  }
  return res.e164;
});

const latSchema = z.number().min(-90).max(90);
const lngSchema = z.number().min(-180).max(180);

/** POST /api/v1/requests — partner creates a service request. */
export const createRequestSchema = z
  .object({
    // Service matching: `providerType` is the primary axis; `serviceType` is
    // accepted for back-compat. At least one must be supplied.
    providerType: providerTypeSchema.optional(),
    serviceType: serviceTypeSchema.optional(),
    specialty: specialtySchema.optional(),
    governorate: governorateSchema,
    area: z.string().trim().min(1).max(120).optional(),
    city: z.string().trim().min(1).max(120).optional(),
    lat: latSchema.optional(),
    lng: lngSchema.optional(),
    /** Optional: a directory provider the member/partner pre-selected. */
    providerId: z.string().uuid().optional(),
    nationalId: nationalIdSchema,
    mobile: mobileSchema,
    /** Exact services requested (optional for partners, required in the portal). */
    requestedServices: z.string().trim().max(1000).optional(),
    // Member intake (from the "أسئلة اساسية" sheet). Name/company/marital are
    // captured here; gender + DOB are also derivable from the national ID.
    memberNameEn: z.string().trim().max(200).optional(),
    memberNameAr: z.string().trim().max(200).optional(),
    company: z.string().trim().max(200).optional(),
    gender: genderSchema.optional(),
    maritalStatus: maritalStatusSchema.optional(),
    partnerReference: z.string().trim().max(255).optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.providerType && !v.serviceType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either `providerType` or `serviceType`.",
        path: ["providerType"],
      });
    }
  });
export type CreateRequestInput = z.input<typeof createRequestSchema>;
export type CreateRequestParsed = z.output<typeof createRequestSchema>;

/** A single pricing option attached by ops. */
export const pricingOptionInputSchema = z
  .object({
    /** Optional link to a directory provider; providerName stays the display value. */
    providerId: z.string().uuid().optional(),
    /** Marks this option as an alternative to the provider the client chose. */
    isAlternative: z.boolean().optional(),
    providerName: z.string().trim().min(1).max(200),
    providerAddress: z.string().trim().max(500).optional(),
    serviceDescription: z.string().trim().min(1).max(500),
    listPrice: z.number().positive(),
    discountedPrice: z.number().positive(),
    currency: z.string().trim().length(3).default(DEFAULT_CURRENCY),
    validityNote: z.string().trim().max(500).optional(),
    extraInfo: z.record(z.unknown()).optional(),
  })
  .superRefine((v, ctx) => {
    const res = validatePricing(v.listPrice, v.discountedPrice);
    if (!res.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: res.reason,
        path: ["discountedPrice"],
      });
    }
  });
export type PricingOptionInput = z.input<typeof pricingOptionInputSchema>;

/** POST /api/v1/ops/requests/:id/options — attach one or more options. */
export const attachOptionsSchema = z.object({
  options: z.array(pricingOptionInputSchema).min(1).max(10),
});

/** Confirm a quote by selecting exactly one option. */
export const confirmSchema = z.object({
  optionId: z.string().uuid(),
});

/** Required "exact services" the member needs (non-empty, not generic). */
export const requestedServicesSchema = z
  .string()
  .trim()
  .min(3, "Specify the exact services required.")
  .max(1000);

/** Full (quadruple) name — must match the national ID card. */
export const fullNameSchema = z.string().transform((v) => v.trim()).superRefine((v, ctx) => {
  const res = validateFullName(v);
  if (!res.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: res.reason });
});

/** Client portal registration. */
export const clientRegisterSchema = z.object({
  fullName: fullNameSchema,
  nationalId: nationalIdSchema,
  mobile: mobileSchema,
  whatsapp: z.coerce.boolean().default(true),
  password: z.string().min(8, "Password must be at least 8 characters.").max(100),
});
export type ClientRegisterInput = z.input<typeof clientRegisterSchema>;

/** Client portal login (by national ID + password). */
export const clientLoginSchema = z.object({
  nationalId: z.string().trim().min(1),
  password: z.string().min(1),
});

/** Client portal request (PII comes from the authenticated client account). */
export const portalRequestSchema = z
  .object({
    providerType: providerTypeSchema.optional(),
    serviceType: serviceTypeSchema.optional(),
    specialty: specialtySchema.optional(),
    governorate: governorateSchema,
    area: z.string().trim().min(1).max(120).optional(),
    city: z.string().trim().min(1).max(120).optional(),
    providerId: z.string().uuid().optional(),
    requestedServices: requestedServicesSchema,
    /** Set when an "Other (not listed)" service was entered manually. */
    servicesNeedsReview: z.coerce.boolean().optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.providerType && !v.serviceType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either `providerType` or `serviceType`.",
        path: ["providerType"],
      });
    }
    // Specialty is mandatory for doctors' clinics / hospitals / specialized centers.
    if (v.providerType && specialtyRequiredFor(v.providerType) && !v.specialty) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Specialty is required for this provider type.",
        path: ["specialty"],
      });
    }
  });
export type PortalRequestInput = z.input<typeof portalRequestSchema>;
export type PortalRequestParsed = z.output<typeof portalRequestSchema>;

export const opsRoleSchema = z.enum(["admin", "agent"]);

/** Open staff self-signup (defaults to agent role). */
export const opsRegisterSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(2).max(200),
  password: z.string().min(8, "Password must be at least 8 characters.").max(100),
  signupCode: z.string().optional(),
});

/** Admin creates a staff account. */
export const opsUserCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(2).max(200),
  password: z.string().min(8).max(100),
  role: opsRoleSchema.default("agent"),
});

/** Admin updates a staff account (role / active). */
export const opsUserUpdateSchema = z.object({
  role: opsRoleSchema.optional(),
  active: z.boolean().optional(),
});

/** Admin updates a client account (suspend / reactivate). */
export const clientUpdateSchema = z.object({
  active: z.boolean(),
});

/** Provider directory search (GET /api/v1/providers and ops equivalent). */
export const providerSearchQuerySchema = z.object({
  governorate: governorateSchema.optional(),
  area: z.string().trim().max(120).optional(),
  providerType: providerTypeSchema.optional(),
  specialty: specialtySchema.optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

/** Ops queue filters. */
export const opsQueueQuerySchema = z.object({
  status: requestStatusSchema.optional(),
  governorate: governorateSchema.optional(),
  serviceType: serviceTypeSchema.optional(),
  providerType: providerTypeSchema.optional(),
  specialty: specialtySchema.optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
