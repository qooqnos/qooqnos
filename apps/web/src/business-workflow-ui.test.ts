import { describe, expect, it } from "vitest";
import {
  getVerticalWorkflowDefinition,
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

  it("fails closed for unsupported vertical stages", () => {
    expect(getVerticalWorkflowStageModule("clinic", "مرحله ناشناخته")).toBeUndefined();
    expect(getVerticalWorkflowSteps("unknown")).toEqual(["Supply", "Discovery", "Connect", "Act"]);
  });
});
