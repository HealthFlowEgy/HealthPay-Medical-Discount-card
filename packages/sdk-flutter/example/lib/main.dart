import 'package:flutter/material.dart';
import 'package:healthpay_quote_sdk/healthpay_quote_sdk.dart';

/// Minimal example. In a real app, fetch [token] from your backend, which calls
/// the server SDK (`hp.requests.create()`) with the API secret.
void main() {
  runApp(const ExampleApp(
    baseUrl: 'https://quotes.healthpay.example',
    token: 'REPLACE_WITH_TOKEN_FROM_YOUR_BACKEND',
  ));
}

class ExampleApp extends StatelessWidget {
  const ExampleApp({super.key, required this.baseUrl, required this.token});

  final String baseUrl;
  final String token;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'HealthPay Quote',
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        body: SafeArea(
          child: HealthPayQuoteFlow(
            baseUrl: baseUrl,
            token: token,
            locale: HealthPayLocale.ar, // try HealthPayLocale.en for LTR
            onConfirmed: (quote) {
              debugPrint('Confirmed option ${quote.selectedOptionId}');
            },
            onError: (err) => debugPrint('Error: ${err.message}'),
          ),
        ),
      ),
    );
  }
}
