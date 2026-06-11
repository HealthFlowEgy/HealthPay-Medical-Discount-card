/** Built-in EN/AR strings for the drop-in flow. Override via the `strings` prop. */

export type Locale = "en" | "ar";

export interface FlowStrings {
  preparingTitle: string;
  preparingBody: string;
  smsSent: string;
  chooseTitle: string;
  offersCount: (n: number) => string;
  alternativeBadge: string;
  youPay: string;
  youSave: string;
  listPrice: string;
  confirmSelection: string;
  confirming: string;
  notInsurance: string;
  confirmedTitle: string;
  showCode: string;
  reference: string;
  done: string;
  expiredTitle: string;
  expiredBody: string;
  cancelledTitle: string;
  errorTitle: string;
  retry: string;
}

export const STRINGS: Record<Locale, FlowStrings> = {
  en: {
    preparingTitle: "Preparing your quote",
    preparingBody: "Matching providers and pricing near you…",
    smsSent: "A secure link was also sent by SMS",
    chooseTitle: "Choose your offer",
    offersCount: (n) => `${n} offer${n === 1 ? "" : "s"}`,
    alternativeBadge: "Alternative branch",
    youPay: "You pay",
    youSave: "You save",
    listPrice: "List price",
    confirmSelection: "Confirm selection",
    confirming: "Confirming…",
    notInsurance: "This is a medical discount card, not insurance.",
    confirmedTitle: "You're confirmed",
    showCode: "Show this at the provider",
    reference: "Reference",
    done: "Done",
    expiredTitle: "This quote has expired",
    expiredBody: "Please request a new quote to see current pricing.",
    cancelledTitle: "This request was cancelled",
    errorTitle: "Something went wrong",
    retry: "Try again",
  },
  ar: {
    preparingTitle: "جارٍ تجهيز عرض السعر",
    preparingBody: "نبحث عن مقدمي الخدمة والأسعار القريبة منك…",
    smsSent: "تم إرسال رابط آمن أيضًا عبر رسالة نصية",
    chooseTitle: "اختر عرضك",
    offersCount: (n) => `${n} ${n === 1 ? "عرض" : "عروض"}`,
    alternativeBadge: "فرع بديل",
    youPay: "تدفع",
    youSave: "توفّر",
    listPrice: "السعر الأصلي",
    confirmSelection: "تأكيد الاختيار",
    confirming: "جارٍ التأكيد…",
    notInsurance: "هذه بطاقة خصم طبي وليست تأمينًا.",
    confirmedTitle: "تم التأكيد",
    showCode: "اعرض هذا عند مقدم الخدمة",
    reference: "المرجع",
    done: "تم",
    expiredTitle: "انتهت صلاحية هذا العرض",
    expiredBody: "يرجى طلب عرض سعر جديد لرؤية الأسعار الحالية.",
    cancelledTitle: "تم إلغاء هذا الطلب",
    errorTitle: "حدث خطأ ما",
    retry: "حاول مرة أخرى",
  },
};

export const isRTL = (locale: Locale): boolean => locale === "ar";

export function resolveStrings(locale: Locale, overrides?: Partial<FlowStrings>): FlowStrings {
  return { ...STRINGS[locale], ...overrides };
}
