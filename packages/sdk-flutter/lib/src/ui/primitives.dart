import 'package:flutter/material.dart';

import '../theme.dart';

enum HpBadgeTone { teal, gold, solid }

class HpBadge extends StatelessWidget {
  const HpBadge({super.key, required this.label, required this.theme, this.tone = HpBadgeTone.teal});

  final String label;
  final HealthPayTheme theme;
  final HpBadgeTone tone;

  @override
  Widget build(BuildContext context) {
    late final Color bg;
    late final Color fg;
    late final Color border;
    switch (tone) {
      case HpBadgeTone.teal:
        bg = theme.tealSoft;
        fg = theme.tealDark;
        border = theme.tealSoft;
        break;
      case HpBadgeTone.gold:
        bg = theme.goldSoft;
        fg = const Color(0xFF8A6212);
        border = theme.gold;
        break;
      case HpBadgeTone.solid:
        bg = theme.teal;
        fg = theme.onPrimary;
        border = theme.teal;
        break;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: border, width: tone == HpBadgeTone.teal ? 0 : 1),
      ),
      child: Text(
        label,
        style: TextStyle(color: fg, fontSize: 12, fontWeight: FontWeight.w700),
      ),
    );
  }
}

enum HpButtonVariant { teal, navy, outline }

class HpButton extends StatelessWidget {
  const HpButton({
    super.key,
    required this.label,
    required this.onPressed,
    required this.theme,
    this.variant = HpButtonVariant.teal,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final HealthPayTheme theme;
  final HpButtonVariant variant;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final isOutline = variant == HpButtonVariant.outline;
    final bg = isOutline
        ? Colors.transparent
        : variant == HpButtonVariant.navy
            ? theme.navy
            : theme.teal;
    final fg = isOutline ? theme.tealDark : theme.onPrimary;
    final disabled = onPressed == null || loading;
    return Opacity(
      opacity: disabled ? 0.55 : 1,
      child: Material(
        color: bg,
        borderRadius: BorderRadius.circular(theme.radius),
        child: InkWell(
          borderRadius: BorderRadius.circular(theme.radius),
          onTap: disabled ? null : onPressed,
          child: Container(
            height: 48,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(theme.radius),
              border: isOutline ? Border.all(color: theme.teal, width: 1.5) : null,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (loading) ...[
                  SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: fg),
                  ),
                  const SizedBox(width: 8),
                ],
                Text(label, style: TextStyle(color: fg, fontSize: 15, fontWeight: FontWeight.w700)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class HpCard extends StatelessWidget {
  const HpCard({
    super.key,
    required this.child,
    required this.theme,
    this.selected = false,
  });

  final Widget child;
  final HealthPayTheme theme;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: selected ? theme.tealSoft : theme.surface,
        borderRadius: BorderRadius.circular(theme.radiusLg),
        border: Border.all(
          color: selected ? theme.teal : theme.border,
          width: selected ? 2 : 1.3,
        ),
      ),
      child: child,
    );
  }
}

class HpHeader extends StatelessWidget {
  const HpHeader({super.key, required this.theme, this.statusLabel});

  final HealthPayTheme theme;
  final String? statusLabel;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: theme.navy,
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                width: 22,
                height: 22,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: theme.teal, shape: BoxShape.circle),
                child: Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(color: theme.navy, shape: BoxShape.circle),
                ),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('HealthPay',
                      style: TextStyle(color: theme.onPrimary, fontSize: 15, fontWeight: FontWeight.w700)),
                  const Text('Medical discount card',
                      style: TextStyle(color: Color(0xFF9FB4D6), fontSize: 10.5)),
                ],
              ),
            ],
          ),
          if (statusLabel != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
              decoration: BoxDecoration(
                color: const Color(0x1FFFFFFF),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(statusLabel!,
                  style: TextStyle(color: theme.onPrimary, fontSize: 11, fontWeight: FontWeight.w700)),
            ),
        ],
      ),
    );
  }
}
