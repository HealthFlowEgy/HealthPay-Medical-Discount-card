# Service Matching & Provider Directory

This document explains how service matching works, derived from the HealthPay
provider spreadsheet (`اختيار مقدم الخدمة` / `أسئلة اساسية`).

## The matching model

A member is matched to a **provider** through a five-level hierarchy:

```
Governorate (المحافظة)  →  Area (المنطقة)  →  Provider type (نوع مقدم الخدمة)
                        →  Specialty (التخصص)  →  Provider (اسم مقدم الخدمة)
```

- **27 governorates**, **243 areas**, **8 provider types**, **26 canonical
  specialties** (normalized from 33 Arabic source strings), **3,386 providers**.

### Provider types (8)

`labs` · `hospital` · `dental_clinics` · `physiotherapy_centers` ·
`doctors_clinics` · `radiology_centers` · `outpatient_clinic_centers` ·
`specialized_centers_outpatient`

Each has a bilingual label (`PROVIDER_TYPE_LABELS` in `@healthpay/shared`). The
legacy 4-value `serviceType` is kept as a back-compat alias and bridged both ways
(`serviceTypeToProviderType` / `providerTypeToServiceType`).

### Specialties (26 canonical)

Source Arabic strings (incl. spelling variants and compound entries) are folded
to canonical keys via `specialtyFromArabic`. Each provider row keeps its original
Arabic specialty in `specialty_raw`, so nothing is lost.

## Data model

- `providers` table — the directory: `governorate`, `governorate_ar`, `area`,
  `address`, `provider_type`, `specialty`, `specialty_raw`, `name`. Seeded from
  `packages/db/src/seed-data/providers.json.gz` (extracted from the spreadsheet;
  stored gzipped — ~116 KB vs ~1 MB — and decompressed at seed time).
- `service_requests` gains `provider_type`, `specialty`, `area`, `provider_id`
  plus member intake fields: `member_name_en`, `member_name_ar`, `company`,
  `gender`, `marital_status`. `gender` (and DOB) are derivable from the national
  ID; `service_type` is retained and auto-derived from `provider_type`.
- `pricing_options.provider_id` links an attached option to a directory provider.

## Flow

1. **Partner** creates a request with the matching axes (`providerType` + optional
   `specialty` + `governorate`/`area`) and member fields, optionally pre-selecting
   a `providerId` via `hp.providers.search(...)`.
2. **Ops** open the request; the drawer auto-suggests matching directory providers
   (same governorate / provider type / specialty). Ops pick a provider ("Use")
   to prefill a pricing-option draft, set prices (validated to the 15–70% band),
   and send the quote.
3. **Member** opens the hosted page and selects one option (each carries its
   provider) to confirm.

## API

- `GET /api/v1/providers` (partner) and `GET /api/v1/ops/providers` (ops) —
  search by `governorate`, `area`, `providerType`, `specialty`, `q` (paginated).
- `POST /api/v1/requests` accepts `providerType`, `specialty`, `area`,
  `providerId`, and member fields (`memberNameEn/Ar`, `company`, `gender`,
  `maritalStatus`) in addition to the legacy `serviceType`.

## Bilingual (Arabic / English)

All taxonomy carries `{ en, ar }` labels in `@healthpay/shared`; the SDK
re-exports them from `@healthpay/quote-sdk` (`PROVIDER_TYPE_LABELS`,
`SPECIALTY_LABELS`, `GOVERNORATE_LABELS`, `GENDER_LABELS`,
`MARITAL_STATUS_LABELS`, `label()`, `dir()`). The web app (landing, ops
dashboard, hosted quote page) has a persisted EN/AR toggle with correct RTL/LTR
direction, defaulting to Arabic for the Egyptian audience.
