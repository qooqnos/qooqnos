export type BusinessVerticalKey = "default" | "clinic" | "retail" | "restaurant" | "salon";

export type BusinessVerticalUi = {
  readonly key: BusinessVerticalKey;
  readonly label: string;
  readonly icon: string;
  readonly subtitle: string;
  readonly modules: readonly string[];
  readonly actions: readonly string[];
  readonly metrics: readonly string[];
  readonly customerActions: readonly string[];
};

/**
 * Canonical presentation registry for Business Workspace verticals.
 *
 * This registry owns vertical copy/navigation composition only.
 * It is not an authorization source and never decides whether a capability
 * may be accessed or mutated. Backend policy remains authoritative.
 */
export const BUSINESS_VERTICAL_UI: Readonly<Record<BusinessVerticalKey, BusinessVerticalUi>> = {
  default: {
    key: "default",
    label: "کسب‌وکار عمومی",
    icon: "◆",
    subtitle: "Workspace قابل تنظیم بر اساس قابلیت‌های فعال.",
    modules: ["نمای کلی", "پروفایل", "محتوا", "محصولات", "خدمات", "مشتریان", "پیام‌ها", "معاملات", "تیم", "گزارش‌ها"],
    actions: ["ایجاد محتوا", "مدیریت عرضه", "بررسی معاملات"],
    metrics: ["فعالیت امروز", "مشتریان", "محتوا", "معاملات"],
    customerActions: ["مشاهده", "تماس", "پیام"],
  },
  clinic: {
    key: "clinic",
    label: "مطب / کلینیک",
    icon: "✚",
    subtitle: "رزرو، خدمات، پزشکان، زمان‌بندی و ارتباط با مراجعان.",
    modules: ["امروز", "نوبت‌ها", "تقویم", "پزشکان", "خدمات", "مراجعان", "ساعات کاری", "پیام‌ها", "پرداخت", "محتوا", "تیم"],
    actions: ["افزودن خدمت", "تنظیم زمان‌بندی", "مدیریت نوبت‌ها"],
    metrics: ["نوبت‌های امروز", "خدمات", "پزشکان", "پیام‌های جدید"],
    customerActions: ["مشاهده خدمات", "رزرو", "تماس", "پیام"],
  },
  retail: {
    key: "retail",
    label: "فروشگاه / خرده‌فروشی",
    icon: "▦",
    subtitle: "محصول، تنوع، موجودی، سفارش و مشتری در یک Workspace.",
    modules: ["فروش امروز", "محصولات", "مدل‌ها و تنوع", "سایز و رنگ", "موجودی", "سفارش‌ها", "مرجوعی", "مشتریان", "تخفیف‌ها", "محتوا", "گزارش فروش"],
    actions: ["افزودن محصول", "ثبت موجودی", "ساخت محتوای محصول"],
    metrics: ["فروش امروز", "موجودی کم", "سفارش‌ها", "مشتریان"],
    customerActions: ["مشاهده", "مقایسه", "ذخیره", "خرید فوری"],
  },
  restaurant: {
    key: "restaurant",
    label: "رستوران",
    icon: "⌂",
    subtitle: "منو، سفارش، میز، رزرو، آشپزخانه و تحویل.",
    modules: ["سفارش‌های امروز", "منو", "میزها", "رزرو", "آشپزخانه", "تحویل", "مشتریان", "تخفیف", "پرداخت", "گزارش"],
    actions: ["مدیریت منو", "تنظیم میزها", "بررسی رزروها"],
    metrics: ["سفارش‌های فعال", "رزروها", "میزهای باز", "تحویل‌ها"],
    customerActions: ["مشاهده منو", "سفارش", "رزرو", "دریافت"],
  },
  salon: {
    key: "salon",
    label: "سالن زیبایی",
    icon: "✦",
    subtitle: "خدمات، متخصصان، تقویم، ظرفیت و مشتریان.",
    modules: ["وقت‌های امروز", "خدمات", "متخصصان", "تقویم", "مشتریان", "ظرفیت", "پرداخت", "پیشنهادها", "محتوا", "تیم"],
    actions: ["افزودن خدمت", "تنظیم برنامه", "افزودن متخصص"],
    metrics: ["وقت‌های امروز", "خدمات", "متخصصان", "مشتریان"],
    customerActions: ["مشاهده خدمت", "انتخاب متخصص", "رزرو", "تماس"],
  },
};

export function resolveBusinessVerticalKey(value: unknown): BusinessVerticalKey {
  const raw = String(value ?? "").trim().toLowerCase();
  if (/(clinic|doctor|medical|مطب|کلینیک|پزشک)/.test(raw)) return "clinic";
  if (/(shoe|retail|store|shop|فروشگاه|کفش|خرده)/.test(raw)) return "retail";
  if (/(restaurant|cafe|food|رستوران|کافه|غذا)/.test(raw)) return "restaurant";
  if (/(salon|beauty|hair|سالن|زیبایی|آرایش)/.test(raw)) return "salon";
  return "default";
}

export function getBusinessVerticalUi(value: unknown): BusinessVerticalUi {
  return BUSINESS_VERTICAL_UI[resolveBusinessVerticalKey(value)];
}
