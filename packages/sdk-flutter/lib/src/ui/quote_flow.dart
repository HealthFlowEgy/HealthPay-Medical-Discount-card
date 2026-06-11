import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../client.dart';
import '../controller.dart';
import '../errors.dart';
import '../format.dart';
import '../models.dart';
import '../strings.dart';
import '../theme.dart';
import 'primitives.dart';

/// The drop-in quote experience.
///
/// Public-token mode: this widget talks only to the public token endpoints, so
/// no API secret is ever shipped in the app. Pass the quote token your backend
/// obtained from the server SDK.
///
/// ```dart
/// HealthPayQuoteFlow(
///   baseUrl: 'https://quotes.healthpay.example',
///   token: tokenFromYourBackend,
///   locale: HealthPayLocale.ar,
///   onConfirmed: (q) => Navigator.of(context).pop(q),
/// )
/// ```
class HealthPayQuoteFlow extends StatefulWidget {
  const HealthPayQuoteFlow({
    super.key,
    required this.baseUrl,
    required this.token,
    this.locale = HealthPayLocale.en,
    this.theme = const HealthPayTheme(),
    this.strings,
    this.httpClient,
    this.interval = const Duration(seconds: 4),
    this.onConfirmed,
    this.onError,
    this.confirmedBuilder,
  });

  final String baseUrl;

  /// Quote token from your backend (the one in the SMS link / `quoteUrl`).
  final String token;
  final HealthPayLocale locale;
  final HealthPayTheme theme;
  final HealthPayStrings? strings;
  final http.Client? httpClient;
  final Duration interval;
  final void Function(Quote quote)? onConfirmed;
  final void Function(HealthPayError error)? onError;

  /// Render your own confirmed screen instead of the built-in one.
  final Widget Function(BuildContext context, Quote quote)? confirmedBuilder;

  @override
  State<HealthPayQuoteFlow> createState() => _HealthPayQuoteFlowState();
}

class _HealthPayQuoteFlowState extends State<HealthPayQuoteFlow> {
  late HealthPayQuoteClient _client;
  late QuoteFlowController _controller;

  @override
  void initState() {
    super.initState();
    _build();
  }

  void _build() {
    _client = HealthPayQuoteClient(
      baseUrl: widget.baseUrl,
      token: widget.token,
      httpClient: widget.httpClient,
    );
    _controller = QuoteFlowController(
      client: _client,
      interval: widget.interval,
      onConfirmed: widget.onConfirmed,
      onError: widget.onError,
    );
  }

