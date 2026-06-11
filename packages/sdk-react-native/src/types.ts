/** Public types. Mirror the token-authenticated quote-page REST contract. */

export type RequestStatus =
  | "pending_quote"
  | "quoted"
  | "confirmed"
  | "completed"
  | "expired"
  | "cancelled";

/** One pricing option as seen by the token bearer (the member). */
export interface QuoteOption {
  id: string;
  /** Linked directory provider, if any. */
  providerId: string | null;
  /** True when proposed at a different provider than the member originally chose. */
  isAlternative: boolean;
  providerName: string;
  providerAddress: string | null;
  serviceDescription: string;
  listPrice: number;
  discountedPrice: number;
  discountPct: number;
  currency: string;
  validityNote: string | null;
  extraInfo: Record<string, unknown> | null;
}

/** The member-facing quote, returned by GET /api/v1/quote/:token. */
export interface Quote {
  id: string;
  status: RequestStatus;
  serviceType: string;
  providerType: string | null;
  specialty: string | null;
  governorate: string;
  area: string | null;
  city: string | null;
  /** Masked, e.g. "+20 100 •••• 567". */
  mobile: string;
  memberNameEn: string | null;
  memberNameAr: string | null;
  expiresAt: string;
  options: QuoteOption[];
  selectedOptionId: string | null;
}
