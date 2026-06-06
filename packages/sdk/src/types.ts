/** Public SDK types. Mirrors the REST API contract. */

export type ServiceType =
  | "medical_clinic_visit"
  | "dental_clinic_visit"
  | "lab_investigation"
  | "radiology_investigation";

export type RequestStatus =
  | "pending_quote"
  | "quoted"
  | "confirmed"
  | "expired"
  | "cancelled";

export interface CreateRequestInput {
  serviceType: ServiceType;
  location: {
    governorate: string;
    city?: string;
    lat?: number;
    lng?: number;
  };
  nationalId: string;
  mobile: string;
  partnerReference?: string;
  note?: string;
}

export interface CreatedRequest {
  id: string;
  status: RequestStatus;
  quoteUrl: string;
  expiresAt: string;
}

export interface PricingOption {
  id: string;
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

export interface ServiceRequest {
  id: string;
  status: RequestStatus;
  serviceType: ServiceType;
  governorate: string;
  city: string | null;
  mobile: string; // masked
  nationalIdLast4: string;
  partnerReference: string | null;
  note: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  options?: PricingOption[];
  selectedOptionId?: string;
}

export interface ClientOptions {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  /** Override fetch (e.g. for testing or a custom agent). */
  fetch?: typeof fetch;
  /** Request timeout in ms (default 15000). */
  timeoutMs?: number;
}
