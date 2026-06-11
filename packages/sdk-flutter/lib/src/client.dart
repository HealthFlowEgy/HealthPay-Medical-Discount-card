/// Headless token client (public-token mode).
///
/// The app never holds the API secret. Your backend calls the server SDK
/// (`hp.requests.create()`) and hands the resulting quote token to the app;
/// this client uses only the PUBLIC token-authenticated endpoints:
///
///   GET  /api/v1/quote/:token            → load the quote + options
///   POST /api/v1/quote/:token/confirm    → confirm a selected option
library;

import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'errors.dart';
import 'models.dart';

const Set<RequestStatus> _terminal = {
  RequestStatus.confirmed,
  RequestStatus.completed,
  RequestStatus.expired,
  RequestStatus.cancelled,
};

/// Stops an in-flight [HealthPayQuoteClient.poll] loop.
typedef PollStop = void Function();

class HealthPayQuoteClient {
  HealthPayQuoteClient({
    required String baseUrl,
    required this.token,
    http.Client? httpClient,
    this.timeout = const Duration(seconds: 15),
  })  : baseUrl = baseUrl.replaceAll(RegExp(r'/+$'), ''),
        _http = httpClient ?? http.Client(),
        _ownsClient = httpClient == null {
    if (this.baseUrl.isEmpty) {
      throw const HealthPayError(SdkErrorCode.unknown, 'baseUrl is required.');
    }
    if (token.isEmpty) {
      throw const HealthPayError(SdkErrorCode.unknown, 'token is required.');
    }
  }

  /// API base URL, e.g. "https://quotes.healthpay.example".
  final String baseUrl;

  /// The quote token (the same one in the SMS link / `quoteUrl`).
  final String token;
  final Duration timeout;
  final http.Client _http;
  final bool _ownsClient;

  /// Load the current quote (status + pricing options).
  Future<Quote> get() async {
    final body = await _request('GET', '/api/v1/quote/${Uri.encodeComponent(token)}');
    return Quote.fromJson(body);
  }

  /// Confirm the member's selection.
  ///
  /// Throws [ConflictError] when the request is not `quoted` (already confirmed,
  /// expired, or cancelled), and [ValidationError] for a bad option id.
  Future<Quote> confirm(String optionId) async {
    final body = await _request(
      'POST',
      '/api/v1/quote/${Uri.encodeComponent(token)}/confirm',
      {'optionId': optionId},
    );
    return Quote.fromJson(body);
  }

  /// Poll until a terminal status (or [until]) is reached. Returns a stop
  /// function; always call it when the screen is disposed.
  PollStop poll(
    void Function(Quote quote) onUpdate, {
    Duration interval = const Duration(seconds: 4),
    bool Function(Quote quote)? until,
    void Function(HealthPayError error)? onError,
  }) {
    final done = until ?? (Quote q) => _terminal.contains(q.status);
    var stopped = false;
    Timer? timer;

    Future<void> tick() async {
      if (stopped) return;
      try {
        final q = await get();
        if (stopped) return;
        onUpdate(q);
        if (done(q)) return;
      } on HealthPayError catch (e) {
        onError?.call(e);
      } catch (e) {
        onError?.call(NetworkError(e.toString()));
      }
      if (!stopped) timer = Timer(interval, tick);
    }

    unawaited(tick());
    return () {
      stopped = true;
      timer?.cancel();
    };
  }

  /// Release the underlying HTTP client (only if this instance created it).
  void dispose() {
    if (_ownsClient) _http.close();
  }

  Future<Map<String, dynamic>> _request(
    String method,
    String path, [
    Object? body,
  ]) async {
    final uri = Uri.parse('$baseUrl$path');
    http.Response res;
    try {
      final request = http.Request(method, uri);
      if (body != null) {
        request.headers['content-type'] = 'application/json';
        request.body = jsonEncode(body);
      }
      final streamed = await _http.send(request).timeout(timeout);
      res = await http.Response.fromStream(streamed);
    } on TimeoutException {
      throw NetworkError('Request timed out after ${timeout.inMilliseconds}ms.');
    } catch (e) {
      throw NetworkError('Network request failed: $e');
    }

    final parsed = res.body.isNotEmpty ? _safeJson(res.body) : null;
    if (res.statusCode < 200 || res.statusCode >= 300) {
      final retryAfter = int.tryParse(res.headers['retry-after'] ?? '');
      throw errorFromResponse(res.statusCode, parsed, retryAfter: retryAfter);
    }
    return parsed ?? <String, dynamic>{};
  }

  static Map<String, dynamic>? _safeJson(String text) {
    try {
      final decoded = jsonDecode(text);
      return decoded is Map<String, dynamic> ? decoded : null;
    } catch (_) {
      return null;
    }
  }
}
