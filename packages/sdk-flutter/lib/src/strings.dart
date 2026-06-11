/// Built-in EN/AR strings for the drop-in flow. Override via [HealthPayStrings].

enum HealthPayLocale { en, ar }

bool isRtl(HealthPayLocale locale) => locale == HealthPayLocale.ar;

/// The text used across the flow. Construct directly to override any label, or
/// use [HealthPayStrings.of] for the built-in EN/AR set.
class HealthPayStrings {
  const HealthPayStrings({
    required this.preparingTitle,
    required this.preparingBody,
    required this.smsSent,
    required this.chooseTitle,
    required this.alternativeBadge,
    required this.youPay,
    required this.youSave,
    required this.confirmSelection,
    required this.confirming,
    required this.notInsurance,
    required this.confirmedTitle,
    required this.showCode,
    required this.discountCode,
    required this.expiredTitle,
    required this.expiredBody,
    required this.cancelledTitle,
    required this.errorTitle,
    required this.retry,
    required this.offersCount,
  });

  final String preparingTitle;
  final String preparingBody;
  final String smsSent;
  final String chooseTitle;
  final String alternativeBadge;
  final String youPay;
  final String youSave;
  final String confirmSelection;
  final String confirming;
  final String notInsurance;
  final String confirmedTitle;
  final String showCode;
  final String discountCode;
  final String expiredTitle;
  final String expiredBody;
  final String cancelledTitle;
  final String errorTitle;
  final String retry;
  final String Function(int count) offersCount;

  static HealthPayStrings of(HealthPayLocale locale) =>
      locale == HealthPayLocale.ar ? _ar : _en;

  static final HealthPayStrings _en = HealthPayStrings(
    preparingTitle: 'Preparing your quote',
    preparingBody: 'Matching providers and pricing near you…',
    smsSent: 'A secure link was also sent by SMS',
    chooseTitle: 'Choose your offer',
    alternativeBadge: 'Alternative branch',
    youPay: 'You pay',
    youSave: 'You save',
    confirmSelection: 'Confirm selection',
    confirming: 'Confirming…',
    notInsurance: 'This is a medical discount card, not insurance.',
    confirmedTitle: "You're confirmed",
    showCode: 'Show this at the provider',
    discountCode: 'DISCOUNT CODE',
    expiredTitle: 'This quote has expired',
    expiredBody: 'Please request a new quote to see current pricing.',
    cancelledTitle: 'This request was cancelled',
    errorTitle: 'Something went wrong',
    retry: 'Try again',
    offersCount: (n) => '$n offer${n == 1 ? '' : 's'}',
  );

  static final HealthPayStrings _ar = HealthPayStrings(
    preparingTitle: 'جارٍ تجهيز عرض السعر',
    preparingBody: 'نبحث عن مقدمي الخدمة والأسعار القريبة منك…',
    smsSent: 'تم إرسال رابط آمن أيضًا عبر رسالة نصية',
    chooseTitle: 'اختر عرضك',
    alternativeBadge: 'فرع بديل',
    youPay: 'تدفع',
    youSave: 'توفّر',
    confirmSelection: 'تأكيد الاختيار',
    confirming: 'جارٍ التأكيد…',
    notInsurance: 'هذه بطاقة خصم طبي وليست تأمينًا.',
    confirmedTitle: 'تم التأكيد',
    showCode: 'اعرض هذا عند مقدم الخدمة',
    discountCode: 'كود الخصم',
    expiredTitle: 'انتهت صلاحية هذا العرض',
    expiredBody: 'يرجى طلب عرض سعر جديد لرؤية الأسعار الحالية.',
    cancelledTitle: 'تم إلغاء هذا الطلب',
    errorTitle: 'حدث خطأ ما',
    retry: 'حاول مرة أخرى',
    offersCount: (n) => '$n ${n == 1 ? 'عرض' : 'عروض'}',
  );
}
