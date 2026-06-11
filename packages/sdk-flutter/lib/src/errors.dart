/// Typed errors for the HealthPay Quote SDK. No third-party dependencies.

enum SdkErrorCode {
  validationError,
  authError,
  rateLimit,
  notFound,
  invalidTransition,
  conflict,
  networkError,
  unknown,
}

/// Base error. Catch this to handle any SDK failure, or catch a subclass.
class HealthPayError implements Exception {
  const HealthPayError(
    this.code,
    this.message, {
    this.status,
    this.details,
  });

  final SdkErrorCode code;
  final String message;
  final int? status;
  final Object? details;

  @override
  String toString() => 'HealthPayError(${code.name}): $message';
}

class ValidationError extends HealthPayError {
  const ValidationError(String message, {int? status, Object? details})
      : super(SdkErrorCode.validationError, message, status: status, details: details);
}

class AuthError extends HealthPayError {
  const AuthError(String message, {int? status, Object? details})
      : super(SdkErrorCode.authError, message, status: status, details: details);
}

class RateLimitError extends HealthPayError {
  const RateLimitError(String message, {int? status, this.retryAfterSeconds})
      : super(SdkErrorCode.rateLimit, message, status: status, details: retryAfterSeconds);

  final int? retryAfterSeconds;
}

class NotFoundError extends HealthPayError {
  const NotFoundError(String message, {int? status, Object? details})
      : super(SdkErrorCode.notFound, message, status: status, details: details);
}

class ConflictError extends HealthPayError {
  const ConflictError(String message, {int? status, Object? details})
      : super(SdkErrorCode.conflict, message, status: status, details: details);
}

class NetworkError extends HealthPayError {
  const NetworkError(String message)
      : super(SdkErrorCode.networkError, message);
}

/// Build the right error subclass from an API error response body.
HealthPayError errorFromResponse(
  int status,
  Map<String, dynamic>? body, {
  int? retryAfter,
}) {
  final error = body?['error'] as Map<String, dynamic>?;
  final code = error?['code'] as String? ?? 'unknown';
  final message =
      error?['message'] as String? ?? 'Request failed with status $status';
  final details = error?['details'];
  switch (code) {
    case 'validation_error':
      return ValidationError(message, status: status, details: details);
    case 'auth_error':
      return AuthError(message, status: status, details: details);
    case 'rate_limit':
      return RateLimitError(message, status: status, retryAfterSeconds: retryAfter);
    case 'not_found':
      return NotFoundError(message, status: status, details: details);
    case 'invalid_transition':
    case 'conflict':
      return ConflictError(message, status: status, details: details);
    default:
      return HealthPayError(SdkErrorCode.unknown, message, status: status, details: details);
  }
}
