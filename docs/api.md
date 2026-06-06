# HealthPay Quote Engine — REST API Reference

Base path: `/api/v1`. A machine-readable **OpenAPI 3.1** spec is generated from the
zod schemas at [`docs/openapi.json`](./openapi.json) (`pnpm --filter @healthpay/web openapi`).

> HealthPay is a medical discount card (15%–70% off services). It is **not insurance**.
> No clinical/diagnosis data is collected — only a service category.

## Authentication

### Partner endpoints — API key + HMAC

Every partner request must carry three headers:

| Header | Value |
| --- | --- |
| `X-HP-Key` | Your API key |
| `X-HP-Timestamp` | Current Unix time (seconds). Rejected if skew > 5 minutes. |
| `X-HP-Signature` | `hex( HMAC-SHA256( apiSecret, "${timestamp}.${rawBody}" ) )` |

For `GET` requests the body is the empty string, so you sign `"${timestamp}."`.
The `@healthpay/quote-sdk` does all of this for you.

### Hosted-page endpoints — token bearer

`/api/v1/quote/:token` endpoints are authenticated by the high-entropy token
itself (delivered in the SMS link). No API key is needed. Only the token's hash
is stored server-side.

### Ops endpoints — session

`/api/v1/ops/*` require an authenticated staff session cookie (`POST /api/v1/ops/login`).

## Errors

All errors share one shape and an HTTP status:

```json
{ "error": { "code": "validation_error", "message": "…", "details": { } } }
```

| code | HTTP | Meaning |
| --- | --- | --- |
| `validation_error` | 422 | Invalid input (national ID, mobile, discount band, …) |
| `auth_error` | 401 | Bad/missing API key, signature, timestamp skew, or session |
| `rate_limit` | 429 | Per-partner limit exceeded (see `Retry-After`) |
| `not_found` | 404 | Unknown request/token/option |
| `invalid_transition` / `conflict` | 409 | Illegal state change (e.g. confirming twice, expired) |

---

## Partner endpoints

### `POST /api/v1/requests`

Create a service request. Triggers the quote-link SMS to the user.

Body:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `serviceType` | enum | ✓ | `medical_clinic_visit` \| `dental_clinic_visit` \| `lab_investigation` \| `radiology_investigation` |
| `governorate` | enum | ✓ | One of the 27 Egyptian governorates |
| `city` | string | | |
| `lat`, `lng` | number | | |
| `nationalId` | string | ✓ | 14-digit Egyptian National ID (validated; encrypted at rest) |
| `mobile` | string | ✓ | Egyptian mobile; normalized to E.164 |
| `partnerReference` | string | | Your correlation id |
| `note` | string | | |

Response `201`:

```json
{
  "id": "uuid",
  "status": "pending_quote",
  "quote_url": "https://…/quote/<token>",
  "expires_at": "2026-06-08T12:00:00.000Z"
}
```

### `GET /api/v1/requests/:id`

Returns the current status, masked mobile, `nationalIdLast4`, and — when
`quoted`/`confirmed` — the `options` array and `selectedOptionId`.

### `POST /api/v1/requests/:id/confirm`

Body `{ "optionId": "uuid" }`. Confirms a selection programmatically (the user
can also confirm on the hosted page). `409` if not `quoted` or expired.

### `POST /api/v1/requests/:id/cancel`

Cancels a `pending_quote`/`quoted` request.

---

## Hosted-page endpoints (token auth)

### `GET /api/v1/quote/:token`

Returns the request summary + pricing cards. **Never exposes the national ID**;
the mobile is masked.

### `POST /api/v1/quote/:token/confirm`

Body `{ "optionId": "uuid" }`. Confirms the user's choice.

---

## Ops endpoints (session auth)

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/v1/ops/login` | `{ email, password }` → sets session cookie |
| `POST` | `/api/v1/ops/logout` | Clears session |
| `GET` | `/api/v1/ops/requests` | Filter by `status`, `governorate`, `serviceType`, `q`; paginated |
| `GET` | `/api/v1/ops/requests/:id` | Full detail. `?reveal=true` decrypts PII (audit-logged) |
| `POST` | `/api/v1/ops/requests/:id/options` | Attach `{ options: [...] }` → moves to `quoted` |
| `DELETE` | `/api/v1/ops/options/:id` | Remove an option while `quoted` & unconfirmed |
| `GET` | `/api/v1/ops/stream` | Server-Sent Events feed of new/updated requests |

A pricing option requires `providerName`, `serviceDescription`, `listPrice`,
`discountedPrice` (with `discountedPrice < listPrice` and a resulting discount in
**15–70%**); `providerAddress`, `currency` (default `EGP`), `validityNote`,
`extraInfo` are optional.

---

## Webhooks

Configured per partner (`webhook_url` + `webhook_secret`). Events:
`request.quoted`, `request.confirmed`, `request.expired`, `request.cancelled`.

Each delivery includes:

| Header | Value |
| --- | --- |
| `X-HP-Event` | The event name |
| `X-HP-Webhook-Timestamp` | Unix seconds |
| `X-HP-Webhook-Signature` | `hex( HMAC-SHA256( webhookSecret, "${timestamp}.${rawBody}" ) )` |

Body: `{ "event": "...", "requestId": "...", "data": { …partner request view… } }`.
Failed deliveries are retried with exponential backoff (up to 6 attempts).
Verify with `hp.webhooks.verify(rawBody, signature, timestamp, secret)`.

## Lifecycle

```
pending_quote → quoted     (ops attaches ≥1 option)
pending_quote → cancelled
quoted        → confirmed  (user selects exactly one option)
quoted        → expired    (validity window elapses; default 48h)
quoted        → cancelled
confirmed / expired / cancelled = terminal
```
