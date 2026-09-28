import { describe, expect, it } from "vitest";
import {
  getVerticalWorkflowDefinition,
  getVerticalWorkflowStageContext,
  getVerticalWorkflowStageModule,
  getVerticalWorkflowSteps,
} from "./business-workflow-ui";

describe("shared vertical workflow registry", () => {
  it("defines a complete workflow for every supported vertical", () => {
    for (const vertical of ["clinic", "retail", "restaurant", "salon"]) {
      const definition = getVerticalWorkflowDefinition(vertical);
      expect(definition.vertical).toBe(vertical);
      expect(definition.steps).toHaveLength(4);
      expect(Object.keys(definition.stageModules)).toHaveLength(4);
      expect(getVerticalWorkflowSteps(vertical)).toEqual(definition.steps);
    }
  });

  it("maps every workflow stage to a visible workspace module", () => {
    expect(getVerticalWorkflowStageModule("clinic", "رزرو")).toBe("نوبت‌ها");
    expect(getVerticalWorkflowStageModule("retail", "موجودی")).toBe("موجودی");
    expect(getVerticalWorkflowStageModule("restaurant", "تحویل")).toBe("تحویل");
    expect(getVerticalWorkflowStageModule("salon", "رزرو")).toBe("وقت‌های امروز");
  });

  it("exposes previous/current/next stage context for deep module navigation", () => {
    const context = getVerticalWorkflowStageContext("clinic", "نوبت‌ها");
    expect(context.index).toBe(2);
    expect(context.total).toBe(4);
    expect(context.stage).toBe("رزرو");
    expect(context.module).toBe("نوبت‌ها");
    expect(context.previous).toEqual({ stage: "زمان‌بندی", module: "تقویم" });
    expect(context.next).toEqual({ stage: "پیگیری", module: "پیام‌ها" });

    const first = getVerticalWorkflowStageContext("retail", "محصولات");
    expect(first.previous).toBeUndefined();
    expect(first.next).toEqual({ stage: "انتشار", module: "محتوا" });

    const last = getVerticalWorkflowStageContext("salon", "وقت‌های امروز");
    expect(last.index).toBe(3);
    expect(last.next).toBeUndefined();
  });

  it("fails closed for modules outside the workflow registry", () => {
    const context = getVerticalWorkflowStageContext("clinic", "ماژول ناشناخته");
    expect(context.index).toBe(-1);
    expect(context.stage).toBe("ماژول ناشناخته");
    expect(context.previous).toBeUndefined();
    expect(context.next).toBeUndefined();
  });

  it("fails closed for unsupported vertical stages", () => {
    expect(getVerticalWorkflowStageModule("clinic", "مرحله ناشناخته")).toBeUndefined();
    expect(getVerticalWorkflowSteps("unknown")).toEqual(["Supply", "Discovery", "Connect", "Act"]);
  });
});
