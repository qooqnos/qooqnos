export type VerticalModuleLayout =
  | "command"
  | "calendar"
  | "catalog"
  | "people"
  | "commerce"
  | "operations"
  | "communication";

export type VerticalModuleState =
  | "connected"
  | "requires-input"
  | "readonly"
  | "unavailable";

export type VerticalRoleLensKey =
  | "management"
  | "sales"
  | "specialist"
  | "finance"
  | "generic";

export type VerticalModuleCapabilityRequirement = {
  readonly capability: string;
  readonly permissions: readonly string[];
  readonly source: "runtime-registry-contract";
};

export type VerticalModuleCapabilityContract = {
  readonly requiredCapabilities: readonly string[];
  readonly requiredPermissions: readonly string[];
  readonly source: "runtime-registry-contract";
};

export type VerticalModuleBlueprintBlock = {
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly path?: string;
};

export type VerticalModuleBlueprintState = {
  readonly key: VerticalModuleState;
  readonly label: string;
  readonly description: string;
};

export type VerticalModuleBlueprint = {
  /**
   * Canonical domain concepts represented by this UI module.
   * These keys are presentation references only; the domain source of truth
   * remains owned by the canonical module described by each key.
   */
  readonly canonicalTermKeys: readonly string[];
  readonly eyebrow: string;
  readonly layout: VerticalModuleLayout;
  readonly interaction: "command" | "browse" | "configure" | "review";
  /**
   * UI emphasis only. This is never an authorization decision.
   * The backend remains the source of truth for access and mutation.
   */
  readonly roleLenses?: readonly VerticalRoleLensKey[];
  readonly primaryAction?: {
    readonly label: string;
    readonly path: string;
  };
  readonly blocks: readonly VerticalModuleBlueprintBlock[];
  readonly states: readonly VerticalModuleBlueprintState[];
  readonly capabilityContract: VerticalModuleCapabilityContract;
};

/**
 * Capability requirements are presentation metadata only.
 * The Runtime/module registry remains the authoritative source of enabled
 * capabilities and the backend remains authoritative for authorization.
 *
 * Keep permission identifiers grounded in the existing authorization contracts.
 * A module may declare a capability without a local client-side enablement
 * decision; this registry only describes what the surface depends on.
 */
const MODULE_CANONICAL_TERM_KEYS: Readonly<Record<string, readonly string[]>> = {
  "نمای کلی": ["canonical.business.business"],
  "امروز": ["canonical.booking.appointment", "canonical.customer.customer"],
  "فروش امروز": ["canonical.commerce.order", "canonical.customer.customer"],
  "وقت‌های امروز": ["canonical.booking.appointment", "canonical.customer.customer"],
  "نوبت‌ها": ["canonical.booking.appointment", "canonical.booking.booking"],
  "تقویم": ["canonical.booking.schedule", "canonical.booking.availabilityRule"],
  "پزشکان": ["canonical.identity.membership", "canonical.platform.capability"],
  "متخصصان": ["canonical.identity.membership", "canonical.booking.resource"],
  "مراجعان": ["canonical.customer.customer", "canonical.booking.appointment"],
  "مشتریان": ["canonical.customer.customer", "canonical.customer.customerRelationship"],
  "ساعات کاری": ["canonical.business.business", "canonical.booking.schedule"],
  "ساعت کاری": ["canonical.business.business", "canonical.booking.schedule"],
  "زمان‌بندی": ["canonical.booking.schedule", "canonical.booking.availabilityRule"],
  "ظرفیت": ["canonical.booking.resource", "canonical.booking.slot"],
  "خدمات": ["canonical.catalog.service", "canonical.catalog.offering"],
  "محصولات": ["canonical.catalog.product", "canonical.catalog.offering"],
  "مدل‌ها و تنوع": ["canonical.catalog.productVariant", "canonical.catalog.attributeValue"],
  "سایز و رنگ": ["canonical.catalog.productVariant", "canonical.catalog.attributeValue"],
  "موجودی": ["canonical.catalog.inventory", "canonical.catalog.productVariant"],
  "سفارش‌ها": ["canonical.commerce.order", "canonical.commerce.orderItem"],
  "مرجوعی": ["canonical.billing.refund", "canonical.commerce.order"],
  "سفارش‌های امروز": ["canonical.commerce.order", "canonical.fulfillment.fulfillmentOrder"],
  "میزها": ["canonical.business.location", "canonical.booking.resource"],
  "رزرو": ["canonical.booking.booking", "canonical.booking.appointment"],
  "رزروها": ["canonical.booking.booking", "canonical.booking.appointment"],
  "منو": ["canonical.catalog.offering", "canonical.catalog.product"],
  "آشپزخانه": ["canonical.fulfillment.fulfillmentOrder", "canonical.fulfillment.fulfillmentTask"],
  "تحویل": ["canonical.fulfillment.fulfillmentOrder", "canonical.fulfillment.shipment"],
  "پیام‌ها": ["canonical.communication.conversation", "canonical.communication.message"],
  "پرداخت": ["canonical.billing.payment", "canonical.commerce.order"],
  "تخفیف": ["canonical.promotion.promotion", "canonical.promotion.benefit"],
  "تخفیف‌ها": ["canonical.promotion.promotion", "canonical.promotion.qualification"],
  "پیشنهادها": ["canonical.promotion.offer", "canonical.matching.recommendation"],
  "گزارش": ["canonical.platform.projection"],
  "گزارش فروش": ["canonical.platform.projection", "canonical.commerce.order"],
  "تیم": ["canonical.identity.membership", "canonical.identity.role", "canonical.identity.permission"],
  "محتوا": ["canonical.catalog.offering", "canonical.media.mediaAsset"],
  "پروفایل": ["canonical.business.businessProfile"],
  "گزارش‌ها": ["canonical.platform.projection"],
  "معاملات": ["canonical.commerce.order", "canonical.billing.payment"],
};