  @override
  void didUpdateWidget(covariant HealthPayQuoteFlow oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.baseUrl != widget.baseUrl || oldWidget.token != widget.token) {
      _controller.dispose();
      _client.dispose();
      _build();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _client.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = widget.theme;
    final strings = widget.strings ?? HealthPayStrings.of(widget.locale);
    final direction = isRtl(widget.locale) ? TextDirection.rtl : TextDirection.ltr;

    return Directionality(
      textDirection: direction,
      child: Container(
        color: theme.background,
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            return Column(
              children: [
                HpHeader(theme: theme, statusLabel: _statusLabel(_controller.quote?.status)),
                Expanded(child: _body(context, theme, strings)),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _body(BuildContext context, HealthPayTheme theme, HealthPayStrings s) {
    switch (_controller.phase) {
      case FlowPhase.error:
        return _Centered(children: [
          Text(s.errorTitle,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: theme.text)),
          const SizedBox(height: 8),
          Text(_controller.error?.message ?? '',
              textAlign: TextAlign.center, style: TextStyle(color: theme.textMuted)),
          const SizedBox(height: 16),
          HpButton(label: s.retry, theme: theme, onPressed: _controller.refresh),
        ]);
      case FlowPhase.loading:
      case FlowPhase.pending:
        return _Pending(theme: theme, strings: s, mobile: _controller.quote?.mobile);
      case FlowPhase.terminal:
        final expired = _controller.quote?.status == RequestStatus.expired;
        return _Centered(children: [
          Text(expired ? s.expiredTitle : s.cancelledTitle,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: theme.text)),
          if (expired) ...[
            const SizedBox(height: 8),
            Text(s.expiredBody, textAlign: TextAlign.center, style: TextStyle(color: theme.textMuted)),
          ],
        ]);
      case FlowPhase.confirmed:
        final q = _controller.quote!;
        if (widget.confirmedBuilder != null) return widget.confirmedBuilder!(context, q);
        return _Confirmed(quote: q, theme: theme, strings: s, locale: widget.locale);
      case FlowPhase.quoted:
      case FlowPhase.confirming:
        return _Quoted(
          quote: _controller.quote!,
          theme: theme,
          strings: s,
          locale: widget.locale,
          selectedOptionId: _controller.selectedOptionId,
          onSelect: _controller.select,
          onConfirm: _controller.confirm,
          confirming: _controller.phase == FlowPhase.confirming,
        );
    }
  }

  String? _statusLabel(RequestStatus? status) {
    switch (status) {
      case RequestStatus.pendingQuote:
        return 'Polling';
      case RequestStatus.quoted:
        return 'Quoted';
      case RequestStatus.confirmed:
      case RequestStatus.completed:
        return 'Confirmed';
      case RequestStatus.expired:
        return 'Expired';
      case RequestStatus.cancelled:
        return 'Cancelled';
      default:
        return null;
    }
  }
}

class _Pending extends StatelessWidget {
  const _Pending({required this.theme, required this.strings, this.mobile});

  final HealthPayTheme theme;
  final HealthPayStrings strings;
  final String? mobile;

  @override
  Widget build(BuildContext context) {
    return _Centered(children: [
      CircularProgressIndicator(color: theme.teal),
      const SizedBox(height: 20),
      Text(strings.preparingTitle,
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: theme.text)),
      const SizedBox(height: 8),
      Text(strings.preparingBody, textAlign: TextAlign.center, style: TextStyle(color: theme.textMuted)),
      if (mobile != null && mobile!.isNotEmpty) ...[
        const SizedBox(height: 24),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: theme.surface,
            borderRadius: BorderRadius.circular(theme.radiusLg),
            border: Border.all(color: theme.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(strings.smsSent,
                  style: TextStyle(color: theme.text, fontWeight: FontWeight.w700, fontSize: 12)),
              const SizedBox(height: 4),
              Text(mobile!, style: TextStyle(color: theme.textMuted)),
            ],
          ),
        ),
      ],
    ]);
  }
}

class _Quoted extends StatelessWidget {
  const _Quoted({
    required this.quote,
    required this.theme,
    required this.strings,
    required this.locale,
    required this.selectedOptionId,
    required this.onSelect,
    required this.onConfirm,
    required this.confirming,
  });

