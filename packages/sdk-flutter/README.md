# healthpay_quote_sdk (Flutter)

Flutter SDK for the **HealthPay Quote Engine**. Ships a **drop-in quote flow**
(`HealthPayQuoteFlow`) and a **headless token client**, both in **public-token
mode** — the API secret never touches the app.

> HealthPay is a medical discount card (15%–70% off services). It is **not insurance**.
> No clinical or diagnosis data is collected — only a service category.

## How it fits together

```
Your backend                         Your Flutter app
────────────                         ────────────────
@healthpay/quote-sdk (Node)          healthpay_quote_sdk
hp.requests.create({...})  ──token──▶ HealthPayQuoteFlow(token: …)
   (holds the API secret)              (public token endpoints only)
```

Your server creates the request with the **server SDK** (which holds the secret
and signs with HMAC) and returns the **quote token** to the app. The app renders
the rest of the journey: await pricing → compare offers → confirm → done.

## Install

```yaml
# pubspec.yaml
dependencies:
  healthpay_quote_sdk:
    git:
      url: https://github.com/healthflowegy/healthpay-medical-discount-card.git
      path: packages/sdk-flutter
```

## Drop-in flow

```dart
import 'package:healthpay_quote_sdk/healthpay_quote_sdk.dart';

HealthPayQuoteFlow(
  baseUrl: 'https://quotes.healthpay.example',
  token: tokenFromYourBackend,
  locale: HealthPayLocale.ar,          // en | ar (full RTL)
  onConfirmed: (quote) {
    // webhook request.confirmed also fires server-side
    debugPrint('confirmed ${quote.selectedOptionId}');
  },
  onError: (err) => debugPrint(err.message),
)
```

It handles every state for you:

| Status | Screen |
| --- | --- |
| `pending_quote` | "Preparing your quote" with a spinner; auto-polls |
| `quoted` | Pricing cards — discount %, strikethrough list price, **Alternative branch** badge for `isAlternative` |
| `confirmed` / `completed` | Confirmation with the code to show at the provider |
| `expired` / `cancelled` | Terminal message |

### Theming

```dart
HealthPayQuoteFlow(
  baseUrl: baseUrl,
  token: token,
  theme: const HealthPayTheme().copyWith(
    teal: const Color(0xFF0EA5E9),
    radiusLg: 20,
  ),
)
```

### Localisation

Built-in `en` and `ar` (Arabic flips to RTL and uses Arabic-Indic digits + `ج.م`).
Override any string by passing a `HealthPayStrings`.

### Bring your own confirmed screen

```dart
HealthPayQuoteFlow(
  baseUrl: baseUrl,
  token: token,
  confirmedBuilder: (context, quote) => MyReceipt(quote: quote),
)
```

## Headless client (build your own UI)

```dart
final hp = HealthPayQuoteClient(baseUrl: baseUrl, token: token);

final quote = await hp.get();                 // status + options
final updated = await hp.confirm(quote.options.first.id);

final stop = hp.poll((q) => setState(() => _quote = q));
// …call stop() in dispose(); call hp.dispose() to release the HTTP client.
```

Or drive a `ChangeNotifier` (what the widget uses):

```dart
final controller = QuoteFlowController(client: hp);
AnimatedBuilder(
  animation: controller,
  builder: (context, _) => Text(controller.phase.name),
);
```

## Typed errors

```dart
try {
  await hp.confirm(optionId);
} on ConflictError {
  // not quoted / already confirmed / expired
} on RateLimitError catch (e) {
  print(e.retryAfterSeconds);
}
```

## API surface

| Export | Description |
| --- | --- |
| `HealthPayQuoteFlow` | Drop-in flow (await → compare → confirm → done) |
| `QuoteFlowController` | `ChangeNotifier` driving the lifecycle |
| `HealthPayQuoteClient` | Headless token client (`get`, `confirm`, `poll`, `dispose`) |
| `HealthPayTheme` | Theming tokens (`copyWith`) |
| `HealthPayStrings`, `HealthPayLocale`, `isRtl` | Localisation |
| `formatPrice`, `formatNumber`, `formatDiscount` | Locale-aware formatting |
| `HealthPayError` & subclasses | Typed errors |

See [`example/`](./example) for a runnable app.
