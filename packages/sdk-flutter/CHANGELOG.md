# Changelog

## 0.1.0

- Initial release.
- Headless `HealthPayQuoteClient` (public-token mode): `get`, `confirm`, `poll`
  over the public `/api/v1/quote/:token` endpoints, with typed errors.
- `QuoteFlowController` (`ChangeNotifier`) driving the lifecycle.
- `HealthPayQuoteFlow` drop-in widget: await pricing → compare offers → confirm
  → done, with the Alternative-branch badge for `isAlternative`.
- HealthPay-branded theming (overridable) and EN/AR localisation with RTL and
  Arabic-Indic digits.
