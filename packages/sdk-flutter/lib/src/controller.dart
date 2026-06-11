import 'package:flutter/foundation.dart';

import 'client.dart';
import 'errors.dart';
import 'models.dart';

enum FlowPhase { loading, pending, quoted, confirming, confirmed, terminal, error }

/// Drives the quote lifecycle as a [ChangeNotifier], so you can build your own
/// UI without the bundled widget:
///
/// ```dart
/// final controller = QuoteFlowController(client: client);
/// AnimatedBuilder(animation: controller, builder: (_, __) => ...);
/// ```
class QuoteFlowController extends ChangeNotifier {
  QuoteFlowController({
    required this.client,
    this.interval = const Duration(seconds: 4),
    this.onConfirmed,
    this.onError,
  }) {
    _start();
  }

  final HealthPayQuoteClient client;
  final Duration interval;
  final void Function(Quote quote)? onConfirmed;
  final void Function(HealthPayError error)? onError;

  Quote? _quote;
  HealthPayError? _error;
  String? _selectedOptionId;
  bool _confirming = false;
  bool _confirmedFired = false;
  PollStop? _stopPoll;
  bool _disposed = false;

  Quote? get quote => _quote;
  HealthPayError? get error => _error;
  String? get selectedOptionId => _selectedOptionId;

  FlowPhase get phase {
    if (_error != null && _quote == null) return FlowPhase.error;
    if (_confirming) return FlowPhase.confirming;
    final q = _quote;
    if (q == null) return FlowPhase.loading;
    switch (q.status) {
      case RequestStatus.pendingQuote:
        return FlowPhase.pending;
      case RequestStatus.quoted:
        return FlowPhase.quoted;
      case RequestStatus.confirmed:
      case RequestStatus.completed:
        return FlowPhase.confirmed;
      case RequestStatus.expired:
      case RequestStatus.cancelled:
        return FlowPhase.terminal;
      case RequestStatus.unknown:
        return FlowPhase.pending;
    }
  }

  void _start() {
    _stopPoll = client.poll(
      _adopt,
      interval: interval,
      onError: _handleError,
    );
  }

  void _adopt(Quote q) {
    _error = null;
    _quote = q;
    _selectedOptionId ??= q.selectedOptionId ??
        (q.options.isNotEmpty ? q.options.first.id : null);
    if ((q.status == RequestStatus.confirmed ||
            q.status == RequestStatus.completed) &&
        !_confirmedFired) {
      _confirmedFired = true;
      onConfirmed?.call(q);
    }
    _notify();
  }

  void _handleError(Object err) {
    _error = err is HealthPayError
        ? err
        : HealthPayError(SdkErrorCode.unknown, err.toString());
    onError?.call(_error!);
    _notify();
  }

  void select(String optionId) {
    _selectedOptionId = optionId;
    _notify();
  }

  Future<void> refresh() async {
    try {
      _adopt(await client.get());
    } catch (e) {
      _handleError(e);
    }
  }

  Future<void> confirm() async {
    final id = _selectedOptionId;
    if (id == null) return;
    _confirming = true;
    _notify();
    try {
      _adopt(await client.confirm(id));
    } catch (e) {
      _handleError(e);
    } finally {
      _confirming = false;
      _notify();
    }
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _stopPoll?.call();
    super.dispose();
  }
}
