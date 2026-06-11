import 'strings.dart';

const List<String> _arDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/// Render a number with thousands separators, in Western or Arabic-Indic digits.
String formatNumber(num n, HealthPayLocale locale) {
  final grouped = n
      .round()
      .toString()
      .replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');
  if (locale == HealthPayLocale.ar) {
    return grouped.replaceAllMapped(
      RegExp(r'\d'),
      (m) => _arDigits[int.parse(m.group(0)!)],
    );
  }
  return grouped;
}

/// "320 EGP" / "٣٢٠ ج.م" — currency after the amount, RTL-friendly.
String formatPrice(num amount, String currency, HealthPayLocale locale) {
  final cur =
      locale == HealthPayLocale.ar && currency == 'EGP' ? 'ج.م' : currency;
  return '${formatNumber(amount, locale)} $cur';
}

/// Discount percent, e.g. "-60%".
String formatDiscount(num pct, HealthPayLocale locale) =>
    '-${formatNumber(pct, locale)}%';