const MODULE_CAPABILITY_CONTRACTS: Readonly<Record<string, VerticalModuleCapabilityContract>> = {
  "نمای کلی": { requiredCapabilities: ["business"], requiredPermissions: ["business.profile.read"], source: "runtime-registry-contract" },
  "امروز": { requiredCapabilities: ["booking", "crm"], requiredPermissions: ["booking.read", "crm.read"], source: "runtime-registry-contract" },
  "فروش امروز": { requiredCapabilities: ["commerce", "analytics"], requiredPermissions: ["analytics.read"], source: "runtime-registry-contract" },
  "وقت‌های امروز": { requiredCapabilities: ["booking", "crm"], requiredPermissions: ["booking.read", "crm.read"], source: "runtime-registry-contract" },
  "نوبت‌ها": { requiredCapabilities: ["booking"], requiredPermissions: ["booking.read", "booking.manage"], source: "runtime-registry-contract" },
  "تقویم": { requiredCapabilities: ["availability"], requiredPermissions: ["availability.read", "availability.manage"], source: "runtime-registry-contract" },
  "پزشکان": { requiredCapabilities: ["team"], requiredPermissions: ["team.manage"], source: "runtime-registry-contract" },
  "متخصصان": { requiredCapabilities: ["team"], requiredPermissions: ["team.manage"], source: "runtime-registry-contract" },
  "مراجعان": { requiredCapabilities: ["crm", "customer"], requiredPermissions: ["crm.read", "customer.read"], source: "runtime-registry-contract" },
  "مشتریان": { requiredCapabilities: ["crm", "customer"], requiredPermissions: ["crm.read", "customer.read"], source: "runtime-registry-contract" },
  "ساعات کاری": { requiredCapabilities: ["business"], requiredPermissions: ["business.profile.read"], source: "runtime-registry-contract" },
  "ساعت کاری": { requiredCapabilities: ["business"], requiredPermissions: ["business.profile.read"], source: "runtime-registry-contract" },
  "زمان‌بندی": { requiredCapabilities: ["availability"], requiredPermissions: ["availability.read", "availability.manage"], source: "runtime-registry-contract" },
  "ظرفیت": { requiredCapabilities: ["availability"], requiredPermissions: ["availability.read"], source: "runtime-registry-contract" },
  "خدمات": { requiredCapabilities: ["catalog", "booking"], requiredPermissions: ["catalog.offer.create", "catalog.offer.publish", "booking.read"], source: "runtime-registry-contract" },
  "محصولات": { requiredCapabilities: ["catalog", "commerce"], requiredPermissions: ["catalog.offer.create", "catalog.offer.publish"], source: "runtime-registry-contract" },
  "مدل‌ها و تنوع": { requiredCapabilities: ["catalog"], requiredPermissions: ["catalog.offer.update"], source: "runtime-registry-contract" },
  "سایز و رنگ": { requiredCapabilities: ["catalog"], requiredPermissions: ["catalog.offer.update"], source: "runtime-registry-contract" },
  "موجودی": { requiredCapabilities: ["catalog", "commerce"], requiredPermissions: ["catalog.offer.update"], source: "runtime-registry-contract" },
  "سفارش‌ها": { requiredCapabilities: ["commerce"], requiredPermissions: [], source: "runtime-registry-contract" },
  "مرجوعی": { requiredCapabilities: ["commerce"], requiredPermissions: [], source: "runtime-registry-contract" },
  "سفارش‌های امروز": { requiredCapabilities: ["commerce"], requiredPermissions: [], source: "runtime-registry-contract" },
  "میزها": { requiredCapabilities: ["business", "booking"], requiredPermissions: ["business.profile.read", "booking.read"], source: "runtime-registry-contract" },
  "رزرو": { requiredCapabilities: ["booking"], requiredPermissions: ["booking.read", "booking.manage"], source: "runtime-registry-contract" },
  "رزروها": { requiredCapabilities: ["booking"], requiredPermissions: ["booking.read", "booking.manage"], source: "runtime-registry-contract" },
  "منو": { requiredCapabilities: ["catalog", "commerce"], requiredPermissions: ["catalog.offer.create", "catalog.offer.publish"], source: "runtime-registry-contract" },
  "آشپزخانه": { requiredCapabilities: ["commerce", "operations"], requiredPermissions: ["fulfillment.get"], source: "runtime-registry-contract" },
  "تحویل": { requiredCapabilities: ["commerce", "operations"], requiredPermissions: ["fulfillment.get"], source: "runtime-registry-contract" },
  "پیام‌ها": { requiredCapabilities: ["communication"], requiredPermissions: ["communication.conversation.manage"], source: "runtime-registry-contract" },
  "پرداخت": { requiredCapabilities: ["billing", "commerce"], requiredPermissions: ["billing.manage"], source: "runtime-registry-contract" },
  "تخفیف": { requiredCapabilities: ["promotion"], requiredPermissions: ["promotion.read", "promotion.create"], source: "runtime-registry-contract" },
  "تخفیف‌ها": { requiredCapabilities: ["promotion"], requiredPermissions: ["promotion.read", "promotion.create"], source: "runtime-registry-contract" },
  "پیشنهادها": { requiredCapabilities: ["promotion"], requiredPermissions: ["promotion.read", "promotion.create"], source: "runtime-registry-contract" },
  "گزارش": { requiredCapabilities: ["analytics"], requiredPermissions: ["analytics.read"], source: "runtime-registry-contract" },
  "گزارش فروش": { requiredCapabilities: ["analytics", "commerce"], requiredPermissions: ["analytics.read"], source: "runtime-registry-contract" },
  "تیم": { requiredCapabilities: ["team"], requiredPermissions: ["team.manage"], source: "runtime-registry-contract" },
  "محتوا": { requiredCapabilities: ["catalog"], requiredPermissions: ["catalog.offer.create", "catalog.offer.publish"], source: "runtime-registry-contract" },
  "پروفایل": { requiredCapabilities: ["business"], requiredPermissions: ["business.profile.read", "business.profile.update"], source: "runtime-registry-contract" },
  "گزارش‌ها": { requiredCapabilities: ["analytics"], requiredPermissions: ["analytics.read"], source: "runtime-registry-contract" },
  "معاملات": { requiredCapabilities: ["commerce"], requiredPermissions: ["commerce.order.read"], source: "runtime-registry-contract" },
  "نمای کلی": { requiredCapabilities: ["business"], requiredPermissions: ["business.profile.read"], source: "runtime-registry-contract" },
};

const block = (
  label: string,
  title: string,
  description: string,
  path?: string,
): VerticalModuleBlueprintBlock => (path ? { label, title, description, path } : { label, title, description });

