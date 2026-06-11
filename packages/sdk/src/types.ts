/** Public SDK types. Mirrors the REST API contract. */

// Bilingual taxonomy + label maps are re-exported from the shared catalog
// (bundled at build time, so the published SDK stays dependency-free).
export {
  type Locale,
  type BilingualLabel,
  label,
  dir,
  PROVIDER_TYPES,
  PROVIDER_TYPE_LABELS,
  type ProviderType,
  SPECIALTIES,
  SPECIALTY_LABELS,
  type Specialty,
  GOVERNORATES,
  GOVERNORATE_LABELS,
  type Governorate,
  GENDERS,
  GENDER_LABELS,
  type Gender,
  MARITAL_STATUSES,
  MARITAL_STATUS_LABELS,
  type MaritalStatus,
} from "@healthpay/shared/catalog";

import type { ProviderType, Specialty, Gender, MaritalStatus } from "@healthpay/shared/catalog";

export type ServiceType =
  | "medical_clinic_visit"
  | "dental_clinic_visit"
  | "lab_investigation"
  | "radiology_investigation";

export type RequestStatus =
  | "pending_quote"
  | "quoted"
  | "confirmed"
  | "completed"
  | "expired"
  | "cancelled";

/** Webhook event names HealthPay delivers to a partner's webhook_url. */
export type WebhookEvent =
  | "request.quoted"
  | "request.confirmed"
  | "request.completed"
  | "request.expired"
  | "request.cancelled";

export interface CreateRequestInput {
  /** Primary matching axis (8 directory provider types). */
  providerType?: ProviderType;
  /** Legacy alias for providerType; supply one or the other. */
  serviceType?: ServiceType;
  /** Optional specialty narrowing. */
  specialty?: Specialty;
  location: {
    governorate: string;
    area?: string;
    city?: string;
    lat?: number;
    lng?: number;
  };
  /** Optional pre-selected directory provider id. */
  providerId?: string;
  /** Exact services the member requested (free text; comma-separated). */
  requestedServices?: string;
  nationalId: string;
  mobile: string;
  memberNameEn?: string;
  memberNameAr?: string;
  company?: string;
  gender?: Gender;
  maritalStatus?: MaritalStatus;
  partnerReference?: string;
  note?: string;
}

export interface Provider {
  id: string;
  governorate: string | null;
  governorateAr: string | null;
  area: string | null;
  address: string | null;
  providerType: ProviderType | null;
  specialty: Specialty | null;
  specialtyRaw: string | null;
  name: string;
}

export interface ProviderSearchResult {
  items: Provider[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProviderSearchParams {
  governorate?: string;
  area?: string;
  providerType?: ProviderType;
  specialty?: Specialty;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface CreatedRequest {
  id: string;
  status: RequestStatus;
  quoteUrl: string;
  expiresAt: string;
}

export interface PricingOption {
  id: string;
  /** Linked directory provider, if any. */
  providerId: string | null;
  /** True when this is an alternative to the provider the member originally chose. */
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

export interface ServiceRequest {
  id: string;
  status: RequestStatus;
  serviceType: ServiceType;
  providerType: ProviderType | null;
  specialty: Specialty | null;
  governorate: string;
  area: string | null;
  city: string | null;
  providerId?: string | null;
  requestedServices?: string | null;
  mobile: string; // masked
  nationalIdLast4: string;
  memberNameEn?: string | null;
  memberNameAr?: string | null;
  company?: string | null;
  gender?: Gender | null;
  maritalStatus?: MaritalStatus | null;
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
