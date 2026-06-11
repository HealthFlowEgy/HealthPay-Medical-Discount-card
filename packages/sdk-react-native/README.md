# @healthpay/quote-sdk-react-native

React Native SDK for the **HealthPay Quote Engine**. Ships a **drop-in quote
flow** (`<HealthPayQuoteFlow />`) and a **headless token client**, both running in
**public-token mode** — the API secret never touches the app.

> HealthPay is a medical discount card (15%–70% off services). It is **not insurance**.
> No clinical or diagnosis data is collected — only a service category.

## How it fits together

```
Your backend                         Your mobile app
────────────                         ───────────────
@healthpay/quote-sdk                 @healthpay/quote-sdk-react-native
hp.requests.create({...})  ──token──▶ <HealthPayQuoteFlow token=… />
   (holds the API secret)              (public token endpoints only)
```

Your server creates the request with the **server SDK** (`@healthpay/quote-sdk`,
which holds the secret and signs with HMAC) and returns the **quote token** to the
app. The app renders the rest of the journey: await pricing → compare offers →
confirm → done.

## Install

```bash
npm install @healthpay/quote-sdk-react-native
# peer deps: react, react-native
```

## Drop-in flow

```tsx
import { HealthPayQuoteFlow } from "@healthpay/quote-sdk-react-native";

export function QuoteScreen({ token }: { token: string }) {
  return (
    <HealthPayQuoteFlow
      baseUrl="https://quotes.healthpay.example"
      token={token}                 // from your backend
      locale="ar"                   // "en" | "ar" (full RTL)
      onConfirmed={(quote) => {
        // webhook request.confirmed also fires server-side
        console.log("confirmed", quote.selectedOptionId);
      }}
      onError={(err) => console.warn(err.message)}
    />
  );
}
```

It handles every state for you:

| Status | Screen |
| --- | --- |
| `pending_quote` | "Preparing your quote" with a spinner; auto-polls |
| `quoted` | Pricing cards — discount %, strikethrough list price, **Alternative branch** badge for `isAlternative` |
| `confirmed` / `completed` | Confirmation with the code to show at the provider |
| `expired` / `cancelled` | Terminal message |

### Theming

```tsx
<HealthPayQuoteFlow
  baseUrl={baseUrl}
  token={token}
  theme={{ teal: "#0EA5E9", navy: "#0B132B", radiusLg: 20 }}
/>
```

All tokens in `HealthPayTheme` are overridable; unspecified ones fall back to the
HealthPay brand.

### Localisation

Built-in `en` and `ar` (Arabic flips the layout to RTL and uses Arabic-Indic
digits + `ج.م`). Override any string:

```tsx
<HealthPayQuoteFlow baseUrl={baseUrl} token={token} locale="en"
  strings={{ confirmSelection: "Book this offer" }} />
```

### Bring your own confirmation screen

```tsx
<HealthPayQuoteFlow baseUrl={baseUrl} token={token}
  renderConfirmed={(q) => <MyReceipt quote={q} />} />
```

## Headless client (build your own UI)

```ts
import { createQuoteClient } from "@healthpay/quote-sdk-react-native";

const hp = createQuoteClient({ baseUrl, token });

const quote = await hp.get();                 // status + options
const updated = await hp.confirm(quote.options[0].id);

const stop = hp.poll((q) => setQuote(q), { intervalMs: 4000 });
// …call stop() on unmount.
```

Or the React hook the UI itself uses:

```ts
import { useQuoteFlow } from "@healthpay/quote-sdk-react-native";

const { quote, phase, selectedOptionId, select, confirm, refresh, error } =
  useQuoteFlow({ baseUrl, token });
```

## Typed errors

```ts
import { ValidationError, ConflictError, RateLimitError } from "@healthpay/quote-sdk-react-native";

try {
  await hp.confirm(optionId);
} catch (err) {
  if (err instanceof ConflictError) { /* not quoted / already confirmed / expired */ }
  if (err instanceof RateLimitError) console.log(err.retryAfterSeconds);
}
```

## API surface

| Export | Description |
| --- | --- |
| `<HealthPayQuoteFlow />` | Drop-in flow (await → compare → confirm → done) |
| `useQuoteFlow(opts)` | Hook driving the lifecycle |
| `createQuoteClient(opts)` / `HealthPayQuoteClient` | Headless token client (`get`, `confirm`, `poll`) |
| `defaultTheme`, `resolveTheme` | Theming tokens |
| `STRINGS`, `resolveStrings`, `isRTL` | Localisation |
| `formatPrice`, `formatNumber`, `formatDiscount` | Locale-aware formatting |
| `HealthPayError` & subclasses | Typed errors |
