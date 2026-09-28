export type VerticalModuleLayout = "command" | "calendar" | "catalog" | "people" | "commerce" | "operations" | "communication";

export type VerticalModuleBlueprintBlock = {
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly path?: string;
};

export type VerticalModuleBlueprint = {
  readonly eyebrow: string;
  readonly layout: VerticalModuleLayout;
  readonly blocks: readonly VerticalModuleBlueprintBlock[];
};

const block = (label: string, title: string, description: string, path?: string): VerticalModuleBlueprintBlock =>
  path ? { label, title, description, path } : { label, title, description };

export function getVerticalModuleBlueprint(vertical: string, module: string): VerticalModuleBlueprint {
  const v = vertical.trim().toLowerCase();
  const common: Record<string, VerticalModuleBlueprint> = {
    "امروز": {
      eyebrow: "Today Command Surface", layout: "command",
      blocks: [
        block("01", "کارهای جاری", "ساختار صفحه برای اولویت‌بندی کارهای روز؛ داده نهایی از دامنه canonical می‌آید."),
        block("02", "صف نوبت / عملیات", "جایگاه فهرست زنده‌ای که پس از اتصال منبع اصلی پر می‌شود.", "/booking"),
        block("03", "رابط مشتری", "Context مشتری از Customer و Communication خوانده می‌شود.", "/customer"),
      ],
    },
    "خدمات": {
      eyebrow: "Service Supply Surface", layout: "catalog",
      blocks: [
        block("01", "Service catalog", "عرضه خدمت، وضعیت انتشار و قیمت از Catalog canonical.", "/catalog"),
        block("02", "Booking policy", "زمان‌بندی و ظرفیت فقط از Booking/Availability معتبر است.", "/booking"),
        block("03", "Publish & Trust", "انتشار عمومی تابع Business/Trust policy است.", "/business/profile"),
      ],
    },
    "محصولات": {
      eyebrow: "Product Supply Surface", layout: "catalog",
      blocks: [
        block("01", "Product workspace", "Product و Offering منبع حقیقت عرضه هستند.", "/catalog"),
        block("02", "Seller AI", "ورودی خام به listing آماده marketplace تبدیل می‌شود.", "/product-studio"),
        block("03", "Publication", "وضعیت انتشار از Catalog/Business خوانده می‌شود.", "/business/profile"),
      ],
    },
    "پزشکان": {
      eyebrow: "Provider Surface", layout: "people",
      blocks: [
        block("01", "Provider identity", "هویت و عضویت متخصص از Workspace/Team می‌آید.", "/business?module=تیم"),
        block("02", "Access & role", "Role و Permission جایگزین ساخت موجودیت موازی پزشک در UI می‌شود.", "/account"),
        block("03", "Assigned services", "خدمات از Catalog و دسترسی اجرایی از Workspace کنترل می‌شود.", "/catalog"),
      ],
    },
    "متخصصان": {
      eyebrow: "Specialist Surface", layout: "people",
      blocks: [
        block("01", "Specialist roster", "اعضای تیم و نقش تخصصی از Workspace/Team می‌آیند.", "/business?module=تیم"),
        block("02", "Schedule access", "ظرفیت و زمان‌بندی از Availability/Booking تعیین می‌شود.", "/booking"),
        block("03", "Service ownership", "خدمت و offering از Catalog canonical است.", "/catalog"),
      ],
    },
    "مراجعان": {
      eyebrow: "Customer Relationship Surface", layout: "people",
      blocks: [
        block("01", "Customer profile", "رابط و رابطه مشتری از Customer domain خوانده می‌شود.", "/customer"),
        block("02", "Communication context", "پیام‌ها و تعاملات از Communication domain می‌آیند.", "/communication"),
        block("03", "Booking context", "نوبت‌ها فقط از Booking canonical متصل می‌شوند.", "/booking"),
      ],
    },
    "مشتریان": {
      eyebrow: "Customer Relationship Surface", layout: "people",
      blocks: [
        block("01", "Customer profile", "Customer relation منبع حقیقت این صفحه است.", "/customer"),
        block("02", "Communication", "تعامل با مشتری از Communication boundary می‌آید.", "/communication"),
        block("03", "Transactions", "تجربه تجاری بدون کپی کردن Order state.", "/transactions"),
      ],
    },
    "نوبت‌ها": {
      eyebrow: "Appointments Surface", layout: "calendar",
      blocks: [
        block("01", "Appointment queue", "صف نوبت‌ها از Booking canonical می‌آید.", "/booking"),
        block("02", "Service context", "خدمت قابل رزرو از Catalog.", "/catalog"),
        block("03", "Customer context", "مراجع مرتبط از Customer.", "/customer"),
      ],
    },
    "تقویم": {
      eyebrow: "Schedule Surface", layout: "calendar",
      blocks: [
        block("01", "Timeline", "نمای زمانی slotها؛ availability منبع حقیقت است.", "/booking"),
        block("02", "Resource lanes", "ظرفیت و resource پس از اتصال backend در همین ناحیه نمایش داده می‌شود.", "/booking"),
        block("03", "Business hours", "ساعات کاری از Business canonical می‌آید.", "/business"),
      ],
    },
    "موجودی": {
      eyebrow: "Inventory Surface", layout: "commerce",
      blocks: [
        block("01", "Stock state", "مقدار موجودی فقط با Inventory canonical قابل نمایش است.", "/catalog"),
        block("02", "Variant availability", "تنوع فعال و موجودی آن در Catalog معنا پیدا می‌کند.", "/catalog"),
        block("03", "Order impact", "رزرو/فروش موجودی در جریان Commerce دیده می‌شود.", "/transactions"),
      ],
    },
    "سفارش‌ها": {
      eyebrow: "Order Surface", layout: "commerce",
      blocks: [
        block("01", "Order queue", "وضعیت سفارش از Commerce/Transactions می‌آید.", "/transactions"),
        block("02", "Fulfillment", "اجرای سفارش از Operations پیگیری می‌شود.", "/operations"),
        block("03", "Customer context", "مشتری مرتبط در Customer domain باقی می‌ماند.", "/customer"),
      ],
    },
    "آشپزخانه": {
      eyebrow: "Kitchen Surface", layout: "operations",
      blocks: [
        block("01", "Preparation queue", "صف آماده‌سازی جای Operations canonical را نشان می‌دهد.", "/operations"),
        block("02", "Order context", "سفارش مرتبط از Commerce.", "/transactions"),
        block("03", "Handoff", "تحویل به fulfillment با منبع canonical پیگیری می‌شود.", "/operations"),
      ],
    },
    "تحویل": {
      eyebrow: "Delivery Surface", layout: "operations",
      blocks: [
        block("01", "Fulfillment queue", "صف تحویل از Operations.", "/operations"),
        block("02", "Order state", "وضعیت سفارش از Commerce.", "/transactions"),
        block("03", "Customer context", "مقصد/مشتری از Customer در دسترس قرار می‌گیرد.", "/customer"),
      ],
    },
    "زمان‌بندی": {
      eyebrow: "Schedule Surface", layout: "calendar",
      blocks: [
        block("01", "Provider timeline", "برنامه متخصصان از Availability/Booking تغذیه می‌شود.", "/booking"),
        block("02", "Capacity", "ظرفیت واقعی از backend authoritative می‌آید.", "/booking"),
        block("03", "Business hours", "ساعات پایه از Business.", "/business"),
      ],
    },
    "ظرفیت": {
      eyebrow: "Capacity Surface", layout: "calendar",
      blocks: [
        block("01", "Capacity lanes", "جایگاه نمایش ظرفیت منابع.", "/booking"),
        block("02", "Specialists", "منابع انسانی از Team/Workspace.", "/business?module=تیم"),
        block("03", "Services", "مدت و خدمت از Catalog.", "/catalog"),
      ],
    },
  };

  const verticalSpecific: Record<string, Record<string, VerticalModuleBlueprint>> = {
    clinic: common,
    retail: common,
    restaurant: common,
    salon: common,
  };

  const blueprint = verticalSpecific[v]?.[module] ?? common[module];
  return blueprint ?? {
    eyebrow: "Capability Surface", layout: "command",
    blocks: [
      block("01", "Canonical source", "منبع حقیقت این Capability از backend domain اصلی می‌آید."),
      block("02", "Workspace context", "این سطح فقط context شغلی را نگه می‌دارد."),
      block("03", "Next action", "اقدام اجرایی باید از command/API canonical عبور کند."),
    ],
  };
}
