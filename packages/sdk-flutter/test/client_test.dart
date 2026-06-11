import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:healthpay_quote_sdk/healthpay_quote_sdk.dart';

Map<String, dynamic> quoteJson(String status, {String? selectedOptionId}) => {
      'id': '11111111-2222-3333-4444-555555555555',
      'status': status,
      'serviceType': 'lab_investigation',
      'providerType': 'labs',
      'specialty': 'labs',
      'governorate': 'Cairo',
      'area': 'Nasr City',
      'city': null,
      'mobile': '+20 100 •••• 567',
      'memberNameEn': 'Ahmed',
      'memberNameAr': 'أحمد',
      'expiresAt': '2026-06-12T00:00:00.000Z',
      'selectedOptionId': selectedOptionId,
      'options': [
        {
          'id': 'opt-1',
          'providerId': 'prov-1',
          'isAlternative': false,
          'providerName': 'Alfa Labs',
          'providerAddress': 'Nasr City',
          'serviceDescription': 'CBC',
          'listPrice': 800,
          'discountedPrice': 320,
          'discountPct': 60,
          'currency': 'EGP',
          'validityNote': null,
          'extraInfo': null,
        },
      ],
    };

http.Response ok(Map<String, dynamic> body) =>
    http.Response(jsonEncode(body), 200, headers: {'content-type': 'application/json'});

http.Response err(String code, int status) => http.Response(
      jsonEncode({'error': {'code': code, 'message': code}}),
      status,
      headers: {'content-type': 'application/json'},
    );

void main() {
  test('requires baseUrl and token', () {
    expect(() => HealthPayQuoteClient(baseUrl: '', token: 't'), throwsA(isA<HealthPayError>()));
    expect(() => HealthPayQuoteClient(baseUrl: 'https://x', token: ''), throwsA(isA<HealthPayError>()));
  });

  test('GETs the public token endpoint and strips a trailing slash', () async {
    Uri? seen;
    final mock = MockClient((req) async {
      seen = req.url;
      return ok(quoteJson('quoted'));
    });
    final hp = HealthPayQuoteClient(baseUrl: 'https://x/', token: 'tok 1', httpClient: mock);
    final q = await hp.get();
    expect(q.status, RequestStatus.quoted);
    expect(seen.toString(), 'https://x/api/v1/quote/tok%201');
  });

  test('confirms a selection', () async {
    Map<String, dynamic>? sentBody;
    String? method;
    final mock = MockClient((req) async {
      method = req.method;
      sentBody = jsonDecode(req.body) as Map<String, dynamic>;
      return ok(quoteJson('confirmed', selectedOptionId: 'opt-1'));
    });
    final hp = HealthPayQuoteClient(baseUrl: 'https://x', token: 't', httpClient: mock);
    final q = await hp.confirm('opt-1');
    expect(method, 'POST');
    expect(sentBody, {'optionId': 'opt-1'});
    expect(q.selectedOptionId, 'opt-1');
    expect(q.selectedOption?.providerName, 'Alfa Labs');
  });

  test('maps API error codes to typed errors', () async {
    final hp404 = HealthPayQuoteClient(
        baseUrl: 'https://x', token: 't', httpClient: MockClient((_) async => err('not_found', 404)));
    final hp409 = HealthPayQuoteClient(
        baseUrl: 'https://x', token: 't', httpClient: MockClient((_) async => err('conflict', 409)));
    final hp422 = HealthPayQuoteClient(
        baseUrl: 'https://x', token: 't', httpClient: MockClient((_) async => err('validation_error', 422)));
    await expectLater(hp404.get(), throwsA(isA<NotFoundError>()));
    await expectLater(hp409.confirm('x'), throwsA(isA<ConflictError>()));
    await expectLater(hp422.confirm('x'), throwsA(isA<ValidationError>()));
  });

  test('poll delivers an update and stops at a terminal status', () async {
    var calls = 0;
    final mock = MockClient((_) async {
      calls++;
      return ok(quoteJson('confirmed', selectedOptionId: 'opt-1'));
    });
    final hp = HealthPayQuoteClient(baseUrl: 'https://x', token: 't', httpClient: mock);

    final seen = <RequestStatus>[];
    final stop = hp.poll(
      (q) => seen.add(q.status),
      interval: const Duration(milliseconds: 10),
    );
    // Allow the initial async tick to run.
    await Future<void>.delayed(const Duration(milliseconds: 50));
    stop();

    expect(seen, [RequestStatus.confirmed]);
    expect(calls, 1); // terminal on first poll → no re-schedule
  });
}
