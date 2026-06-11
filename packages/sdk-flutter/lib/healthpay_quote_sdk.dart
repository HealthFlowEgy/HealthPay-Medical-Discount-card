/// Flutter SDK for the HealthPay Quote Engine.
///
/// A drop-in medical-discount quote flow ([HealthPayQuoteFlow]) plus a headless
/// token client ([HealthPayQuoteClient]), both running in public-token mode so
/// the API secret never ships in the app.
library healthpay_quote_sdk;

export 'src/client.dart' show HealthPayQuoteClient, PollStop;
export 'src/controller.dart' show QuoteFlowController, FlowPhase;
export 'src/errors.dart';
export 'src/format.dart';
export 'src/models.dart';
export 'src/strings.dart';
export 'src/theme.dart';
export 'src/ui/quote_flow.dart' show HealthPayQuoteFlow;
