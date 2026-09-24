# HealthPay — Partner Integration & Payment Guide

**Audience:** engineering team of a partner (third-party) application integrating with the HealthPay Quote Engine.
**Version:** 1.0 · Covers SDK `@healthpay/quote-sdk` **0.3.0**
**Last updated:** 2026-09-24

> HealthPay is a **medical discount card** (15%–70% off services). It is **not insurance**. No clinical or diagnosis data is collected — only a service category. Card/payment data is **never** sent to HealthPay (see §11).

---

## 1. What this integration does

Your app lets a user request a medical service, receive discounted pricing options ("offers") prepared by HealthPay operations, pick one, and **pay for it inside your app using your own payment processor (PSP)**. Your app then **reports the payment to HealthPay**, which validates it against the chosen offer and reflects it in the HealthPay operations portal.

**Money flow:** the charge is collected entirely by **your app / your PSP**. HealthPay does **not** process cards or move money — it is the system of record that ties the payment to the request and the picked offer.

```
Your app (+ your PSP)                      HealthPay API                Ops portal
─────────────────────                      ─────────────                ──────────
1. create request        ── POST /requests ─────▶ pending_quote
                                              (HealthPay ops attach pricing)
2. poll / webhook        ◀── request.quoted ─────  quoted
3. user picks an offer   ── POST .../confirm ────▶ confirmed
4. charge the user  (your PSP collects the money)
5. report the payment    ── POST .../payment ────▶ payment recorded ──▶ "Paid ✓" badge
6. read status           ── GET  .../payment ─────  { status: succeeded }
```

---

## 2. Environments & base URL

| Environment | Base URL | Base path |
| --- | --- | --- |
| Production | `https://health-pay-medical-discount-card-we-two.vercel.app` | `/api/v1` |

All endpoints below are relative to `{baseUrl}/api/v1`. All requests and responses are JSON (`Content-Type: application/json`).

---

## 3. Credentials

HealthPay issues each partner three secrets (generated in the HealthPay super-admin console):

| Credential | Format | Use |
| --- | --- | --- |
| **API key** | `hp_live_…` | Identifies you (sent as a header) |
| **API secret** | `hps_…` | Signs your requests (HMAC) — **server-side only** |
| **Webhook secret** | `whsec_…` | Verifies inbound webhooks from HealthPay |

**Keep the API secret and webhook secret on your server.** Never ship them in a mobile/web client. All authenticated calls (including payment reporting) must originate from **your backend**.

---

## 4. Authentication (API key + HMAC signature)

Every partner request carries three headers:

| Header | Value |
| --- | --- |
| `X-HP-Key` | Your API key (`hp_live_…`) |
| `X-HP-Timestamp` | Current Unix time in **seconds**. Rejected if the skew is greater than **5 minutes**. |
| `X-HP-Signature` | `hex( HMAC_SHA256( apiSecret, "{timestamp}.{rawBody}" ) )` |

- The signed string is the **timestamp**, a literal **dot**, then the **exact raw request body**.
- For `GET` requests the body is the empty string, so you sign `"{timestamp}."`.
- Sign the **exact bytes** you send — serialize the JSON once and sign that same string.

### 4.1 Node.js (without the SDK)

```js
import { createHmac } from "node:crypto";

function signedHeaders(apiKey, apiSecret, rawBody = "") {
  const ts = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", apiSecret).update(`${ts}.${rawBody}`).digest("hex");
  return {
    "Content-Type": "application/json",
    "X-HP-Key": apiKey,
    "X-HP-Timestamp": String(ts),
    "X-HP-Signature": sig,
  };
}

// POST example
const body = JSON.stringify({ amount: 350, providerReference: "psp_tx_123" });
await fetch(`${baseUrl}/api/v1/requests/${id}/payment`, {
  method: "POST",
  headers: signedHeaders(API_KEY, API_SECRET, body),
  body,
});
```

### 4.2 curl

