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