const state = (
  key: VerticalModuleState,
  label: string,
  description: string,
): VerticalModuleBlueprintState => ({ key, label, description });

const states = (
  primaryDescription = "منبع canonical فعال است و صفحه فقط آن را در context این Workspace نمایش می‌دهد.",
  readonlyDescription = "نمایش داده مجاز است، اما تغییر Role، Order یا وضعیت دامنه از این لایه انجام نمی‌شود.",
): readonly VerticalModuleBlueprintState[] => [
  state("connected", "متصل", primaryDescription),
  state("requires-input", "نیازمند ورودی", "برای ادامه، شناسه یا پارامتر لازم از منبع canonical باید مشخص شود."),
  state("readonly", "فقط خواندنی", readonlyDescription),
  state("unavailable", "در دسترس نیست", "Capability یا endpoint متناظر هنوز در این محیط فعال نشده است."),
];

const blueprint = (
  eyebrow: string,
  layout: VerticalModuleLayout,
  interaction: VerticalModuleBlueprint["interaction"],
  blocks: readonly VerticalModuleBlueprintBlock[],
  primaryAction?: VerticalModuleBlueprint["primaryAction"],
  canonicalTermKeys: readonly string[] = [],
): VerticalModuleBlueprint => ({
  canonicalTermKeys,
  eyebrow,
  layout,
  interaction,
  ...(primaryAction ? { primaryAction } : {}),
  blocks,
  states: states(),
  capabilityContract: {
    requiredCapabilities: [],
    requiredPermissions: [],
    source: "runtime-registry-contract",
  },
});

const shared: Record<string, VerticalModuleBlueprint> = {
  "امروز": blueprint("Today Command Surface", "command", "command", [
    block("01", "کارهای جاری", "صف اولویت‌های روز؛ عدد و state واقعی بعداً از domain canonical می‌آید."),
    block("02", "عملیات نزدیک", "جریان اصلی شغلی از Booking، Commerce یا Operations متصل می‌شود."),
    block("03", "رابط مشتری", "Context مشتری از Customer و Communication خوانده می‌شود.", "/customer"),
  ]),
  "خدمات": blueprint("Service Supply Surface", "catalog", "configure", [
    block("01", "Service catalog", "عرضه خدمت، وضعیت انتشار و قیمت از Catalog canonical.", "/catalog"),
    block("02", "Booking policy", "زمان‌بندی و ظرفیت فقط از Booking/Availability معتبر است.", "/booking"),
    block("03", "Publish & Trust", "انتشار عمومی تابع Business/Trust policy است.", "/business/profile"),
  ], { label: "باز کردن کاتالوگ", path: "/catalog" }),
  "محصولات": blueprint("Product Supply Surface", "catalog", "configure", [
    block("01", "Product workspace", "Product و Offering منبع حقیقت عرضه هستند.", "/catalog"),
    block("02", "Seller AI", "ورودی خام به listing آماده marketplace تبدیل می‌شود.", "/product-studio"),
    block("03", "Publication", "وضعیت انتشار از Catalog/Business خوانده می‌شود.", "/business/profile"),
  ], { label: "باز کردن کاتالوگ", path: "/catalog" }),
  "پزشکان": blueprint("Business Team Surface", "people", "browse", [
    block("01", "Team identity", "هویت و عضویت متخصص از Workspace/Team می‌آید.", "/business?module=تیم"),
    block("02", "Access & role", "Role و Permission جایگزین ساخت موجودیت موازی پزشک در UI می‌شود.", "/account"),
    block("03", "Assigned services", "خدمات از Catalog و دسترسی اجرایی از Workspace کنترل می‌شود.", "/catalog"),
  ], { label: "مشاهده تیم", path: "/business?module=تیم" }),
  "متخصصان": blueprint("Specialist Surface", "people", "browse", [
    block("01", "Specialist roster", "اعضای تیم و نقش تخصصی از Workspace/Team می‌آیند.", "/business?module=تیم"),
    block("02", "Schedule access", "ظرفیت و زمان‌بندی از Availability/Booking تعیین می‌شود.", "/booking"),
    block("03", "Service ownership", "خدمت و offering از Catalog canonical است.", "/catalog"),
  ], { label: "مشاهده تیم", path: "/business?module=تیم" }),
  "مراجعان": blueprint("Customer Relationship Surface", "people", "browse", [
    block("01", "Customer profile", "رابط و رابطه مشتری از Customer domain خوانده می‌شود.", "/customer"),
    block("02", "Communication context", "پیام‌ها و تعاملات از Communication domain می‌آیند.", "/communication"),
    block("03", "Booking context", "نوبت‌ها فقط از Booking canonical متصل می‌شوند.", "/booking"),
  ], { label: "باز کردن مشتریان", path: "/customer" }),
  "مشتریان": blueprint("Customer Relationship Surface", "people", "browse", [
    block("01", "Customer profile", "Customer relation منبع حقیقت این صفحه است.", "/customer"),
    block("02", "Communication", "تعامل با مشتری از Communication boundary می‌آید.", "/communication"),
    block("03", "Transactions", "تجربه تجاری بدون کپی کردن Order state.", "/transactions"),
  ], { label: "باز کردن مشتریان", path: "/customer" }),
  "نوبت‌ها": blueprint("Appointments Surface", "calendar", "command", [
    block("01", "Appointment queue", "صف نوبت‌ها از Booking canonical می‌آید.", "/booking"),
    block("02", "Service context", "خدمت قابل رزرو از Catalog.", "/catalog"),
    block("03", "Customer context", "مراجع مرتبط از Customer.", "/customer"),
  ], { label: "باز کردن رزرو", path: "/booking" }),
  "تقویم": blueprint("Schedule Surface", "calendar", "browse", [
    block("01", "Timeline", "نمای زمانی slotها؛ availability منبع حقیقت است.", "/booking"),
    block("02", "Resource lanes", "ظرفیت و resource پس از اتصال backend در همین ناحیه نمایش داده می‌شود.", "/booking"),
    block("03", "Business hours", "ساعات کاری از Business canonical می‌آید.", "/business"),
  ], { label: "باز کردن Availability", path: "/booking" }),
  "موجودی": blueprint("Inventory Surface", "commerce", "review", [
    block("01", "Stock state", "مقدار موجودی فقط با Inventory canonical قابل نمایش است.", "/catalog"),
    block("02", "Variant availability", "تنوع فعال و موجودی آن در Catalog معنا پیدا می‌کند.", "/catalog"),
    block("03", "Order impact", "رزرو/فروش موجودی در جریان Commerce دیده می‌شود.", "/transactions"),
  ], { label: "بررسی کاتالوگ", path: "/catalog" }),
  "سفارش‌ها": blueprint("Order Surface", "commerce", "command", [
    block("01", "Order queue", "وضعیت سفارش از Commerce/Transactions می‌آید.", "/transactions"),
    block("02", "Fulfillment", "اجرای سفارش از Operations پیگیری می‌شود.", "/operations"),
    block("03", "Customer context", "مشتری مرتبط در Customer domain باقی می‌ماند.", "/customer"),
  ], { label: "باز کردن معاملات", path: "/transactions" }),
  "آشپزخانه": blueprint("Kitchen Surface", "operations", "command", [
    block("01", "Preparation queue", "صف آماده‌سازی جای Operations canonical را نشان می‌دهد.", "/operations"),
    block("02", "Order context", "سفارش مرتبط از Commerce.", "/transactions"),
    block("03", "Handoff", "تحویل به fulfillment با منبع canonical پیگیری می‌شود.", "/operations"),
  ], { label: "باز کردن عملیات", path: "/operations" }),
  "تحویل": blueprint("Delivery Surface", "operations", "command", [
    block("01", "Fulfillment queue", "صف تحویل از Operations.", "/operations"),
    block("02", "Order state", "وضعیت سفارش از Commerce.", "/transactions"),
    block("03", "Customer context", "مقصد/مشتری از Customer در دسترس قرار می‌گیرد.", "/customer"),
  ], { label: "باز کردن Fulfillment", path: "/operations" }),
  "زمان‌بندی": blueprint("Schedule Surface", "calendar", "configure", [
    block("01", "Specialist timeline", "برنامه متخصصان از Availability/Booking تغذیه می‌شود.", "/booking"),
    block("02", "Capacity", "ظرفیت واقعی از backend authoritative می‌آید.", "/booking"),
    block("03", "Business hours", "ساعات پایه از Business.", "/business"),
  ], { label: "باز کردن برنامه", path: "/booking" }),
  "ظرفیت": blueprint("Capacity Surface", "calendar", "review", [
    block("01", "Capacity lanes", "جایگاه نمایش ظرفیت منابع.", "/booking"),
    block("02", "Specialists", "منابع انسانی از Team/Workspace.", "/business?module=تیم"),
    block("03", "Services", "مدت و خدمت از Catalog.", "/catalog"),
  ], { label: "بررسی ظرفیت", path: "/booking" }),
};