```bash
TS=$(date +%s)
BODY='{"amount":350,"providerReference":"psp_tx_123","provider":"yourpsp"}'
SIG=$(printf '%s' "$TS.$BODY" | openssl dgst -sha256 -hmac "$HEALTHPAY_API_SECRET" -hex | sed 's/^.* //')

curl -sS "$BASE/api/v1/requests/$REQUEST_ID/payment" \
  -H "Content-Type: application/json" \
  -H "X-HP-Key: $HEALTHPAY_API_KEY" \
  -H "X-HP-Timestamp: $TS" \
  -H "X-HP-Signature: $SIG" \
  -d "$BODY"
```

> The official **`@healthpay/quote-sdk`** (TypeScript, Node 18+) builds these headers for you — see §10.

---

## 5. Error model

All errors share one shape:

```json
{ "error": { "code": "validation_error", "message": "…", "details": { } } }
```

| `code` | HTTP | Meaning |
| --- | --- | --- |
| `validation_error` | 422 | Invalid input (bad national ID/mobile, **payment amount ≠ offer price**, …) |
| `auth_error` | 401 | Bad/missing API key, signature, or timestamp skew |
| `rate_limit` | 429 | Per-partner rate limit exceeded (respect `Retry-After`) |
| `not_found` | 404 | Unknown request/option, or the request does not belong to you |
| `conflict` / `invalid_transition` | 409 | Illegal state change (e.g. confirming twice, expired, no offer selected) |
| `internal_error` | 500 | Unexpected server error |

---

## 6. Request lifecycle

```
pending_quote ──▶ quoted        (HealthPay ops attach ≥1 pricing option)
pending_quote ──▶ cancelled
quoted        ──▶ confirmed     (user selects exactly one option)
quoted        ──▶ expired       (validity window elapses; default 48h)
quoted        ──▶ cancelled
confirmed     ──▶ completed     (ops mark the service fulfilled)
confirmed     ──▶ cancelled
completed / expired / cancelled = terminal
```

**Payment is tracked separately** from this lifecycle (in its own record) and is reported after the offer is `confirmed`. Reporting a payment does not itself change the request status.

---

## 7. Core endpoints

### 7.1 `POST /api/v1/requests` — create a request

Triggers the quote-link SMS to the member. Supply either `providerType` (preferred, 8 values) **or** the legacy `serviceType` (4 values).

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `providerType` | enum | ✓* | e.g. `labs`, `radiology`, `pharmacies`, … (preferred) |
| `serviceType` | enum | ✓* | `medical_clinic_visit` \| `dental_clinic_visit` \| `lab_investigation` \| `radiology_investigation` |
| `governorate` | enum | ✓ | One of the 27 Egyptian governorates |
| `nationalId` | string | ✓ | 14-digit Egyptian National ID (validated; encrypted at rest) |
| `mobile` | string | ✓ | Egyptian mobile; normalized to E.164 |
| `specialty` | enum | | Narrows matching |
| `area`, `city` | string | | |
| `providerId` | uuid | | Pre-select a directory provider |
| `requestedServices` | string | | Exact services requested (comma-separated) |
| `memberNameEn`, `memberNameAr`, `company` | string | | Member intake |
| `gender`, `maritalStatus` | enum | | `gender`/DOB are derivable from the national ID |
| `partnerReference` | string | | **Your order id** — use it to correlate |
| `note` | string | | |

\* Supply `providerType` **or** `serviceType`.

**Response `201`:**
```json
{ "id": "uuid", "status": "pending_quote", "quote_url": "https://…/quote/<token>", "expires_at": "2026-06-08T12:00:00.000Z" }
```

### 7.2 `GET /api/v1/requests/:id` — request status + offers

Returns the request (mobile masked, National ID as `nationalIdLast4` only). When `quoted`/`confirmed`, includes `options[]` and `selectedOptionId`.

```json
{
  "id": "uuid",
  "status": "quoted",
  "providerType": "labs",
  "governorate": "Cairo",
  "requestedServices": "CBC، Vitamin D",
  "partnerReference": "order_8821",
  "options": [
    {
      "id": "opt-uuid",
      "providerId": "prov-uuid",
      "isAlternative": false,
      "providerName": "Alfa Labs",
      "providerAddress": "Nasr City",
      "serviceDescription": "CBC، Vitamin D",
      "listPrice": 800,
      "discountedPrice": 320,
      "discountPct": 60,
      "currency": "EGP",
      "validityNote": null
    }
  ],
  "selectedOptionId": null
}
```

