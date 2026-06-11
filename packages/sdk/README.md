# @healthpay/quote-sdk

Official TypeScript SDK for the **HealthPay Quote Engine** — request medical-discount
pricing on behalf of your users, poll for status, confirm a selection, and verify
webhooks. Isomorphic (Node 18+ and browsers), zero runtime dependencies, ships
ESM + CJS + type declarations.

> HealthPay is a medical discount card (15%–70% off services). It is **not insurance**.
> No clinical or diagnosis data is collected — only a service category.

## Install

```bash
npm install @healthpay/quote-sdk
```

## Quickstart

```ts
import { HealthPay } from "@healthpay/quote-sdk";

const hp = new HealthPay({
  apiKey: process.env.HEALTHPAY_API_KEY!,
  apiSecret: process.env.HEALTHPAY_API_SECRET!,
  baseUrl: "https://quotes.healthpay.example",
});

// 1. Create a request (an SMS with the quote link is sent to the user).
const req = await hp.requests.create({
  serviceType: "lab_investigation",
  location: { governorate: "Cairo", city: "Nasr City" },
  nationalId: "30101010123451",
  mobile: "+201001234567",
  partnerReference: "order_8821",
});
// => { id, status: "pending_quote", quoteUrl, expiresAt }

// 2. Poll until the user confirms (or it expires).
const stop = hp.requests.poll(req.id, (r) => {
  console.log(r.status, r.selectedOptionId);
}, { intervalMs: 5000 });

// 3. (Optional) confirm programmatically instead of via the hosted page.
await hp.requests.confirm(req.id, optionId);

// 4. Cancel if needed.
await hp.requests.cancel(req.id);
```

The SDK signs every request with HMAC-SHA256 internally — you never build
signatures yourself.

## Service matching (provider directory)

Match against the provider directory along
`governorate → area → providerType → specialty → provider`:

```ts
const { items } = await hp.providers.search({
  governorate: "Cairo",
  providerType: "labs",     // 8 types; preferred over the legacy serviceType (4)
  specialty: "labs",
  q: "Alfa",
});

await hp.requests.create({
  providerType: "labs",
  specialty: "labs",
  location: { governorate: "Cairo", area: "Nasr City" },
  providerId: items[0]?.id,
  requestedServices: "CBC, Fasting glucose, Creatinine", // the exact services
  nationalId: "30101010123451",
  mobile: "+201001234567",
  memberNameAr: "أحمد منصور",
  memberNameEn: "Ahmed Mansour",
});
```

## Request lifecycle & statuses

`RequestStatus` is one of:

```
pending_quote → quoted → confirmed → completed
                  ↘ expired   (any active state) ↘ cancelled
```

- `pending_quote` — created; HealthPay ops are attaching pricing options.
- `quoted` — options are available (`hp.requests.get(id).options`); the member can confirm.
- `confirmed` — the member selected one option (`selectedOptionId`).
- `completed` — ops marked the confirmed service as fulfilled (terminal).
- `expired` / `cancelled` — terminal.

### Alternative offers

A pricing option may be flagged `isAlternative: true` when ops propose a
**different provider** than the one the member originally chose (e.g. the service
isn't available there). Surface these clearly to the member as alternatives:

```ts
const r = await hp.requests.get(req.id);
for (const o of r.options ?? []) {
  if (o.isAlternative) console.log("Alternative:", o.providerName, o.discountedPrice);
}
```

## Bilingual labels (Arabic / English)

The SDK re-exports the bilingual taxonomy so you can render it in either language:

```ts
import { PROVIDER_TYPE_LABELS, SPECIALTY_LABELS, GOVERNORATE_LABELS, label } from "@healthpay/quote-sdk";
label(PROVIDER_TYPE_LABELS["labs"], "ar");      // "معامل تحاليل"
label(SPECIALTY_LABELS["dentistry"], "en");     // "Dentistry"
```

## Typed errors

```ts
import { AuthError, ValidationError, RateLimitError, NotFoundError } from "@healthpay/quote-sdk";

try {
  await hp.requests.create(input);
} catch (err) {
  if (err instanceof ValidationError) console.error(err.details);
  if (err instanceof RateLimitError) console.error("retry after", err.retryAfterSeconds);
}
```

## Verifying webhooks

On your server, verify the signature before trusting an event:

```ts
// Express example
app.post("/healthpay/webhook", express.raw({ type: "*/*" }), async (req, res) => {
  const ok = await hp.webhooks.verify(
    req.body.toString("utf8"),                 // raw body
    req.header("X-HP-Webhook-Signature")!,
    req.header("X-HP-Webhook-Timestamp")!,
    process.env.HEALTHPAY_WEBHOOK_SECRET!,
  );
  if (!ok) return res.status(400).end();
  const event = JSON.parse(req.body.toString("utf8"));
  // event.event (WebhookEvent): "request.quoted" | "request.confirmed"
  //   | "request.completed" | "request.expired" | "request.cancelled"
  res.json({ received: true });
});
```

## Embedding pricing cards (browser)

Instead of redirecting to the hosted quote page, render the cards inline. This uses
the **public token endpoints**, so no API secret is exposed in the browser — pass
the quote token (the one in `quoteUrl` / the SMS link):

```ts
import { renderQuoteCards } from "@healthpay/quote-sdk/embed";

renderQuoteCards(document.getElementById("cards")!, {
  baseUrl: "https://quotes.healthpay.example",
  token,
  onConfirmed: (req) => console.log("confirmed", req),
});
```

## API surface

| Method | Description |
| --- | --- |
| `new HealthPay({ apiKey, apiSecret, baseUrl, fetch?, timeoutMs? })` | Create a client |
| `hp.requests.create(input)` | Create a request → `{ id, status, quoteUrl, expiresAt }` |
| `hp.requests.get(id)` | Current status + options |
| `hp.requests.confirm(id, optionId)` | Confirm a selection |
| `hp.requests.cancel(id)` | Cancel a request |
| `hp.requests.poll(id, cb, { intervalMs, until })` | Poll; returns `stop()` |
| `hp.webhooks.verify(rawBody, sig, ts, secret, tolerance?)` | Verify a webhook |
| `renderQuoteCards(container, { baseUrl, token })` | Browser embed (from `/embed`) |
