/** HTTP helpers: typed JSON responses and domain-error mapping. */

import { NextResponse } from "next/server";
import { z } from "zod";
import { HealthPayError, ValidationError } from "@healthpay/shared";

export function json<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

/** Map any thrown error to a consistent JSON error response. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof HealthPayError) {
    const headers: Record<string, string> = {};
    if (err.code === "rate_limit") {
      const retry = (err.details as { retryAfterSeconds?: number } | undefined)
        ?.retryAfterSeconds;
      if (retry) headers["Retry-After"] = String(retry);
    }
    return NextResponse.json(err.toJSON(), { status: err.httpStatus, headers });
  }
  if (err instanceof z.ZodError) {
    return NextResponse.json(new ValidationError("Validation failed", err.flatten()).toJSON(), {
      status: 422,
    });
  }
  console.error("Unhandled error:", err);
  return NextResponse.json(
    { error: { code: "internal_error", message: "Internal server error" } },
    { status: 500 },
  );
}

/** Parse + validate a JSON body with zod, throwing ValidationError on failure. */
export async function parseJson<S extends z.ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<z.output<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON.");
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Validation failed", result.error.flatten());
  }
  return result.data;
}

/** Wrap a route handler so thrown domain errors become clean responses. */
export function handler(
  fn: (req: Request, ctx: { params: Record<string, string> }) => Promise<Response>,
) {
  return async (req: Request, ctx: { params: Record<string, string> }) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
