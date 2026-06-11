/** Typed errors. Self-contained — no runtime dependencies. */

export type SdkErrorCode =
  | "validation_error"
  | "auth_error"
  | "rate_limit"
  | "not_found"
  | "invalid_transition"
  | "conflict"
  | "network_error"
  | "unknown";

export class HealthPayError extends Error {
  readonly code: SdkErrorCode;
  readonly status?: number;
  readonly details?: unknown;
  constructor(code: SdkErrorCode, message: string, status?: number, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends HealthPayError {
  constructor(message: string, status?: number, details?: unknown) {
    super("validation_error", message, status, details);
  }
}
export class AuthError extends HealthPayError {
  constructor(message: string, status?: number, details?: unknown) {
    super("auth_error", message, status, details);
  }
}
export class RateLimitError extends HealthPayError {
  readonly retryAfterSeconds?: number;
  constructor(message: string, status?: number, retryAfterSeconds?: number) {
    super("rate_limit", message, status, { retryAfterSeconds });
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
export class NotFoundError extends HealthPayError {
  constructor(message: string, status?: number, details?: unknown) {
    super("not_found", message, status, details);
  }
}
export class ConflictError extends HealthPayError {
  constructor(message: string, status?: number, details?: unknown) {
    super("conflict", message, status, details);
  }
}
export class NetworkError extends HealthPayError {
  constructor(message: string) {
    super("network_error", message);
  }
}

/** Build the right error subclass from an API error response. */
export function errorFromResponse(
  status: number,
  body: { error?: { code?: string; message?: string; details?: unknown } } | undefined,
  retryAfter?: number,
): HealthPayError {
  const code = body?.error?.code ?? "unknown";
  const message = body?.error?.message ?? `Request failed with status ${status}`;
  const details = body?.error?.details;
  switch (code) {
    case "validation_error":
      return new ValidationError(message, status, details);
    case "auth_error":
      return new AuthError(message, status, details);
    case "rate_limit":
      return new RateLimitError(message, status, retryAfter);
    case "not_found":
      return new NotFoundError(message, status, details);
    case "invalid_transition":
    case "conflict":
      return new ConflictError(message, status, details);
    default:
      return new HealthPayError("unknown", message, status, details);
  }
}