const clinic: Record<string, VerticalModuleBlueprint> = {
  "امروز": blueprint("Clinic Today Command", "command", "command", [
    block("01", "صف امروز", "نوبت‌های امروز و کارهای نزدیک باید از Booking خوانده شوند.", "/booking"),
    block("02", "مراجع بعدی", "Context مراجع از Customer/Booking متصل می‌شود.", "/customer"),
    block("03", "پیگیری ارتباطی", "پیام و follow-up از Communication می‌آید.", "/communication"),
  ], { label: "باز کردن نوبت‌ها", path: "/booking" }),
  "نوبت‌ها": blueprint("Clinic Appointments", "calendar", "command", [
    block("01", "Appointment queue", "صف رسمی نوبت‌ها از Booking canonical.", "/booking"),
    block("02", "Service", "خدمت انتخاب‌شده از Catalog.", "/catalog"),
    block("03", "Patient context", "مراجع از Customer boundary.", "/customer"),
  ], { label: "باز کردن Booking", path: "/booking" }),
  "تقویم": blueprint("Clinic Calendar", "calendar", "browse", [
    block("01", "Specialist lanes", "laneهای زمانی بر اساس scheduleهای واقعی."),
    block("02", "Availability", "slotها منبع حقیقت ظرفیت هستند.", "/booking"),
    block("03", "Hours & locations", "ساعت و مکان از Business.", "/business"),
  ], { label: "مشاهده Availability", path: "/booking" }),
  "پزشکان": blueprint("Clinical Team", "people", "browse", [
    block("01", "Team roster", "عضویت و نقش از Team/Workspace.", "/business?module=تیم"),
    block("02", "Service access", "خدمات قابل ارائه از Catalog.", "/catalog"),
    block("03", "Schedule access", "زمان‌بندی در Availability/Booking.", "/booking"),
  ], { label: "مشاهده تیم", path: "/business?module=تیم" }),
  "خدمات": shared["خدمات"]!,
  "مراجعان": blueprint("Patient Relationship", "people", "browse", [
    block("01", "Customer context", "رابط مشتری منبع حقیقت است.", "/customer"),
    block("02", "Appointment context", "سوابق قابل نمایش از Booking می‌آید.", "/booking"),
    block("03", "Communication", "ارتباط با مراجع از Communication.", "/communication"),
  ], { label: "باز کردن مراجعان", path: "/customer" }),
  "ساعات کاری": blueprint("Clinic Hours", "calendar", "configure", [
    block("01", "Business hours", "ساعات پایه از Business.", "/business"),
    block("02", "Availability impact", "اثر ساعات بر slotها در Booking.", "/booking"),
    block("03", "Locations", "مکان‌های عمومی از Business/locations.", "/business/profile"),
  ], { label: "مدیریت Business", path: "/business" }),
  "پیام‌ها": blueprint("Care Communication", "communication", "command", [
    block("01", "Conversation list", "جریان پیام از Communication."),
    block("02", "Patient context", "مراجع مرتبط از Customer.", "/customer"),
    block("03", "Notification handoff", "اعلان‌ها از Notification/Communication.", "/notifications"),
  ], { label: "باز کردن ارتباطات", path: "/communication" }),
  "پرداخت": blueprint("Clinic Payments", "commerce", "review", [
    block("01", "Billing state", "صورتحساب از Billing canonical.", "/billing"),
    block("02", "Transaction context", "معامله از Transactions.", "/transactions"),
    block("03", "Entitlements", "دسترسی‌های مالی از Billing.", "/billing"),
  ], { label: "باز کردن Billing", path: "/billing" }),
  "محتوا": blueprint("Clinic Content", "catalog", "configure", [
    block("01", "Service content", "معرفی خدمت و supply در Catalog.", "/catalog"),
    block("02", "Seller AI", "تولید متن/رسانه پیشنهادی.", "/product-studio"),
    block("03", "Publication", "انتشار تابع Business/Trust policy.", "/business/profile"),
  ], { label: "باز کردن Product Studio", path: "/product-studio" }),
  "تیم": blueprint("Clinic Team & Access", "people", "review", [
    block("01", "Members", "اعضای Workspace از Team.", "/business?module=تیم"),
    block("02", "Roles", "دسترسی از context و permissionهای backend.", "/account"),
    block("03", "Specialist lens", "نقش تخصصی با قابلیت‌ها compose می‌شود.", "/booking"),
  ], { label: "مدیریت تیم", path: "/business?module=تیم" }),
};

