# Partner Integration Guide

This guide takes you from zero to a working integration with the HealthPay Quote
Engine. You'll create a request, let HealthPay operations attach pricing, and
capture the user's confirmation.

> HealthPay is a medical discount card (15%–70% off services). It is **not insurance**,
> and no clinical/diagnosis data is collected — only a service category.

## 1. What you receive from HealthPay

When you're onboarded as a partner you get:

- **API key** (`hp_live_…`) — identifies you.
- **API secret** (`hps_…`) — signs your requests (keep server-side only).
- **Webhook secret** (`whsec_…`) — verifies inbound webhooks.
- The **base URL** of the API (e.g. `https://quotes.healthpay.example`).

You also tell HealthPay your **webhook URL** (where we POST events).

## 2. The flow

```
Your app ──create request──▶ HealthPay API ──SMS quote link──▶ End user
                                   │                                │
                          appears on ops queue                 opens hosted
                                   │                            quote page
                       ops attach pricing options                  │
                                   │                          selects + confirms
        webhook: request.quoted ◀──┤                                │
                                   └──── webhook: request.confirmed ◀┘
```

The end user confirms on the **hosted quote page** (the canonical surface, linked
by SMS). You also receive the `quoteUrl` so you can redirect or embed it, and you
can poll or subscribe to webhooks for status.

## 3. Quickest path — the TypeScript SDK

```bash
npm install @healthpay/quote-sdk
```

```ts
import { HealthPay } from "@healthpay/quote-sdk";

const hp = new HealthPay({
  apiKey: process.env.HEALTHPAY_API_KEY!,
  apiSecret: process.env.HEALTHPAY_API_SECRET!,   // server-side only
  baseUrl: "https://quotes.healthpay.example",
});

const req = await hp.requests.create({
  serviceType: "lab_investigation",
  location: { governorate: "Cairo", city: "Nasr City" },
  nationalId: "30101010123451",
  mobile: "+201001234567",
  partnerReference: "order_8821",
});

console.log(req.quoteUrl);   // redirect the user here, or just rely on the SMS

// Option A — poll:
const stop = hp.requests.poll(req.id, (r) => {
  if (r.status === "confirmed") {
    console.log("User chose option", r.selectedOptionId);
    stop();
  }
});

// Option B — webhooks (recommended; see step 5).
```

## 4. Language-agnostic path — raw REST + HMAC

Every partner request needs three headers. Sign `"${timestamp}.${rawBody}"`
(empty body for GET) with HMAC-SHA256 and your API secret.

```bash
TS=$(date +%s)
BODY='{"serviceType":"lab_investigation","governorate":"Cairo","nationalId":"30101010123451","mobile":"+201001234567","partnerReference":"order_8821"}'
SIG=$(printf '%s' "$TS.$BODY" | openssl dgst -sha256 -hmac "$HEALTHPAY_API_SECRET" -hex | sed 's/^.* //')

curl -sS https://quotes.healthpay.example/api/v1/requests \
  -H "Content-Type: application/json" \
  -H "X-HP-Key: $HEALTHPAY_API_KEY" \
  -H "X-HP-Timestamp: $TS" \
  -H "X-HP-Signature: $SIG" \
  -d "$BODY"
```

Node (without the SDK):

```js
import { createHmac } from "node:crypto";
const ts = Math.floor(Date.now() / 1000);
const body = JSON.stringify({ /* … */ });
const sig = createHmac("sha256", apiSecret).update(`${ts}.${body}`).digest("hex");
// send X-HP-Key, X-HP-Timestamp: ts, X-HP-Signature: sig
```

Poll status with `GET /api/v1/requests/:id` (sign with an empty body).

## 5. Receiving webhooks

We POST `request.quoted`, `request.confirmed`, `request.expired`,
`request.cancelled` to your webhook URL. Always verify the signature before
trusting the payload.

```ts
// Express, raw body required for signature verification
app.post("/healthpay/webhook", express.raw({ type: "*/*" }), async (req, res) => {
  const raw = req.body.toString("utf8");
  const ok = await hp.webhooks.verify(
    raw,
    req.header("X-HP-Webhook-Signature")!,
    req.header("X-HP-Webhook-Timestamp")!,
    process.env.HEALTHPAY_WEBHOOK_SECRET!,
  );
  if (!ok) return res.status(400).end();

  const { event, requestId, data } = JSON.parse(raw);
  // …update your order using event + data.selectedOptionId…
  res.json({ received: true });
});
```

Without the SDK, recompute `HMAC-SHA256(webhookSecret, "${timestamp}.${rawBody}")`
and compare (constant-time) to `X-HP-Webhook-Signature`. Reject timestamps older
than 5 minutes.

## 6. Embedding the cards (optional)

Prefer redirecting to `quoteUrl`. If you want the cards inline instead, use the
browser embed helper, which calls the **public token endpoints** (no secret in
the browser):

```ts
import { renderQuoteCards } from "@healthpay/quote-sdk/embed";
renderQuoteCards(document.getElementById("cards")!, {
  baseUrl: "https://quotes.healthpay.example",
  token,            // the token from quoteUrl / the SMS link
  onConfirmed: (r) => console.log("confirmed", r),
});
```

## 6b. Service matching & the provider directory

Requests are matched against a provider directory along
`governorate → area → providerType → specialty → provider`. Prefer the richer
`providerType` (8 values) over the legacy `serviceType` (4 values); supply one.
Optionally narrow with `specialty` and `area`, and pre-select a `providerId`.

Search the directory (also available without the SDK at `GET /api/v1/providers`):

```ts
const { items } = await hp.providers.search({
  governorate: "Cairo",
  providerType: "labs",
  specialty: "labs",
  q: "Alfa",
});
const req = await hp.requests.create({
  providerType: "labs",
  specialty: "labs",
  location: { governorate: "Cairo", area: "Nasr City" },
  providerId: items[0]?.id,            // optional pre-selection
  nationalId: "30101010123451",
  mobile: "+201001234567",
  memberNameAr: "أحمد منصور",
  memberNameEn: "Ahmed Mansour",
  company: "Acme Corp",
  maritalStatus: "married",            // gender + DOB are derived from the ID
});
```

### Bilingual labels (Arabic / English)

The SDK re-exports bilingual label maps and helpers, so you can render the
taxonomy in either language:

```ts
import { PROVIDER_TYPE_LABELS, SPECIALTY_LABELS, label } from "@healthpay/quote-sdk";
label(PROVIDER_TYPE_LABELS["labs"], "ar");   // "معامل تحاليل"
label(SPECIALTY_LABELS["dentistry"], "en");  // "Dentistry"
```

## 7. Validation rules you should pre-check

- **National ID**: 14 digits, century digit 2/3, valid embedded birthdate and
  governorate code. Invalid IDs return `422`.
- **Mobile**: Egyptian formats `01[0125]XXXXXXXX` / `+201[0125]XXXXXXXX`. We
  normalize to `+20…`.
- **Discount band**: pricing options always fall within **15–70%** off.

## 8. Going live checklist

- [ ] Store the API secret and webhook secret server-side only (never in the browser).
- [ ] Verify webhook signatures and timestamps.
- [ ] Handle `expired`/`cancelled` terminal states in your UI.
- [ ] Respect `429` `Retry-After`.
- [ ] Use `partnerReference` to correlate requests with your orders.
