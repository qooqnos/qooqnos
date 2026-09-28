import { describe, expect, it } from "vitest";
import {
  getVerticalModuleBlueprint,
  getVerticalModuleRoleFit,
  resolveVerticalRoleLens,
} from "./business-module-ui";

const verticalModules: Record<string, string[]> = {
  clinic: ["امروز", "نوبت‌ها", "پزشکان", "مراجعان", "پرداخت"],
  retail: ["محصولات", "مدل‌ها و تنوع", "موجودی", "سفارش‌ها", "مرجوعی"],
  restaurant: ["منو", "میزها", "رزروها", "آشپزخانه", "تحویل"],
  salon: ["خدمات", "متخصصان", "تقویم", "ظرفیت", "پیشنهادها"],
};

describe("Vertical Workflow UI module blueprints", () => {
  it("resolves every supported vertical/module pair to a complete shared blueprint", () => {
    for (const [vertical, modules] of Object.entries(verticalModules)) {
      for (const module of modules) {
        const blueprint = getVerticalModuleBlueprint(vertical, module);
        expect(blueprint.eyebrow).toBeTruthy();
        expect(blueprint.layout).toBeTruthy();
        expect(blueprint.interaction).toBeTruthy();
        expect(blueprint.blocks).toHaveLength(3);
        expect(blueprint.states).toHaveLength(4);
        expect(blueprint.roleLenses?.length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps unsupported UI modules descriptive instead of inventing domain structure", () => {
    const blueprint = getVerticalModuleBlueprint("clinic", "ماژول ناشناخته");
    expect(blueprint.layout).toBe("command");
    expect(blueprint.blocks.map((item) => item.title)).toEqual([
      "Canonical source",
      "Workspace context",
      "Next action",
    ]);
    expect(blueprint.primaryAction).toBeUndefined();
  });

  it("derives role lenses without turning UI emphasis into authorization", () => {
    expect(resolveVerticalRoleLens(["owner"]).key).toBe("management");
    expect(resolveVerticalRoleLens(["sales"]).key).toBe("sales");
    expect(resolveVerticalRoleLens(["doctor"]).key).toBe("specialist");
    expect(resolveVerticalRoleLens(["finance"]).key).toBe("finance");
    expect(resolveVerticalRoleLens([]).key).toBe("generic");

    const blueprint = getVerticalModuleBlueprint("clinic", "نوبت‌ها");
    expect(getVerticalModuleRoleFit(blueprint, "specialist")).toBe("primary");
    expect(getVerticalModuleRoleFit(blueprint, "finance")).toBe("shared");
  });
});