const retail: Record<string, VerticalModuleBlueprint> = {
  "فروش امروز": blueprint("Retail Sales Command", "commerce", "command", [
    block("01", "Order queue", "سفارش‌های جاری از Commerce/Transactions.", "/transactions"),
    block("02", "Customer context", "مشتری از Customer.", "/customer"),
    block("03", "Fulfillment handoff", "اجرای سفارش از Operations.", "/operations"),
  ], { label: "باز کردن سفارش‌ها", path: "/transactions" }),
  "محصولات": blueprint("Retail Product Workspace", "catalog", "configure", [
    block("01", "Product", "مدل canonical محصول در Catalog.", "/catalog"),
    block("02", "Listing", "ساخت عرضه از Product Studio.", "/product-studio"),
    block("03", "Publication", "انتشار با Business/Catalog policy.", "/business/profile"),
  ], { label: "باز کردن کاتالوگ", path: "/catalog" }),
  "مدل‌ها و تنوع": blueprint("Retail Variant Workspace", "catalog", "configure", [
    block("01", "Variants", "تنوع محصول بخشی از مدل Catalog است.", "/catalog"),
    block("02", "Attributes", "سایز، رنگ و مشخصات در Attribute model.", "/catalog"),
    block("03", "Offer mapping", "Offering و price از Catalog.", "/catalog"),
  ], { label: "باز کردن Catalog", path: "/catalog" }),
  "سایز و رنگ": blueprint("Retail Attribute Surface", "catalog", "configure", [
    block("01", "Size / Color", "attributeهای استاندارد محصول."),
    block("02", "Variant combination", "ترکیب attributeها در variant canonical.", "/catalog"),
    block("03", "Availability", "قابل‌فروش بودن از Catalog/Inventory.", "/catalog"),
  ], { label: "مدیریت Variant", path: "/catalog" }),
  "موجودی": blueprint("Retail Inventory", "commerce", "review", [
    block("01", "Stock state", "فقط موجودی authoritative نمایش داده می‌شود.", "/catalog"),
    block("02", "Low-stock signal", "وقتی endpoint فعال باشد، این rail هشدار می‌دهد."),
    block("03", "Order impact", "اثر سفارش روی موجودی از Commerce.", "/transactions"),
  ], { label: "مشاهده Catalog", path: "/catalog" }),
  "سفارش‌ها": shared["سفارش‌ها"]!,
  "مرجوعی": blueprint("Retail Returns", "commerce", "review", [
    block("01", "Order context", "مرجوعی از Order canonical شروع می‌شود.", "/transactions"),
    block("02", "Fulfillment case", "اجرای بازگشت در Operations/Case Support.", "/operations"),
    block("03", "Customer relationship", "زمینه مشتری از Customer.", "/customer"),
  ], { label: "باز کردن سفارش‌ها", path: "/transactions" }),
  "مشتریان": shared["مشتریان"]!,
  "تخفیف‌ها": blueprint("Retail Promotions", "commerce", "configure", [
    block("01", "Promotion policy", "قواعد در Promotion domain.", "/promotion"),
    block("02", "Eligibility", "شرایط واجد بودن با همان منبع promotion."),
    block("03", "Catalog context", "محصول/عرضه از Catalog.", "/catalog"),
  ], { label: "باز کردن Promotion", path: "/promotion" }),
  "محتوا": blueprint("Retail Seller AI", "catalog", "configure", [
    block("01", "Raw input", "عکس/متن خام از فروشنده.", "/product-studio"),
    block("02", "AI draft", "عنوان، توضیح و ویژگی‌ها به‌صورت پیشنهادی.", "/product-studio"),
    block("03", "Approval", "پذیرش و انتشار هنوز با فروشنده/Business است.", "/business/profile"),
  ], { label: "باز کردن Product Studio", path: "/product-studio" }),
  "گزارش فروش": blueprint("Retail Reporting", "commerce", "review", [
    block("01", "Orders", "داده اصلی از Commerce.", "/transactions"),
    block("02", "Customers", "Context مشتری از Customer.", "/customer"),
    block("03", "Fulfillment", "اثر عملیات از Operations.", "/operations"),
  ], { label: "مشاهده Transactions", path: "/transactions" }),
};

