/**
 * Generate an OpenAPI 3.1 spec from the zod schemas (single source of truth).
 * Writes docs/openapi.json at the repo root.
 *
 *   pnpm --filter @healthpay/web openapi
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodTypeAny } from "zod";
import {
  createRequestSchema,
  attachOptionsSchema,
  confirmSchema,
  pricingOptionInputSchema,
  providerSearchQuerySchema,
} from "@healthpay/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

function schema(z: ZodTypeAny, name: string) {
  return zodToJsonSchema(z, { name, target: "openApi3", $refStrategy: "none" });
}

const errorSchema = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        details: {},
      },
      required: ["code", "message"],
    },
  },
};

const partnerSecurity = [{ apiKey: [], hmacTimestamp: [], hmacSignature: [] }];

const errorResponses = {
  "401": { description: "Authentication failed", content: jsonOf("Error") },
  "404": { description: "Not found", content: jsonOf("Error") },
  "409": { description: "Conflict / illegal state transition", content: jsonOf("Error") },
  "422": { description: "Validation failed", content: jsonOf("Error") },
  "429": { description: "Rate limit exceeded", content: jsonOf("Error") },
};

function jsonOf(ref: string) {
  return { "application/json": { schema: { $ref: `#/components/schemas/${ref}` } } };
}
function jsonInline(s: unknown) {
  return { "application/json": { schema: s } };
}

const doc = {
  openapi: "3.1.0",
  info: {
    title: "HealthPay Quote Engine API",
    version: "1.0.0",
    description:
      "Medical-discount pricing quotes. HealthPay is NOT insurance — every request is a quote-for-discount-pricing flow. No clinical data is collected.",
  },
  servers: [{ url: "https://quotes.healthpay.example" }, { url: "http://localhost:3000" }],
  components: {
    securitySchemes: {
      apiKey: { type: "apiKey", in: "header", name: "X-HP-Key" },
      hmacTimestamp: { type: "apiKey", in: "header", name: "X-HP-Timestamp" },
      hmacSignature: {
        type: "apiKey",
        in: "header",
        name: "X-HP-Signature",
        description: "hex HMAC-SHA256 over `${timestamp}.${rawBody}` with your API secret.",
      },
    },
    schemas: {
      Error: errorSchema,
      CreateRequest: schema(createRequestSchema, "CreateRequest"),
      AttachOptions: schema(attachOptionsSchema, "AttachOptions"),
      PricingOptionInput: schema(pricingOptionInputSchema, "PricingOptionInput"),
      Confirm: schema(confirmSchema, "Confirm"),
      ProviderSearch: schema(providerSearchQuerySchema, "ProviderSearch"),
    },
  },
  paths: {
    "/api/v1/providers": {
      get: {
        summary: "Search the provider directory (service matching)",
        security: partnerSecurity,
        parameters: [
          query("governorate"),
          query("area"),
          query("providerType"),
          query("specialty"),
          query("q"),
        ],
        responses: { "200": { description: "OK" }, ...errorResponses },
      },
    },
    "/api/v1/requests": {
      post: {
        summary: "Create a service request",
        security: partnerSecurity,
        requestBody: { required: true, content: jsonOf("CreateRequest") },
        responses: {
          "201": {
            description: "Created",
            content: jsonInline({
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                status: { type: "string" },
                quote_url: { type: "string", format: "uri" },
                expires_at: { type: "string", format: "date-time" },
              },
            }),
          },
          ...errorResponses,
        },
      },
    },
    "/api/v1/requests/{id}": {
      get: {
        summary: "Get request status + options",
        security: partnerSecurity,
        parameters: [pathId()],
        responses: { "200": { description: "OK" }, ...errorResponses },
      },
    },
    "/api/v1/requests/{id}/confirm": {
      post: {
        summary: "Confirm a selected option (via SDK)",
        security: partnerSecurity,
        parameters: [pathId()],
        requestBody: { required: true, content: jsonOf("Confirm") },
        responses: { "200": { description: "Confirmed" }, ...errorResponses },
      },
    },
    "/api/v1/requests/{id}/cancel": {
      post: {
        summary: "Cancel a request",
        security: partnerSecurity,
        parameters: [pathId()],
        responses: { "200": { description: "Cancelled" }, ...errorResponses },
      },
    },
    "/api/v1/quote/{token}": {
      get: {
        summary: "Hosted quote page data (token auth)",
        parameters: [pathParam("token")],
        responses: { "200": { description: "OK" }, "404": errorResponses["404"] },
      },
    },
    "/api/v1/quote/{token}/confirm": {
      post: {
        summary: "Confirm from the hosted page (token auth)",
        parameters: [pathParam("token")],
        requestBody: { required: true, content: jsonOf("Confirm") },
        responses: {
          "200": { description: "Confirmed" },
          "404": errorResponses["404"],
          "409": errorResponses["409"],
        },
      },
    },
    "/api/v1/ops/requests": {
      get: {
        summary: "Ops: filtered, paginated request queue (session auth)",
        responses: { "200": { description: "OK" }, "401": errorResponses["401"] },
      },
    },
    "/api/v1/ops/requests/{id}/options": {
      post: {
        summary: "Ops: attach one or more pricing options (session auth)",
        parameters: [pathId()],
        requestBody: { required: true, content: jsonOf("AttachOptions") },
        responses: { "201": { description: "Quoted" }, ...errorResponses },
      },
    },
  },
};

function pathId() {
  return pathParam("id", "uuid");
}
function pathParam(name: string, format?: string) {
  return {
    name,
    in: "path",
    required: true,
    schema: { type: "string", ...(format ? { format } : {}) },
  };
}
function query(name: string) {
  return { name, in: "query", required: false, schema: { type: "string" } };
}

const outDir = resolve(repoRoot, "docs");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, "openapi.json");
writeFileSync(outPath, JSON.stringify(doc, null, 2) + "\n");
console.log(`Wrote ${outPath}`);
