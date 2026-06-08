/** UI string catalog (EN/AR) + helpers. Enum labels come from @healthpay/shared. */

import type { Locale, RequestStatus } from "@healthpay/shared";

export const LOCALE_COOKIE = "hp_locale";
export const DEFAULT_LOCALE: Locale = "ar"; // Egyptian audience: Arabic-first

export type Dict = Record<string, { en: string; ar: string }>;

export const STRINGS: Dict = {
  // Common
  "lang.toggle": { en: "العربية", ar: "English" },
  "brand.tagline": { en: "Medical discount pricing", ar: "أسعار الخصم الطبي" },
  loading: { en: "Loading…", ar: "جاري التحميل…" },
  apply: { en: "Apply", ar: "تطبيق" },
  remove: { en: "Remove", ar: "حذف" },
  notInsurance: {
    en: "HealthPay is a medical discount card (15%–70% off services). It is not insurance.",
    ar: "هيلث باي بطاقة خصم طبي (خصم 15%–70% على الخدمات). ليست تأمينًا.",
  },

  // Landing
  "landing.title": { en: "Quote Engine", ar: "محرك عروض الأسعار" },
  "landing.desc": {
    en: "Medical-discount pricing quotes for partner platforms. Partners request pricing via the API/SDK, HealthPay operations attach discount options, and end users confirm their choice on a hosted quote page.",
    ar: "عروض أسعار الخصم الطبي لمنصات الشركاء. يطلب الشركاء الأسعار عبر الـ API/SDK، ويضيف فريق عمليات هيلث باي خيارات الخصم، ويؤكد المستخدمون اختيارهم عبر صفحة عرض مستضافة.",
  },
  "landing.opsDashboard": { en: "Operations dashboard", ar: "لوحة العمليات" },
  "landing.docs": { en: "Documentation", ar: "الوثائق" },

  // Ops dashboard
  "ops.title": { en: "Operations", ar: "العمليات" },
  "ops.live": { en: "live", ar: "مباشر" },
  "ops.polling": { en: "polling", ar: "تحديث دوري" },
  "ops.signOut": { en: "Sign out", ar: "تسجيل الخروج" },
  "ops.allStatuses": { en: "All statuses", ar: "كل الحالات" },
  "ops.allGovernorates": { en: "All governorates", ar: "كل المحافظات" },
  "ops.allServices": { en: "All services", ar: "كل الخدمات" },
  "ops.search": { en: "Search mobile / partner ref…", ar: "بحث برقم الموبايل / مرجع الشريك…" },
  "ops.col.status": { en: "Status", ar: "الحالة" },
  "ops.col.service": { en: "Service", ar: "الخدمة" },
  "ops.col.location": { en: "Location", ar: "الموقع" },
  "ops.col.mobile": { en: "Mobile", ar: "الموبايل" },
  "ops.col.partner": { en: "Partner", ar: "الشريك" },
  "ops.col.age": { en: "Age", ar: "المدة" },
  "ops.noResults": { en: "No requests match these filters.", ar: "لا توجد طلبات مطابقة." },
  "ops.newArrived": { en: "new request(s) arrived — refresh", ar: "طلب/طلبات جديدة وصلت — تحديث" },

  // Login
  "login.title": { en: "Operations sign-in", ar: "دخول العمليات" },
  "login.subtitle": { en: "Staff access to the quote queue.", ar: "دخول الموظفين إلى قائمة العروض." },
  "login.email": { en: "Email", ar: "البريد الإلكتروني" },
  "login.password": { en: "Password", ar: "كلمة المرور" },
  "login.submit": { en: "Sign in", ar: "تسجيل الدخول" },
  "login.submitting": { en: "Signing in…", ar: "جاري الدخول…" },

  // Drawer
  "drawer.partner": { en: "Partner", ar: "الشريك" },
  "drawer.partnerRef": { en: "Partner ref", ar: "مرجع الشريك" },
  "drawer.nid4": { en: "National ID (last 4)", ar: "الرقم القومي (آخر ٤)" },
  "drawer.expires": { en: "Expires", ar: "ينتهي" },
  "drawer.sms": { en: "SMS", ar: "الرسالة النصية" },
  "drawer.note": { en: "Note", ar: "ملاحظة" },
  "drawer.member": { en: "Member", ar: "العضو" },
  "drawer.company": { en: "Company", ar: "الشركة" },
  "drawer.gender": { en: "Gender", ar: "النوع" },
  "drawer.maritalStatus": { en: "Marital status", ar: "الحالة الاجتماعية" },
  "drawer.providerType": { en: "Provider type", ar: "نوع مقدم الخدمة" },
  "drawer.specialty": { en: "Specialty", ar: "التخصص" },
  "drawer.area": { en: "Area", ar: "المنطقة" },
  "drawer.contactPii": { en: "Contact details (PII)", ar: "بيانات الاتصال" },
  "drawer.reveal": { en: "Reveal (audited)", ar: "إظهار (مسجّل)" },
  "drawer.revealing": { en: "Revealing…", ar: "جاري الإظهار…" },
  "drawer.revealNote": {
    en: "This reveal has been recorded in the audit log.",
    ar: "تم تسجيل هذا الإظهار في سجل التدقيق.",
  },
  "drawer.mobile": { en: "Mobile", ar: "الموبايل" },
  "drawer.nationalId": { en: "National ID", ar: "الرقم القومي" },
  "drawer.options": { en: "Pricing options", ar: "خيارات الأسعار" },
  "drawer.selectedByUser": { en: "✓ Selected by user", ar: "✓ تم اختياره من المستخدم" },
  "drawer.addOptions": { en: "Add pricing options", ar: "إضافة خيارات الأسعار" },
  "drawer.providerName": { en: "Provider name", ar: "اسم مقدم الخدمة" },
  "drawer.address": { en: "Address (optional)", ar: "العنوان (اختياري)" },
  "drawer.serviceDesc": { en: "Service description", ar: "وصف الخدمة" },
  "drawer.listPrice": { en: "List price", ar: "السعر الأصلي" },
  "drawer.discountedPrice": { en: "Discounted price", ar: "السعر بعد الخصم" },
  "drawer.validityNote": { en: "Validity note (optional)", ar: "ملاحظة الصلاحية (اختياري)" },
  "drawer.enterPrices": { en: "Enter prices to compute discount", ar: "أدخل الأسعار لحساب الخصم" },
  "drawer.discount": { en: "Discount", ar: "الخصم" },
  "drawer.removeDraft": { en: "Remove draft", ar: "حذف المسودة" },
  "drawer.addAnother": { en: "+ Add another", ar: "+ إضافة آخر" },
  "drawer.sendQuote": { en: "Send quote", ar: "إرسال العرض" },
  "drawer.addMore": { en: "Add options", ar: "إضافة خيارات" },
  "drawer.saving": { en: "Saving…", ar: "جاري الحفظ…" },
  "drawer.findProvider": { en: "Find provider in directory", ar: "ابحث عن مقدم خدمة في الدليل" },
  "drawer.searchProviders": { en: "Search providers…", ar: "ابحث عن مقدمي الخدمة…" },
  "drawer.use": { en: "Use", ar: "اختيار" },

  // Quote page
  "quote.linkUnavailable": { en: "Link not available", ar: "الرابط غير متاح" },
  "quote.loadingPricing": { en: "Loading your pricing…", ar: "جاري تحميل أسعارك…" },
  "quote.preparingTitle": { en: "Your pricing is being prepared", ar: "يتم تجهيز أسعارك" },
  "quote.expiredTitle": { en: "This quote has expired", ar: "انتهت صلاحية هذا العرض" },
  "quote.expiredDesc": {
    en: "Please submit a new request through your provider to receive fresh pricing.",
    ar: "يرجى تقديم طلب جديد عبر مزودك للحصول على أسعار جديدة.",
  },
  "quote.cancelledTitle": { en: "This request was cancelled", ar: "تم إلغاء هذا الطلب" },
  "quote.confirmedTitle": { en: "Your choice is confirmed", ar: "تم تأكيد اختيارك" },
  "quote.chooseTitle": { en: "Choose your pricing option", ar: "اختر خيار السعر المناسب" },
  "quote.validUntil": { en: "Valid until", ar: "صالح حتى" },
  "quote.thankYou": {
    en: "✓ Thank you. Your selection has been sent to your provider.",
    ar: "✓ شكرًا لك. تم إرسال اختيارك إلى مزودك.",
  },
  "quote.save": { en: "Save", ar: "وفّر" },
  "quote.confirm": { en: "Confirm my selection", ar: "تأكيد اختياري" },
  "quote.confirming": { en: "Confirming…", ar: "جاري التأكيد…" },
  "quote.couldNotConfirm": { en: "Could not confirm your selection.", ar: "تعذّر تأكيد اختيارك." },
};

export const STATUS_LABELS: Record<RequestStatus, { en: string; ar: string }> = {
  pending_quote: { en: "pending quote", ar: "بانتظار التسعير" },
  quoted: { en: "quoted", ar: "تم التسعير" },
  confirmed: { en: "confirmed", ar: "مؤكد" },
  expired: { en: "expired", ar: "منتهي" },
  cancelled: { en: "cancelled", ar: "ملغي" },
};

export const SMS_STATUS_LABELS: Record<string, { en: string; ar: string }> = {
  pending: { en: "pending", ar: "قيد الإرسال" },
  sent: { en: "sent", ar: "تم الإرسال" },
  delivered: { en: "delivered", ar: "تم التسليم" },
  failed: { en: "failed", ar: "فشل" },
  undelivered: { en: "undelivered", ar: "لم يُسلَّم" },
  unknown: { en: "unknown", ar: "غير معروف" },
};

export function t(locale: Locale, key: string): string {
  const entry = STRINGS[key];
  if (!entry) return key;
  return locale === "ar" ? entry.ar : entry.en;
}