const restaurant: Record<string, VerticalModuleBlueprint> = {
  "سفارش‌های امروز": blueprint("Restaurant Order Command", "commerce", "command", [
    block("01", "Active orders", "سفارش‌های جاری از Commerce.", "/transactions"),
    block("02", "Kitchen handoff", "اجرای آماده‌سازی از Operations.", "/operations"),
    block("03", "Guest context", "مشتری/مهمان از Customer.", "/customer"),
  ], { label: "باز کردن سفارش‌ها", path: "/transactions" }),
  "منو": blueprint("Restaurant Menu", "catalog", "configure", [
    block("01", "Menu supply", "آیتم‌های منو در Catalog.", "/catalog"),
    block("02", "Pricing", "قیمت authoritative در Catalog/Commerce.", "/catalog"),
    block("03", "Promotion", "مشوق‌ها از Promotion.", "/promotion"),
  ], { label: "باز کردن منو", path: "/catalog" }),
  "میزها": blueprint("Restaurant Tables", "operations", "configure", [
    block("01", "Business location", "مکان و فضای کسب‌وکار از Business.", "/business"),
    block("02", "Reservation capacity", "ظرفیت میز در Booking/Availability.", "/booking"),
    block("03", "Order context", "سفارش پس از رزرو در Commerce.", "/transactions"),
  ], { label: "باز کردن رزرو", path: "/booking" }),
  "رزرو": blueprint("Restaurant Reservations", "calendar", "command", [
    block("01", "Availability", "slotها از Booking.", "/booking"),
    block("02", "Guest context", "مهمان از Customer.", "/customer"),
    block("03", "Table capacity", "ظرفیت باید از source واقعی تغذیه شود."),
  ], { label: "باز کردن Booking", path: "/booking" }),
  "آشپزخانه": shared["آشپزخانه"]!,
  "تحویل": shared["تحویل"]!,
  "مشتریان": shared["مشتریان"]!,
  "تخفیف": blueprint("Restaurant Promotions", "commerce", "configure", [
    block("01", "Promotion policy", "Promotion domain مالک eligibility است.", "/promotion"),
    block("02", "Menu context", "عرضه غذا از Catalog.", "/catalog"),
    block("03", "Order impact", "اثر مشوق در Commerce.", "/transactions"),
  ], { label: "باز کردن Promotion", path: "/promotion" }),
  "پرداخت": blueprint("Restaurant Payments", "commerce", "review", [
    block("01", "Billing", "داده مالی از Billing.", "/billing"),
    block("02", "Transactions", "سفارش/پرداخت از Commerce.", "/transactions"),
    block("03", "Fulfillment", "تحویل پس از پرداخت از Operations.", "/operations"),
  ], { label: "باز کردن Billing", path: "/billing" }),
  "گزارش": blueprint("Restaurant Reporting", "operations", "review", [
    block("01", "Orders", "داده سفارش از Commerce.", "/transactions"),
    block("02", "Reservations", "رزرو از Booking.", "/booking"),
    block("03", "Fulfillment", "عملیات از Operations.", "/operations"),
  ], { label: "مشاهده Transactions", path: "/transactions" }),
};

const salon: Record<string, VerticalModuleBlueprint> = {
  "وقت‌های امروز": blueprint("Salon Today Command", "command", "command", [
    block("01", "Appointments", "وقت‌های امروز از Booking.", "/booking"),
    block("02", "Specialists", "منابع انسانی از Team.", "/business?module=تیم"),
    block("03", "Customers", "مشتریان از Customer.", "/customer"),
  ], { label: "باز کردن نوبت‌ها", path: "/booking" }),
  "خدمات": shared["خدمات"]!,
  "متخصصان": shared["متخصصان"]!,
  "تقویم": blueprint("Salon Calendar", "calendar", "browse", [
    block("01", "Specialist lanes", "برنامه متخصصان بر پایه scheduleهای واقعی.", "/booking"),
    block("02", "Availability", "slotها از Booking.", "/booking"),
    block("03", "Business hours", "ساعات از Business.", "/business"),
  ], { label: "باز کردن Booking", path: "/booking" }),
  "مشتریان": shared["مشتریان"]!,
  "ظرفیت": blueprint("Salon Capacity", "calendar", "review", [
    block("01", "Capacity", "ظرفیت متخصص/خدمت باید از Availability بیاید.", "/booking"),
    block("02", "Services", "مدت خدمت از Catalog.", "/catalog"),
    block("03", "Team", "منابع انسانی از Workspace.", "/business?module=تیم"),
  ], { label: "مشاهده Availability", path: "/booking" }),
  "پرداخت": blueprint("Salon Payments", "commerce", "review", [
    block("01", "Billing", "صورتحساب از Billing.", "/billing"),
    block("02", "Transactions", "خرید/خدمت در Commerce.", "/transactions"),
    block("03", "Customer", "زمینه مشتری از Customer.", "/customer"),
  ], { label: "باز کردن Billing", path: "/billing" }),
  "پیشنهادها": blueprint("Salon Promotions", "commerce", "configure", [
    block("01", "Promotion policy", "قواعد promotion در دامنه Promotion.", "/promotion"),
    block("02", "Service context", "خدمت از Catalog.", "/catalog"),
    block("03", "Transaction impact", "اثر promotion در Commerce.", "/transactions"),
  ], { label: "باز کردن Promotion", path: "/promotion" }),
  "محتوا": blueprint("Salon Content", "catalog", "configure", [
    block("01", "Service showcase", "معرفی خدمت در Catalog.", "/catalog"),
    block("02", "Seller AI", "ساخت محتوای پیشنهادی.", "/product-studio"),
    block("03", "Publication", "انتشار تابع Business/Trust policy.", "/business/profile"),
  ], { label: "باز کردن Product Studio", path: "/product-studio" }),
  "تیم": blueprint("Salon Team & Access", "people", "review", [
    block("01", "Members", "اعضای Workspace.", "/business?module=تیم"),
    block("02", "Roles", "Permissionهای واقعی از backend.", "/account"),
    block("03", "Schedule access", "برنامه متخصص در Booking.", "/booking"),
  ], { label: "مشاهده تیم", path: "/business?module=تیم" }),
};

const verticalSpecific: Record<string, Record<string, VerticalModuleBlueprint>> = {
  clinic,
  retail,
  restaurant,
  salon,
};

const ROLE_LENS_BY_MODULE: Record<string, readonly VerticalRoleLensKey[]> = {
  "وقت‌های امروز": ["management", "sales", "specialist"],
  "خدمات": ["sales", "specialist"],
  "محصولات": ["sales"],
  "پزشکان": ["specialist", "management"],
  "متخصصان": ["specialist", "management"],
  "مراجعان": ["specialist", "sales"],
  "مشتریان": ["sales", "specialist"],
  "نوبت‌ها": ["specialist"],
  "تقویم": ["specialist", "management"],
  "ساعات کاری": ["management"],
  "زمان‌بندی": ["specialist", "management"],
  "ظرفیت": ["specialist", "management"],
  "پرداخت": ["finance", "management"],
  "محتوا": ["sales", "management"],
  "تیم": ["management"],
  "مدل‌ها و تنوع": ["sales"],
  "سایز و رنگ": ["sales"],
  "موجودی": ["sales", "management"],
  "سفارش‌ها": ["sales", "finance", "management"],
  "مرجوعی": ["sales", "finance"],
  "تخفیف‌ها": ["sales", "management"],
  "گزارش فروش": ["sales", "finance", "management"],
  "سفارش‌های امروز": ["sales", "management"],
  "منو": ["sales", "management"],
  "میزها": ["sales", "management"],
  "رزروها": ["sales", "management"],
  "آشپزخانه": ["sales", "management"],
  "تحویل": ["sales", "management"],
  "گزارش": ["management", "finance"],
  "ساعت کاری": ["management"],
  "پیشنهادها": ["sales", "management"],
};

