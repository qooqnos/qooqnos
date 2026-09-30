import { describe, expect, it } from "vitest";
import {
  getVerticalModuleBlueprint,
  getVerticalModuleUiContract,
  getVerticalModuleForSlug,
  getVerticalModuleRoleFit,
  getVerticalModuleRoute,
  getVerticalModuleSlug,
  resolveVerticalRoleLens,
  resolveVerticalModuleAlias,
  auditVerticalUiRegistry,
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

  it("resolves stable semantic business aliases into the active vertical module", () => {
    expect(resolveVerticalModuleAlias("clinic", "bookings")).toBe("نوبت‌ها");
    expect(resolveVerticalModuleAlias("retail", "products")).toBe("محصولات");
    expect(resolveVerticalModuleAlias("restaurant", "orders")).toBe("سفارش‌های امروز");
    expect(resolveVerticalModuleAlias("salon", "bookings")).toBe("وقت‌های امروز");
    expect(resolveVerticalModuleAlias("clinic", "inventory")).toBeNull();
  });

  it("applies declared capability contracts to supported modules", () => {
    const clinic = getVerticalModuleBlueprint("clinic", "نوبت‌ها");
    const retail = getVerticalModuleBlueprint("retail", "موجودی");
    const restaurant = getVerticalModuleBlueprint("restaurant", "آشپزخانه");
    const salon = getVerticalModuleBlueprint("salon", "خدمات");
    const retailToday = getVerticalModuleBlueprint("retail", "فروش امروز");
    const salonToday = getVerticalModuleBlueprint("salon", "وقت‌های امروز");

    expect(clinic.capabilityContract.requiredCapabilities).toEqual(["booking"]);
    expect(clinic.capabilityContract.requiredPermissions).toEqual(["booking.read", "booking.manage"]);
    expect(retail.capabilityContract.requiredCapabilities).toEqual(["catalog", "commerce"]);
    expect(retail.capabilityContract.requiredPermissions).toEqual(["catalog.offer.update"]);
    expect(restaurant.capabilityContract.requiredCapabilities).toEqual(["commerce", "operations"]);
    expect(salon.capabilityContract.requiredCapabilities).toEqual(["catalog", "booking"]);
    expect(retailToday.capabilityContract.requiredCapabilities).toEqual(["commerce", "analytics"]);
    expect(salonToday.capabilityContract.requiredPermissions).toEqual(["booking.read", "crm.read"]);
  });

  it("exposes canonical domain traceability for each supported module", () => {
    for (const [vertical, modules] of Object.entries(verticalModules)) {
      for (const module of modules) {
        const blueprint = getVerticalModuleBlueprint(vertical, module);
        expect(blueprint.canonicalTermKeys.length).toBeGreaterThan(0);
        for (const key of blueprint.canonicalTermKeys) {
          expect(key.startsWith("canonical.")).toBe(true);
        }
      }
    }
  });

  it("does not model Provider as a parallel marketplace entity", () => {
    const doctors = getVerticalModuleBlueprint("clinic", "پزشکان");
    expect(doctors.eyebrow).toBe("Clinical Team");
    expect(doctors.blocks.some((item) => item.title === "Provider roster" || item.title === "Provider identity")).toBe(false);
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
  it("exposes one canonical UI contract for every supported module", () => {
    for (const [vertical, modules] of Object.entries(verticalModules)) {
      for (const module of modules) {
        const contract = getVerticalModuleUiContract(vertical, module);
        expect(contract.vertical).toBe(vertical);
        expect(contract.module).toBe(module);
        expect(contract.slug).toBe(getVerticalModuleSlug(vertical, module));
        expect(contract.route).toBe(getVerticalModuleRoute(vertical, module));
        expect(contract.blueprint).toBe(getVerticalModuleBlueprint(vertical, module));
        expect(contract.capabilityContract).toBe(contract.blueprint.capabilityContract);
        expect(contract.roleLenses).toEqual(contract.blueprint.roleLenses);
      }
    }
  });

  it("keeps semantic module identity stable across localized labels", () => {
    expect(getVerticalModuleSlug("clinic", "نوبت‌ها")).toBe("appointments");
    expect(getVerticalModuleSlug("retail", "سایز و رنگ")).toBe("attributes");
    expect(getVerticalModuleRoute("restaurant", "آشپزخانه")).toBe("/business/workspace/restaurant/kitchen");
    expect(getVerticalModuleForSlug("salon", "specialists", (verticalModules.salon ?? []))).toBe("متخصصان");
    expect(getVerticalModuleForSlug("salon", "نامعتبر", (verticalModules.salon ?? []))).toBeNull();
  });

  it("passes the shared registry audit for the canonical Workspace verticals", async () => {
    const { BUSINESS_VERTICAL_UI } = await import("./business-vertical-ui");
    const audit = auditVerticalUiRegistry(BUSINESS_VERTICAL_UI);
    expect(audit).toHaveLength(5);
    for (const result of audit) {
      expect(result.moduleCount).toBeGreaterThan(0);
      expect(result.missingBlueprints).toEqual([]);
      expect(result.missingSlugs).toEqual([]);
      expect(result.missingCapabilityContracts).toEqual([]);
      expect(result.missingCanonicalTerms).toEqual([]);
      expect(result.ready).toBe(true);
    }
  });

});