> **The amount to charge** for an offer is its `discountedPrice` (with `currency`). This is the number your payment report must match.

### 7.3 `POST /api/v1/requests/:id/confirm` — pick an offer

Body: `{ "optionId": "uuid" }`. Moves the request to `confirmed`. `409` if not `quoted`/expired.

### 7.4 `POST /api/v1/requests/:id/cancel` — cancel

Cancels a `pending_quote`/`quoted` request.

---

## 8. Payment endpoints (the integration you asked for)

### 8.1 `POST /api/v1/requests/:id/payment` — report a payment

After **your app collects the money via your own PSP**, report the outcome here. HealthPay validates the amount against the picked offer, records the payment, and shows it in the ops portal. **Call from your backend** (it is HMAC-signed).

**Request body — exactly what you send:**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `providerReference` | string | ✓ | Your PSP's transaction id. **Idempotency key** — re-sending the same value updates the same record and never double-counts. |
| `amount` | number | ✓ | Must **equal the picked offer's `discountedPrice`**. A mismatch returns `422`. |
| `status` | enum | | `succeeded` (default) \| `failed` \| `pending` |
| `optionId` | uuid | | The paid offer. Defaults to the confirmed selection if omitted. |
| `currency` | string(3) | | ISO-4217. Must match the offer's currency (default `EGP`). |
| `provider` | string | | Your PSP's name, free text (e.g. `"paymob"`, `"fawry"`, `"myprocessor"`). Purely a label. |
| `paidAt` | string | | ISO-8601 settlement time. Defaults to now for `succeeded`. |
| `failureReason` | string | | When `status` is `failed`. |
| `metadata` | object | | Any extra non-card PSP data to retain. |

**Example request:**
```json
{
  "amount": 320,
  "currency": "EGP",
  "provider": "yourpsp",
  "providerReference": "psp_txn_9f2a…",
  "status": "succeeded",
  "paidAt": "2026-09-24T10:15:00.000Z",
  "metadata": { "authCode": "A12345", "channel": "card" }
}
```

**Response `201`:**
```json
{
  "requestId": "uuid",
  "status": "confirmed",
  "payment": {
    "id": "pay-uuid",
    "status": "succeeded",
    "amount": 320,
    "currency": "EGP",
    "provider": "yourpsp",
    "providerReference": "psp_txn_9f2a…",
    "optionId": "opt-uuid",
    "paidAt": "2026-09-24T10:15:00.000Z",
    "failureReason": null,
    "createdAt": "…",
    "updatedAt": "…"
  }
}
```

**Failure responses:** `422` amount/currency ≠ offer · `404` request not yours / option not on this request · `409` no offer selected and no `optionId` supplied · `401` bad signature.

### 8.2 `GET /api/v1/requests/:id/payment` — latest payment

```json
{ "requestId": "uuid", "status": "confirmed", "payment": { "status": "succeeded", "amount": 320, "currency": "EGP", "providerReference": "psp_txn_9f2a…", … } }
```
`payment` is `null` if none has been reported.

### 8.3 Recommended payment sequence

1. `POST /requests/:id/confirm` with the chosen `optionId` → request becomes `confirmed`.
2. Read the chosen offer's `discountedPrice` + `currency` (from `GET /requests/:id`).
3. Charge that exact amount with **your PSP**.
4. On your PSP's success/failure callback, `POST /requests/:id/payment` with the result and your PSP transaction id as `providerReference`.
5. (Optional) `GET /requests/:id/payment` to confirm HealthPay recorded it.

**Idempotency:** safe to retry step 4 with the same `providerReference` — HealthPay upserts on it. Report `failed` outcomes too (with `failureReason`) so ops see the attempt.

---

## 9. Webhooks (optional, recommended)

Configure a `webhook_url` with HealthPay. HealthPay POSTs request-lifecycle events so you don't have to poll:

`request.quoted` · `request.confirmed` · `request.completed` · `request.expired` · `request.cancelled`