export function getVerticalModuleCapabilityContract(module: string): VerticalModuleCapabilityContract {
  return MODULE_CAPABILITY_CONTRACTS[module] ?? {
    requiredCapabilities: [],
    requiredPermissions: [],
    source: "runtime-registry-contract",
  };
}

function deriveRoleLenses(module: string, layout: VerticalModuleLayout): readonly VerticalRoleLensKey[] {
  const explicit = ROLE_LENS_BY_MODULE[module];
  if (explicit) return explicit;
  if (layout === "calendar") return ["specialist", "management"];
  if (layout === "catalog") return ["sales", "specialist"];
  if (layout === "commerce") return ["sales", "finance", "management"];
  if (layout === "people") return ["sales", "specialist", "management"];
  if (layout === "operations") return ["sales", "management"];
  if (layout === "communication") return ["sales", "specialist"];
  return ["generic"];
}


/**
 * Stable semantic route slugs for Workspace modules.
 * Localized labels remain presentation-only; route identity must not change with copy/locale.
 */
export const VERTICAL_MODULE_SLUGS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  default: { "نمای کلی": "overview", "پروفایل": "profile", "محتوا": "content", "محصولات": "products", "خدمات": "services", "مشتریان": "customers", "پیام‌ها": "messages", "معاملات": "transactions", "تیم": "team", "گزارش‌ها": "reports" },
  clinic: { "امروز": "today", "نوبت‌ها": "appointments", "تقویم": "calendar", "پزشکان": "providers", "خدمات": "services", "مراجعان": "patients", "ساعات کاری": "hours", "پیام‌ها": "messages", "پرداخت": "payments", "محتوا": "content", "تیم": "team" },
  retail: { "فروش امروز": "sales", "محصولات": "products", "مدل‌ها و تنوع": "variants", "سایز و رنگ": "attributes", "موجودی": "inventory", "سفارش‌ها": "orders", "مرجوعی": "returns", "مشتریان": "customers", "تخفیف‌ها": "promotions", "محتوا": "content", "گزارش فروش": "reports" },
  restaurant: { "سفارش‌های امروز": "orders", "منو": "menu", "میزها": "tables", "رزرو": "reservations", "آشپزخانه": "kitchen", "تحویل": "delivery", "مشتریان": "customers", "تخفیف": "promotions", "پرداخت": "payments", "گزارش": "reports" },
  salon: { "وقت‌های امروز": "today", "خدمات": "services", "متخصصان": "specialists", "تقویم": "calendar", "مشتریان": "customers", "ظرفیت": "capacity", "پرداخت": "payments", "پیشنهادها": "promotions", "محتوا": "content", "تیم": "team" },
};

export const VERTICAL_MODULE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  profile: ["پروفایل"],
  products: ["محصولات"],
  product: ["محصولات"],
  services: ["خدمات"],
  service: ["خدمات"],
  customers: ["مشتریان", "مراجعان"],
  patients: ["مراجعان"],
  clients: ["مشتریان", "مراجعان"],
  team: ["تیم"],
  messages: ["پیام‌ها"],
  communications: ["پیام‌ها"],
  transactions: ["معاملات"],
  orders: ["سفارش‌ها", "سفارش‌های امروز"],
  returns: ["مرجوعی"],
  inventory: ["موجودی"],
  variants: ["مدل‌ها و تنوع"],
  attributes: ["سایز و رنگ"],
  promotions: ["تخفیف‌ها", "تخفیف", "پیشنهادها"],
  reports: ["گزارش فروش", "گزارش‌ها", "گزارش"],
  calendar: ["تقویم"],
  bookings: ["نوبت‌ها", "رزرو", "وقت‌های امروز"],
  appointments: ["نوبت‌ها"],
  reservations: ["رزرو"],
  today: ["امروز", "فروش امروز", "سفارش‌های امروز", "وقت‌های امروز"],
  providers: ["پزشکان"],
  specialists: ["متخصصان"],
  hours: ["ساعات کاری"],
  payments: ["پرداخت"],
  menu: ["منو"],
  tables: ["میزها"],
  kitchen: ["آشپزخانه"],
  delivery: ["تحویل"],
};

export function resolveVerticalModuleAlias(vertical: string, alias: string): string | null {
  const normalized = alias.trim().toLowerCase();
  const modules = Object.keys(VERTICAL_MODULE_SLUGS[vertical.trim().toLowerCase()] ?? {});
  if (!modules.length) return null;
  const candidates = VERTICAL_MODULE_ALIASES[normalized];
  if (!candidates) return null;
  return candidates.find((module) => modules.includes(module)) ?? null;
}

export function getVerticalModuleSlug(vertical: string, module: string): string {
  const key = vertical.trim().toLowerCase();
  return VERTICAL_MODULE_SLUGS[key]?.[module] ?? module;
}

export function getVerticalModuleForSlug(vertical: string, slug: string, modules: readonly string[]): string | null {
  const normalizedSlug = slug.trim().toLowerCase();
  return modules.find((module) => getVerticalModuleSlug(vertical, module).toLowerCase() === normalizedSlug) ?? null;
}

export function getVerticalModuleRoute(vertical: string, module: string): string {
  const key = vertical.trim().toLowerCase();
  return "/business/workspace/" + encodeURIComponent(key) + "/" + encodeURIComponent(getVerticalModuleSlug(key, module));
}

