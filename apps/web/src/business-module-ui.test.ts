import { describe, expect, it } from "vitest";
import {
  getVerticalModuleBlueprint,
  getVerticalModuleForSlug,
  getVerticalModuleRoleFit,
  getVerticalModuleRoute,
  getVerticalModuleSlug,
  resolveVerticalRoleLens,
} from "./business-module-ui";

const verticalModules: Record<string, string[]> = {
  clinic: ["امروز", "نوبت‌ها", "تقویم", "پزشکان", "خدمات", "مراجعان", "ساعات کاری", "پیام‌ها", "پرداخت", "محتوا", "تیم"],
  retail: ["فروش امروز", "محصولات", "مدل‌ها و تنوع", "سایز و رنگ", "موجودی", "سفارش‌ها", "مرجوعی", "مشتریان", "تخفیف‌ها", "محتوا", "گزارش فروش"],
  restaurant: ["سفارش‌های امروز", "منو", "میزها", "رزرو", "آشپزخانه", "تحویل", "مشتریان", "تخفیف", "پرداخت", "گزارش"],
  salon: ["وقت‌های امروز", "خدمات", "متخصصان", "تقویم", "مشتریان", "ظرفیت", "پرداخت", "پیشنهادها", "محتوا", "تیم"],
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

  it("keeps every supported vertical module on a unique semantic route slug", () => {
    for (const [vertical, modules] of Object.entries(verticalModules)) {
      const slugs = modules.map((module) => getVerticalModuleSlug(vertical, module));
      expect(new Set(slugs).size).toBe(slugs.length);
      for (const module of modules) {
        const slug = getVerticalModuleSlug(vertical, module);
        expect(getVerticalModuleForSlug(vertical, slug, modules)).toBe(module);
        expect(getVerticalModuleRoute(vertical, module)).toBe("/business/workspace/" + vertical + "/" + slug);
      }
    }
  });

  it("applies declared capability contracts to supported modules", () => {
    const clinic = getVerticalModuleBlueprint("clinic", "نوبت‌ها");
    const retail = getVerticalModuleBlueprint("retail", "موجودی");
    const restaurant = getVerticalModuleBlueprint("restaurant", "آشپزخانه");
    const salon = getVerticalModuleBlueprint("salon", "خدمات");

    expect(clinic.capabilityContract.requiredCapabilities).toEqual(["booking"]);
    expect(clinic.capabilityContract.requiredPermissions).toEqual(["booking.read", "booking.manage"]);
    expect(retail.capabilityContract.requiredCapabilities).toEqual(["catalog", "commerce"]);
    expect(retail.capabilityContract.requiredPermissions).toEqual(["catalog.offer.update"]);
    expect(restaurant.capabilityContract.requiredCapabilities).toEqual(["commerce", "operations"]);
    expect(salon.capabilityContract.requiredCapabilities).toEqual(["catalog", "booking"]);
  });

  it("keeps the salon today module aligned with the canonical Workspace label", () => {
    const blueprint = getVerticalModuleBlueprint("salon", "وقت‌های امروز");
    expect(blueprint.layout).toBe("command");
    expect(blueprint.primaryAction?.path).toBe("/booking");
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
  it("keeps semantic module identity stable across localized labels", () => {
    expect(getVerticalModuleSlug("clinic", "نوبت‌ها")).toBe("appointments");
    expect(getVerticalModuleSlug("retail", "سایز و رنگ")).toBe("attributes");
    expect(getVerticalModuleRoute("restaurant", "آشپزخانه")).toBe("/business/workspace/restaurant/kitchen");
    expect(getVerticalModuleForSlug("salon", "specialists", (verticalModules.salon ?? []))).toBe("متخصصان");
    expect(getVerticalModuleForSlug("salon", "نامعتبر", (verticalModules.salon ?? []))).toBeNull();
  });

});
