/**
 * Canonical domain error hierarchy.
 *
 * These are shared between the API (which maps them to HTTP responses) and the
 * SDK (which re-throws them to partner code). Each error carries a stable
 * machine-readable `code` so callers can branch without string-matching messages.
 */

export type ErrorCode =
  | "validation_error"
  | "auth_error"
  | "rate_limit"
  | "not_found"
  | "invalid_transition"
  | "conflict";

export class HealthPayError extends Error {
  readonly code: ErrorCode;
  /** HTTP status the API should map this error to. */
  readonly httpStatus: number;
  /** Optional structured detail (e.g. field-level validation issues). */
  readonly details?: unknown;

  constructor(
    code: ErrorCode,
    httpStatus: number,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return { error: { code: this.code, message: this.message, details: this.details } };
  }
}

export class ValidationError extends HealthPayError {
  constructor(message = "Validation failed", details?: unknown) {
    super("validation_error", 422, message, details);
  }
}

export class AuthError extends HealthPayError {
  constructor(message = "Authentication failed", details?: unknown) {
    super("auth_error", 401, message, details);
  }
}

export class RateLimitError extends HealthPayError {
  /** Seconds the caller should wait before retrying, if known. */
  readonly retryAfterSeconds?: number;
  constructor(message = "Rate limit exceeded", retryAfterSeconds?: number) {
    super("rate_limit", 429, message, { retryAfterSeconds });
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class NotFoundError extends HealthPayError {
  constructor(message = "Resource not found", details?: unknown) {
    super("not_found", 404, message, details);
  }
}

export class InvalidTransitionError extends HealthPayError {
  constructor(message: string, details?: unknown) {
    super("invalid_transition", 409, message, details);
  }
}

export class ConflictError extends HealthPayError {
  constructor(message = "Conflict", details?: unknown) {
    super("conflict", 409, message, details);
  }
}