  final Quote quote;
  final HealthPayTheme theme;
  final HealthPayStrings strings;
  final HealthPayLocale locale;
  final String? selectedOptionId;
  final void Function(String optionId) onSelect;
  final Future<void> Function() onConfirm;
  final bool confirming;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(strings.chooseTitle,
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: theme.text)),
                  Text(strings.offersCount(quote.options.length),
                      style: TextStyle(color: theme.textMuted, fontSize: 12)),
                ],
              ),
              const SizedBox(height: 12),
              for (final o in quote.options) ...[
                _OptionCard(
                  option: o,
                  theme: theme,
                  strings: strings,
                  locale: locale,
                  selected: o.id == selectedOptionId,
                  onTap: () => onSelect(o.id),
                ),
                const SizedBox(height: 12),
              ],
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          color: theme.background,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(strings.notInsurance, style: TextStyle(color: theme.textMuted, fontSize: 11)),
              const SizedBox(height: 10),
              HpButton(
                label: confirming ? strings.confirming : strings.confirmSelection,
                theme: theme,
                loading: confirming,
                onPressed: selectedOptionId == null ? null : () => onConfirm(),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _OptionCard extends StatelessWidget {
  const _OptionCard({
    required this.option,
    required this.theme,
    required this.strings,
    required this.locale,
    required this.selected,
    required this.onTap,
  });

  final QuoteOption option;
  final HealthPayTheme theme;
  final HealthPayStrings strings;
  final HealthPayLocale locale;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final o = option;
    return GestureDetector(
      onTap: onTap,
      child: HpCard(
        theme: theme,
        selected: selected,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 18,
              height: 18,
              margin: const EdgeInsets.only(top: 2),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: selected ? theme.teal : theme.border, width: 2),
              ),
              child: selected
                  ? Container(
                      width: 9,
                      height: 9,
                      decoration: BoxDecoration(color: theme.teal, shape: BoxShape.circle),
                    )
                  : null,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(o.providerName,
                      style: TextStyle(fontWeight: FontWeight.w700, color: theme.text, fontSize: 14)),
                  if (o.providerAddress != null && o.providerAddress!.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(o.providerAddress!,
                          style: TextStyle(color: theme.textMuted, fontSize: 11)),
                    ),
                  if (o.serviceDescription.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(o.serviceDescription,
                          style: TextStyle(color: theme.textMuted, fontSize: 11)),
                    ),
                  if (o.isAlternative)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: HpBadge(label: strings.alternativeBadge, theme: theme, tone: HpBadgeTone.gold),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                HpBadge(label: formatDiscount(o.discountPct, locale), theme: theme, tone: HpBadgeTone.solid),
                const SizedBox(height: 8),
                Text(formatPrice(o.listPrice, o.currency, locale),
                    style: TextStyle(
                        color: theme.strike,
                        fontSize: 11,
                        decoration: TextDecoration.lineThrough)),
                Text(formatPrice(o.discountedPrice, o.currency, locale),
                    style: TextStyle(color: theme.text, fontWeight: FontWeight.w700, fontSize: 18)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Confirmed extends StatelessWidget {
  const _Confirmed({
    required this.quote,
    required this.theme,
    required this.strings,
    required this.locale,
  });

  final Quote quote;
  final HealthPayTheme theme;
  final HealthPayStrings strings;
  final HealthPayLocale locale;

  @override
  Widget build(BuildContext context) {
    final chosen = quote.selectedOption;
    final saved = chosen != null ? chosen.listPrice - chosen.discountedPrice : 0;
    final code = 'HP-${quote.id.replaceAll('-', '').substring(0, 6).toUpperCase()}';

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Center(
          child: Container(
            width: 76,
            height: 76,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: theme.tealSoft,
              shape: BoxShape.circle,
              border: Border.all(color: theme.teal, width: 3),
            ),
            child: Text('✓', style: TextStyle(color: theme.tealDark, fontSize: 38, fontWeight: FontWeight.w700)),
          ),
        ),
        const SizedBox(height: 16),
        Center(
          child: Text(strings.confirmedTitle,
              style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700, color: theme.text)),
        ),
        if (chosen != null) ...[
          const SizedBox(height: 6),
          Center(
            child: Text('${strings.showCode} · ${chosen.providerName}',
                textAlign: TextAlign.center, style: TextStyle(color: theme.textMuted)),
          ),
        ],
        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 24),
          decoration: BoxDecoration(color: theme.navy, borderRadius: BorderRadius.circular(theme.radiusLg)),
          child: Column(
            children: [
              Text(strings.discountCode,
                  style: const TextStyle(
                      color: Color(0xFF9FB4D6), fontSize: 10, letterSpacing: 2, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text(code,
                  style: TextStyle(
                      color: theme.onPrimary, fontSize: 30, fontWeight: FontWeight.w700, letterSpacing: 3)),
            ],
          ),
        ),
        if (chosen != null) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: theme.surface,
              borderRadius: BorderRadius.circular(theme.radiusLg),
              border: Border.all(color: theme.border, width: 1.3),
            ),
            child: Column(
              children: [
                _row(strings.youPay, formatPrice(chosen.discountedPrice, chosen.currency, locale), bold: true),
                _row(strings.youSave,
                    '${formatPrice(saved, chosen.currency, locale)} (${formatNumber(chosen.discountPct, locale)}%)'),
                if (chosen.providerAddress != null && chosen.providerAddress!.isNotEmpty)
                  _row('', chosen.providerAddress!),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _row(String k, String v, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(k, style: TextStyle(color: theme.textMuted, fontSize: 12)),
          Text(v,
              style: TextStyle(
                  color: theme.text, fontSize: bold ? 16 : 12, fontWeight: bold ? FontWeight.w700 : FontWeight.w400)),
        ],
      ),
    );
  }
}

class _Centered extends StatelessWidget {
  const _Centered({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: children,
        ),
      ),
    );
  }
}
