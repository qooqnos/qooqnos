export type VerticalWorkflowDefinition = {
  readonly vertical: string;
  readonly steps: readonly string[];
  readonly stageModules: Readonly<Record<string, string>>;
};

export const VERTICAL_WORKFLOW_UI: Readonly<Record<string, VerticalWorkflowDefinition>> = {
  default: {
    vertical: "default",
    steps: ["Supply", "Discovery", "Connect", "Act"],
    stageModules: {},
  },
  clinic: {
    vertical: "clinic",
    steps: ["خدمت", "زمان‌بندی", "رزرو", "پیگیری"],
    stageModules: {
      "خدمت": "خدمات",
      "زمان‌بندی": "تقویم",
      "رزرو": "نوبت‌ها",
      "پیگیری": "پیام‌ها",
    },
  },
  retail: {
    vertical: "retail",
    steps: ["محصول", "انتشار", "موجودی", "سفارش"],
    stageModules: {
      "محصول": "محصولات",
      "انتشار": "محتوا",
      "موجودی": "موجودی",
      "سفارش": "سفارش‌ها",
    },
  },
  restaurant: {
    vertical: "restaurant",
    steps: ["منو", "میز / رزرو", "سفارش", "تحویل"],
    stageModules: {
      "منو": "منو",
      "میز / رزرو": "رزرو",
      "سفارش": "سفارش‌های امروز",
      "تحویل": "تحویل",
    },
  },
  salon: {
    vertical: "salon",
    steps: ["خدمت", "متخصص", "زمان‌بندی", "رزرو"],
    stageModules: {
      "خدمت": "خدمات",
      "متخصص": "متخصصان",
      "زمان‌بندی": "تقویم",
      "رزرو": "وقت‌های امروز",
    },
  },
};

export function getVerticalWorkflowDefinition(vertical: string): VerticalWorkflowDefinition {
  return VERTICAL_WORKFLOW_UI[vertical] ?? VERTICAL_WORKFLOW_UI.default!;
}

export function getVerticalWorkflowSteps(vertical: string): readonly string[] {
  return getVerticalWorkflowDefinition(vertical).steps;
}

export function getVerticalWorkflowStageModule(vertical: string, stage: string): string | undefined {
  return getVerticalWorkflowDefinition(vertical).stageModules[stage];
}

export type VerticalWorkflowStageDefinition = {
  readonly stage: string;
  readonly module: string;
  readonly input: string;
  readonly action: string;
  readonly output: string;
};

const VERTICAL_WORKFLOW_STAGE_DEFINITIONS: Readonly<Record<string, readonly VerticalWorkflowStageDefinition[]>> = {
  clinic: [
    { stage: "خدمت", module: "خدمات", input: "نیاز یا تعریف خدمت", action: "ساخت و آماده‌سازی عرضه خدمت", output: "Service قابل انتشار و رزرو" },
    { stage: "زمان‌بندی", module: "تقویم", input: "خدمت + منابع + ساعات کاری", action: "اتصال Schedule و Availability", output: "Slot قابل انتخاب" },
    { stage: "رزرو", module: "نوبت‌ها", input: "Slot + Customer", action: "Hold و تأیید رزرو", output: "Booking canonical" },
    { stage: "پیگیری", module: "پیام‌ها", input: "Booking + Customer context", action: "ارتباط و follow-up", output: "تعامل ثبت‌شده" },
  ],
  retail: [
    { stage: "محصول", module: "محصولات", input: "ورودی خام محصول", action: "ساخت Product / Offering", output: "عرضه ساختاریافته" },
    { stage: "انتشار", module: "محتوا", input: "عرضه + محتوای Seller AI", action: "بازبینی و آماده‌سازی انتشار", output: "Supply قابل کشف" },
    { stage: "موجودی", module: "موجودی", input: "Variant + stock source", action: "بررسی وضعیت موجودی", output: "قابل فروش بودن" },
    { stage: "سفارش", module: "سفارش‌ها", input: "Customer + Offering", action: "Checkout و Order", output: "Transaction / Fulfillment" },
  ],
  restaurant: [
    { stage: "منو", module: "منو", input: "آیتم‌های غذایی", action: "ساخت و انتشار Menu supply", output: "عرضه قابل سفارش" },
    { stage: "میز / رزرو", module: "رزرو", input: "Customer + ظرفیت", action: "Availability و Reservation", output: "Booking / reservation context" },
    { stage: "سفارش", module: "سفارش‌های امروز", input: "Menu + Customer", action: "ایجاد و پیگیری Order", output: "Order canonical" },
    { stage: "تحویل", module: "تحویل", input: "Order", action: "Fulfillment / Delivery handoff", output: "تحویل یا وضعیت نهایی" },
  ],
  salon: [
    { stage: "خدمت", module: "خدمات", input: "درخواست مشتری / service idea", action: "ساخت عرضه خدمت", output: "Service قابل رزرو" },
    { stage: "متخصص", module: "متخصصان", input: "Service + Team", action: "تعیین نقش و دسترسی متخصص", output: "Provider context" },
    { stage: "زمان‌بندی", module: "تقویم", input: "Provider + Service + Hours", action: "Schedule / Availability", output: "Slot قابل انتخاب" },
    { stage: "رزرو", module: "وقت‌های امروز", input: "Slot + Customer", action: "Booking", output: "Appointment canonical" },
  ],
};

export function getVerticalWorkflowStageDefinitions(vertical: string): readonly VerticalWorkflowStageDefinition[] {
  return VERTICAL_WORKFLOW_STAGE_DEFINITIONS[vertical.trim().toLowerCase()] ?? [];
}

export function getVerticalWorkflowStageDefinition(
  vertical: string,
  module: string,
): VerticalWorkflowStageDefinition | undefined {
  return getVerticalWorkflowStageDefinitions(vertical).find((item) => item.module === module);
}

export type VerticalWorkflowStageContext = {
  readonly vertical: string;
  readonly index: number;
  readonly total: number;
  readonly stage: string;
  readonly module: string;
  readonly previous?: { readonly stage: string; readonly module: string };
  readonly next?: { readonly stage: string; readonly module: string };
};

export function getVerticalWorkflowStageContext(vertical: string, module: string): VerticalWorkflowStageContext {
  const definition = getVerticalWorkflowDefinition(vertical);
  const entries = definition.steps.map((stage) => ({
    stage,
    module: definition.stageModules[stage] ?? stage,
  }));
  const index = entries.findIndex((entry) => entry.module === module);
  if (index < 0) {
    return {
      vertical: definition.vertical,
      index: -1,
      total: entries.length,
      stage: module,
      module,
    };
  }
  const current = entries[index]!;
  const previous = entries[index - 1];
  const next = entries[index + 1];
  return {
    vertical: definition.vertical,
    index,
    total: entries.length,
    stage: current.stage,
    module: current.module,
    ...(previous ? { previous } : {}),
    ...(next ? { next } : {}),
  };
}

