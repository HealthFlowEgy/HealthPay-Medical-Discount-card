import 'package:flutter/widgets.dart';

/// Theming tokens for the drop-in flow. Defaults to the HealthPay brand;
/// override any field via [HealthPayTheme.copyWith] and the widget's `theme`.
@immutable
class HealthPayTheme {
  const HealthPayTheme({
    this.navy = const Color(0xFF0B1F3F),
    this.teal = const Color(0xFF14B8A6),
    this.tealDark = const Color(0xFF0F9488),
    this.tealSoft = const Color(0xFFEFFCF9),
    this.gold = const Color(0xFFD4A24E),
    this.goldSoft = const Color(0xFFFAF3E6),
    this.background = const Color(0xFFEEF2F8),
    this.surface = const Color(0xFFFFFFFF),
    this.border = const Color(0xFFE2E8F2),
    this.text = const Color(0xFF0B1F3F),
    this.textMuted = const Color(0xFF5B6B86),
    this.onPrimary = const Color(0xFFFFFFFF),
    this.strike = const Color(0xFF9AA7BD),
    this.radius = 12.0,
    this.radiusLg = 16.0,
  });

  final Color navy;
  final Color teal;
  final Color tealDark;
  final Color tealSoft;
  final Color gold;
  final Color goldSoft;
  final Color background;
  final Color surface;
  final Color border;
  final Color text;
  final Color textMuted;
  final Color onPrimary;
  final Color strike;
  final double radius;
  final double radiusLg;

  HealthPayTheme copyWith({
    Color? navy,
    Color? teal,
    Color? tealDark,
    Color? tealSoft,
    Color? gold,
    Color? goldSoft,
    Color? background,
    Color? surface,
    Color? border,
    Color? text,
    Color? textMuted,
    Color? onPrimary,
    Color? strike,
    double? radius,
    double? radiusLg,
  }) {
    return HealthPayTheme(
      navy: navy ?? this.navy,
      teal: teal ?? this.teal,
      tealDark: tealDark ?? this.tealDark,
      tealSoft: tealSoft ?? this.tealSoft,
      gold: gold ?? this.gold,
      goldSoft: goldSoft ?? this.goldSoft,
      background: background ?? this.background,
      surface: surface ?? this.surface,
      border: border ?? this.border,
      text: text ?? this.text,
      textMuted: textMuted ?? this.textMuted,
      onPrimary: onPrimary ?? this.onPrimary,
      strike: strike ?? this.strike,
      radius: radius ?? this.radius,
      radiusLg: radiusLg ?? this.radiusLg,
    );
  }
}
