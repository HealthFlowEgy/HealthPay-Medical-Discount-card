/**
 * Zod schemas for API inputs/outputs. These are the single source of truth for
 * request validation and are reused to generate the OpenAPI spec and the SDK
 * types. Domain rules (national ID, mobile, governorate, pricing) are delegated
 * to the dedicated validators so logic is not duplicated.
 */

import { z } from "zod";
import { GOVERNORATES } from "./governorates.js";
import { SERVICE_TYPES } from "./service-type.js";
import { validateNationalId } from "./national-id.js";
import { normalizeEgyptianMobile } from "./mobile.js";
import { validatePricing, DEFAULT_CURRENCY } from "./pricing.js";
import { REQUEST_STATUSES } from "./state-machine.js";

export const governorateSchema = z.enum(GOVERNORATES);
export const serviceTypeSchema = z.enum(SERVICE_TYPES);
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
export const createRequestSchema = z.object({
  serviceType: serviceTypeSchema,
  governorate: governorateSchema,
  city: z.string().trim().min(1).max(120).optional(),
  lat: latSchema.optional(),
  lng: lngSchema.optional(),
  nationalId: nationalIdSchema,
  mobile: mobileSchema,
  partnerReference: z.string().trim().max(255).optional(),
  note: z.string().trim().max(1000).optional(),
});
export type CreateRequestInput = z.input<typeof createRequestSchema>;
export type CreateRequestParsed = z.output<typeof createRequestSchema>;

/** A single pricing option attached by ops. */
export const pricingOptionInputSchema = z
  .object({
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

/** Ops queue filters. */
export const opsQueueQuerySchema = z.object({
  status: requestStatusSchema.optional(),
  governorate: governorateSchema.optional(),
  serviceType: serviceTypeSchema.optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
