import { describe, expect, it } from "vitest";
import {
  BUSINESS_VERTICAL_UI,
  getBusinessVerticalUi,
  resolveBusinessVerticalKey,
} from "./business-vertical-ui";
import {
  VERTICAL_MODULE_SLUGS,
  getVerticalModuleBlueprint,
} from "./business-module-ui";
import {
  getVerticalWorkflowDefinition,
  getVerticalWorkflowStageModule,
} from "./business-workflow-ui";

describe("Business Vertical UI registry", () => {
  const verticals = ["clinic", "retail", "restaurant", "salon"] as const;

  it("keeps a single complete presentation registry for every supported vertical", () => {
    for (const vertical of verticals) {
      const ui = BUSINESS_VERTICAL_UI[vertical];
      expect(ui.key).toBe(vertical);
      expect(ui.modules.length).toBeGreaterThanOrEqual(8);
      expect(new Set(ui.modules).size).toBe(ui.modules.length);
      expect(ui.actions.length).toBeGreaterThan(0);
      expect(ui.metrics.length).toBeGreaterThan(0);
      expect(ui.customerActions.length).toBeGreaterThan(0);
    }
  });

  it("keeps semantic routes complete for every registered module", () => {
    for (const vertical of verticals) {
      const ui = BUSINESS_VERTICAL_UI[vertical];
      const slugs = VERTICAL_MODULE_SLUGS[vertical] ?? {};
      expect(Object.keys(slugs).sort()).toEqual([...ui.modules].sort());
    }
  });

  it("declares capability contracts for every vertical module", () => {
    for (const vertical of verticals) {
      for (const module of BUSINESS_VERTICAL_UI[vertical].modules) {
        const contract = getVerticalModuleCapabilityContract(module);
        expect(contract.source).toBe("runtime-registry-contract");
        expect(contract.requiredCapabilities.length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps workflow stages mapped to modules in the same vertical registry", () => {
    for (const vertical of verticals) {
      const definition = getVerticalWorkflowDefinition(vertical);
      for (const stage of definition.steps) {
        const module = getVerticalWorkflowStageModule(vertical, stage);
        expect(module).toBeTruthy();
        expect(BUSINESS_VERTICAL_UI[vertical].modules).toContain(module);
        expect(getVerticalModuleBlueprint(vertical, module!).blocks.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("normalizes common business labels without changing the canonical key", () => {
    expect(resolveBusinessVerticalKey("پزشک")).toBe("clinic");
    expect(resolveBusinessVerticalKey("shoe store")).toBe("retail");
    expect(resolveBusinessVerticalKey("کافه")).toBe("restaurant");
    expect(resolveBusinessVerticalKey("beauty salon")).toBe("salon");
    expect(getBusinessVerticalUi("unknown").key).toBe("default");
  });
});
