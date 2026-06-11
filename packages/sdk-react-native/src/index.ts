/** @healthpay/quote-sdk-react-native — public entry point. */

// Headless core (works without React Native too)
export { HealthPayQuoteClient, createQuoteClient } from "./client";
export type { QuoteClientOptions, PollOptions } from "./client";

// React hook
export { useQuoteFlow } from "./hooks";
export type { UseQuoteFlow, UseQuoteFlowOptions, FlowPhase } from "./hooks";

// Drop-in UI
export { HealthPayQuoteFlow } from "./ui/QuoteFlow";
export type { HealthPayQuoteFlowProps } from "./ui/QuoteFlow";

// Theming & i18n
export { defaultTheme, resolveTheme } from "./theme";
export type { HealthPayTheme } from "./theme";
export { STRINGS, resolveStrings, isRTL } from "./i18n";
export type { Locale, FlowStrings } from "./i18n";

// Formatting helpers
export { formatPrice, formatNumber, formatDiscount } from "./format";

// Types & errors
export type { Quote, QuoteOption, RequestStatus } from "./types";
export {
  HealthPayError,
  ValidationError,
  AuthError,
  RateLimitError,
  NotFoundError,
  ConflictError,
  NetworkError,
} from "./errors";
export type { SdkErrorCode } from "./errors";