Each delivery carries:

| Header | Value |
| --- | --- |
| `X-HP-Event` | The event name |
| `X-HP-Webhook-Timestamp` | Unix seconds |
| `X-HP-Webhook-Signature` | `hex( HMAC_SHA256( webhookSecret, "{timestamp}.{rawBody}" ) )` |

Body: `{ "event": "...", "requestId": "...", "data": { …partner request view… } }`. **Verify the signature** and reject timestamps older than 5 minutes before trusting the payload. Failed deliveries are retried with exponential backoff (up to 6 attempts).

> Note: payment status is currently read via `GET /requests/:id/payment` (there is no `payment.*` webhook yet). Ask HealthPay if you need one.

---

## 10. Using the official SDK (recommended)

```bash
npm install @healthpay/quote-sdk
```

```ts
import { HealthPay } from "@healthpay/quote-sdk";

const hp = new HealthPay({
  apiKey: process.env.HEALTHPAY_API_KEY!,
  apiSecret: process.env.HEALTHPAY_API_SECRET!,   // server-side only
  baseUrl: "https://health-pay-medical-discount-card-we-two.vercel.app",
});

// 1. create → 2. confirm the picked offer
const req = await hp.requests.create({
  providerType: "labs",
  location: { governorate: "Cairo", area: "Nasr City" },
  requestedServices: "CBC, Vitamin D",
  nationalId: "30101010123451",
  mobile: "+201001234567",
  partnerReference: "order_8821",
});
await hp.requests.confirm(req.id, optionId);

// 3. (your PSP charges the user) → 4. report the payment
await hp.requests.reportPayment(req.id, {
  amount: 320,                       // must equal the offer's discountedPrice
  currency: "EGP",
  provider: "yourpsp",
  providerReference: "psp_txn_9f2a…", // your PSP transaction id (required)
  status: "succeeded",
});

// 5. read it back
const { payment } = await hp.requests.getPayment(req.id);
console.log(payment?.status); // "succeeded"
```

The SDK signs every request with HMAC-SHA256 internally and exposes typed errors (`ValidationError`, `AuthError`, `RateLimitError`, `NotFoundError`, `ConflictError`).

---

## 11. Security & compliance

- **PCI:** card data (PAN, CVV, etc.) is handled **only by your PSP** and **never** sent to HealthPay. HealthPay stores only the amount, currency, your PSP's name, and your transaction reference. This keeps HealthPay out of your cardholder-data environment.
- **Amount authority:** HealthPay always validates the reported `amount` against the offer's server-side `discountedPrice`. A client cannot record an under/over-charge — mismatches are rejected (`422`).
- **Report from your server**, never from the mobile/web client — the endpoint is HMAC-signed with your API secret. (If your app has no backend, ask HealthPay for a quote-token-scoped variant.)
- **Idempotency:** always send your PSP transaction id as `providerReference`; retries are safe.
- **Transport:** HTTPS only.

---

## 12. Testing

- Use your **PSP's sandbox** to collect a test charge, then report it to HealthPay exactly as in production.
- HealthPay validates the amount against a real `confirmed` offer, so a full test run is: create → (ops attach offers) → confirm → report payment.
- Send both `succeeded` and `failed` reports to see how each surfaces in the ops portal.

---

## 13. Quick reference

| Action | Method & path |
| --- | --- |
| Create request | `POST /api/v1/requests` |
| Get request + offers | `GET /api/v1/requests/:id` |
| Confirm picked offer | `POST /api/v1/requests/:id/confirm` |
| Cancel | `POST /api/v1/requests/:id/cancel` |
| **Report a payment** | `POST /api/v1/requests/:id/payment` |
| **Get latest payment** | `GET /api/v1/requests/:id/payment` |

**Every request needs:** `X-HP-Key`, `X-HP-Timestamp`, `X-HP-Signature` (see §4).
**Payment report must include:** `providerReference` + `amount` (= offer's discounted price). Everything else is optional.

---

*A machine-readable OpenAPI 3.1 spec is available at `docs/openapi.json`. Contact HealthPay for your credentials and to register your webhook URL.*