export function resolveVerticalRoleLens(roles: readonly string[]): { key: VerticalRoleLensKey; title: string; description: string } {
  const normalized = roles.map((role) => role.toLowerCase());
  if (normalized.some((role) => /owner|admin|manager/.test(role))) {
    return { key: "management", title: "مدیریت Workspace", description: "نمای کلی، تیم، مالی، گزارش و تنظیمات در اولویت این نقش قرار می‌گیرند." };
  }
  if (normalized.some((role) => /sales|seller/.test(role))) {
    return { key: "sales", title: "عملیات فروش", description: "مشتریان، عرضه، پیام‌ها و معاملات در اولویت این نقش قرار می‌گیرند." };
  }
  if (normalized.some((role) => /doctor|specialist|provider/.test(role))) {
    return { key: "specialist", title: "عملیات تخصصی", description: "خدمات، برنامه، رزرو و زمینه تخصصی در اولویت این نقش قرار می‌گیرند." };
  }
  if (normalized.some((role) => /finance|account/.test(role))) {
    return { key: "finance", title: "عملیات مالی", description: "پرداخت‌ها، تراکنش‌ها و گزارش‌های مالی در اولویت این نقش قرار می‌گیرند." };
  }
  return { key: "generic", title: "Workspace عمومی", description: "ماژول‌ها بر اساس Business Type و Capabilityهای فعال ترکیب می‌شوند." };
}

export function getVerticalModuleRoleFit(
  blueprint: VerticalModuleBlueprint,
  roleKey: VerticalRoleLensKey,
): "primary" | "shared" {
  const lenses = blueprint.roleLenses ?? ["generic"];
  return lenses.includes(roleKey) || roleKey === "generic" ? "primary" : "shared";
}

export type VerticalModuleUiContract = {
  readonly vertical: string;
  readonly module: string;
  readonly slug: string;
  readonly route: string;
  readonly blueprint: VerticalModuleBlueprint;
  readonly capabilityContract: VerticalModuleCapabilityContract;
  readonly roleLenses: readonly VerticalRoleLensKey[];
};

const verticalModuleBlueprintCache = new Map<string, VerticalModuleBlueprint>();

export function getVerticalModuleBlueprint(vertical: string, module: string): VerticalModuleBlueprint {
  const v = vertical.trim().toLowerCase();
  const cacheKey = v + "::" + module;
  const cached = verticalModuleBlueprintCache.get(cacheKey);
  if (cached) return cached;
  const selected =
    verticalSpecific[v]?.[module] ??
    shared[module] ??
    blueprint(
      "Capability Surface",
      "command",
      "browse",
      [
        block("01", "Canonical source", "منبع حقیقت این Capability از backend domain اصلی می‌آید."),
        block("02", "Workspace context", "این سطح فقط context شغلی را نگه می‌دارد."),
        block("03", "Next action", "اقدام اجرایی باید از command/API canonical عبور کند."),
      ],
    );
  const declaredContract = getVerticalModuleCapabilityContract(module);
  const canonicalTermKeys = selected.canonicalTermKeys.length
    ? selected.canonicalTermKeys
    : MODULE_CANONICAL_TERM_KEYS[module] ?? [];
  if (!canonicalTermKeys.length && module !== "ماژول ناشناخته") {
    // Keep unknown/custom UI modules explicitly traceable instead of inventing
    // a second domain concept. The generic blueprint remains source-neutral.
  }
  const selectedContract = selected.capabilityContract;
  const hasDeclaredSelectedContract = Boolean(
    selectedContract &&
    (selectedContract.requiredCapabilities.length > 0 || selectedContract.requiredPermissions.length > 0),
  );
  const resolved: VerticalModuleBlueprint = {
    ...selected,
    canonicalTermKeys,
    roleLenses: selected.roleLenses ?? deriveRoleLenses(module, selected.layout),
    capabilityContract: hasDeclaredSelectedContract ? selectedContract! : declaredContract,
  };
  verticalModuleBlueprintCache.set(cacheKey, resolved);
  return resolved;
}

export function getVerticalModuleUiContract(vertical: string, module: string): VerticalModuleUiContract {
  const normalizedVertical = vertical.trim().toLowerCase();
  const blueprint = getVerticalModuleBlueprint(normalizedVertical, module);
  const capabilityContract = blueprint.capabilityContract;
  const roleLenses = blueprint.roleLenses ?? deriveRoleLenses(module, blueprint.layout);
  const slug = getVerticalModuleSlug(normalizedVertical, module);
  const route = getVerticalModuleRoute(normalizedVertical, module);
  return {
    vertical: normalizedVertical,
    module,
    slug,
    route,
    blueprint,
    capabilityContract,
    roleLenses,
  };
}


export type VerticalUiRegistryAudit = {
  readonly vertical: string;
  readonly moduleCount: number;
  readonly modules: readonly string[];
  readonly missingBlueprints: readonly string[];
  readonly missingSlugs: readonly string[];
  readonly missingCapabilityContracts: readonly string[];
  readonly missingCanonicalTerms: readonly string[];
  readonly ready: boolean;
};

/**
 * Structural audit for the Vertical Workflow UI Framework.
 *
 * This is intentionally a registry-consistency check, not an authorization
 * check. It makes it possible for tests/build tooling to detect when a
 * vertical adds a module but forgets its shared UI contract pieces.
 */
export function auditVerticalUiRegistry(
  verticals: Readonly<Record<string, { readonly modules: readonly string[] }>>,
): readonly VerticalUiRegistryAudit[] {
  return Object.entries(verticals).map(([vertical, definition]) => {
    const missingBlueprints: string[] = [];
    const missingSlugs: string[] = [];
    const missingCapabilityContracts: string[] = [];
    const missingCanonicalTerms: string[] = [];

    for (const module of definition.modules) {
      const blueprint = getVerticalModuleBlueprint(vertical, module);
      if (!blueprint.blocks.length) missingBlueprints.push(module);

      const slug = getVerticalModuleSlug(vertical, module);
      if (!slug || slug === module) missingSlugs.push(module);

      const capability = getVerticalModuleCapabilityContract(module);
      if (!capability.requiredCapabilities.length && !capability.requiredPermissions.length) {
        missingCapabilityContracts.push(module);
      }

      const canonicalTerms = blueprint.canonicalTermKeys.length
        ? blueprint.canonicalTermKeys
        : MODULE_CANONICAL_TERM_KEYS[module] ?? [];
      if (!canonicalTerms.length) missingCanonicalTerms.push(module);
    }

    return {
      vertical,
      moduleCount: definition.modules.length,
      modules: definition.modules,
      missingBlueprints,
      missingSlugs,
      missingCapabilityContracts,
      missingCanonicalTerms,
      ready:
        missingBlueprints.length === 0 &&
        missingSlugs.length === 0 &&
        missingCapabilityContracts.length === 0 &&
        missingCanonicalTerms.length === 0,
    };
  });
}
