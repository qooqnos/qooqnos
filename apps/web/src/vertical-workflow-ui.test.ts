import { describe, expect, it } from "vitest";
import {
  getVerticalWorkflowOfferingActionHref,
  getVerticalWorkflowOfferingActionLabel,
  renderVerticalWorkflowCanvas,
  renderVerticalWorkflowOverview,
  type VerticalWorkflowCanvasModel,
} from "./vertical-workflow-ui";
import {
  VERTICAL_MODULE_SLUGS,
  getVerticalModuleBlueprint,
  getVerticalModuleForSlug,
  getVerticalModuleRoleFit,
  getVerticalModuleRoute,
  resolveVerticalRoleLens,
} from "./business-module-ui";
import {
  getVerticalWorkflowDefinition,
  getVerticalWorkflowStageModule,
} from "./business-workflow-ui";

describe("Vertical Workflow UI Canvas", () => {
  const layouts = [
    ["command", "امروز"],
    ["calendar", "تقویم"],
    ["catalog", "محصولات"],
    ["people", "پزشکان"],
    ["commerce", "سفارش‌ها"],
    ["operations", "آشپزخانه"],
    ["communication", "پیام‌ها"],
  ] as const;

  it("ships shared VWF labels through the multilingual dictionary", async () => {
    const { defaultI18n } = await import("./i18n-runtime");
    defaultI18n.setLanguage("en");
    expect(defaultI18n.t("ui.vertical_sharedComponent")).toBe("Shared component");
    expect(defaultI18n.t("ui.vertical_handoffContract")).toBe("Workflow handoff contract");
    expect(defaultI18n.t("ui.vertical_capabilityDependencies")).toBe("Module dependencies");
    defaultI18n.setLanguage("ar");
    expect(defaultI18n.t("ui.vertical_sharedComponent")).toBe("مكوّن مشترك");
    expect(defaultI18n.t("ui.vertical_handoffContract")).toBe("عقد تسليم سير العمل");
    expect(defaultI18n.t("ui.vertical_capabilityDependencies")).toBe("تبعية الوحدة");
    defaultI18n.setLanguage("en");
    const html = renderVerticalWorkflowCanvas({
      vertical: "clinic",
      module: "نوبت‌ها",
      businessId: "business-test",
      blueprint: getVerticalModuleBlueprint("clinic", "نوبت‌ها"),
    });
    expect(html).toContain("Workflow handoff contract");
    expect(html).toContain("Command layer; primary actions and the work queue without creating parallel state.");
    expect(html).toContain('data-vwf-mobile-actions');
    expect(html).toContain('Refresh this canvas data');
    defaultI18n.setLanguage("fa");
  });

  it("renders all shared layouts with stable data attributes", () => {
    for (const [expectedLayout, module] of layouts) {
      const blueprint = getVerticalModuleBlueprint("clinic", module);
      expect(blueprint.layout).toBe(expectedLayout);

      const model: VerticalWorkflowCanvasModel = {
        vertical: "clinic",
        module,
        businessId: "business-test",
        blueprint,
        contextualHref: (path) => "/business/workspace/clinic/" + encodeURIComponent(module) + "?next=" + encodeURIComponent(path),
      };

      const html = renderVerticalWorkflowCanvas(model);
      expect(html).toContain('data-vwf-root');
      expect(html).toContain('data-vwf-layout="' + expectedLayout + '"');
      expect(html).toContain('data-vwf-business-id="business-test"');
      expect(html).toContain('data-vwf-vertical="clinic"');
      expect(html).toContain('data-vwf-module="' + module + '"');
      expect(html).toContain("Vertical Workflow UI Framework");
      expect(html).toContain('data-vwf-handoff');
      expect(html).toContain("Workflow Handoff Contract");
      expect(html).toContain("ورودی، مرحله فعلی و خروجی بعدی");
      expect(html).toContain('data-vwf-action="refresh"');
      expect(html).toContain('data-vwf-state-label');
      expect(html).toContain('data-vwf-state="requires-input"');
      expect(html).toContain('role="tab"');
      expect(html).toContain('tabindex="0"');
      expect(html).toContain('aria-selected="true"');
      expect([...html.matchAll(/<button[^>]*data-vwf-tab[^>]*>/g)].every((match) =>
        match[0].includes('role="tab"') &&
        match[0].includes('aria-selected=') &&
        match[0].includes('tabindex=')
      )).toBe(true);
    }
  });

  it("renders one shared semantic module switcher for every supported vertical", () => {
    for (const vertical of ["clinic", "retail", "restaurant", "salon"]) {
      const definition = getVerticalWorkflowDefinition(vertical);
      const module = getVerticalWorkflowStageModule(vertical, definition.steps[0]!)!;
      const html = renderVerticalWorkflowCanvas({
        vertical,
        module,
        businessId: "business-test",
        blueprint: getVerticalModuleBlueprint(vertical, module),
      });
      expect(html).toContain('data-vwf-module-switcher');
      expect(html).toContain('aria-label="ماژول‌های این Workspace"');
      expect(html).toContain('data-vwf-module-state="current"');
      expect(html).toContain('data-vwf-module-state="available"');
      expect(html).toContain('/business/workspace/' + vertical + '/');
    }
  });

  it("renders shared previous/next stage navigation and stage metadata", () => {
      const blueprint = getVerticalModuleBlueprint("clinic", "نوبت‌ها");
      const model: VerticalWorkflowCanvasModel = {
        vertical: "clinic",
        module: "نوبت‌ها",
        businessId: "business-test",
        blueprint,
      };

      const html = renderVerticalWorkflowCanvas(model);
      expect(html).toContain('data-vwf-stage-index="2"');
      expect(html).toContain('data-vwf-stage-total="4"');
      expect(html).toContain('data-vwf-stage-state="completed"');
      expect(html).toContain('data-vwf-stage-state="current"');
      expect(html).toContain('data-vwf-stage-state="upcoming"');
      expect(html).toContain("زمان‌بندی");
      expect(html).toContain("پیگیری");
      expect(html).toContain("رزرو");
      expect(html).toContain("/business/workspace/clinic/calendar?business=business-test&amp;fromModule=%D9%86%D9%88%D8%A8%D8%AA%E2%80%8C%D9%87%D8%A7");
    });

  it("centralizes canonical live supply actions", () => {
    expect(getVerticalWorkflowOfferingActionHref("service", "offering-service", "business-test"))
      .toBe("/booking?offering=offering-service&business=business-test");
    expect(getVerticalWorkflowOfferingActionHref("product", "offering-product", "business-test"))
      .toBe("/checkout?entity=offering-product&type=offering");
    expect(getVerticalWorkflowOfferingActionLabel("service")).toBe("رزرو خدمت");
    expect(getVerticalWorkflowOfferingActionLabel("product")).toBe("شروع خرید");
  });

  it("renders the command canvas with a canonical Business context hydration surface", () => {
    const blueprint = getVerticalModuleBlueprint("clinic", "امروز");
    const model: VerticalWorkflowCanvasModel = {
      vertical: "clinic",
      module: "امروز",
      businessId: "business-test",
      blueprint,
    };

    const html = renderVerticalWorkflowCanvas(model);
    expect(html).toContain('data-vwf-business-live');
    expect(html).toContain('data-vwf-command-live-content');
    expect(html).toContain("Canonical Business Context");
    expect(html).toContain("Business management");
  });

  it("renders the people canvas with a canonical workspace-member hydration surface", () => {
    const blueprint = getVerticalModuleBlueprint("clinic", "پزشکان");
    const model: VerticalWorkflowCanvasModel = {
      vertical: "clinic",
      module: "پزشکان",
      businessId: "business-test",
      blueprint,
    };

    const html = renderVerticalWorkflowCanvas(model);
    expect(html).toContain('data-vwf-layout="people"');
    expect(html).toContain('data-vwf-members-live');
    expect(html).toContain('data-vwf-member-items');
    expect(html).toContain("Canonical Workspace Team");
    expect(html).toContain('data-vwf-customer-history');
    expect(html).toContain('data-vwf-customer-history-items');
  });

  it("renders a role-aware emphasis contract on every shared canvas", () => {
    const blueprint = getVerticalModuleBlueprint("clinic", "نوبت‌ها");
    const model: VerticalWorkflowCanvasModel = {
      vertical: "clinic",
      module: "نوبت‌ها",
      businessId: "business-test",
      blueprint,
    };

    const html = renderVerticalWorkflowCanvas(model);
    expect(html).toContain('data-vwf-role-lens');
    expect(html).toContain('data-vwf-role-title');
    expect(html).toContain('data-vwf-role-description');
    expect(html).toContain('data-vwf-role-fit');
  });

  it("surfaces declared capability and permission dependencies without turning them into authorization", async () => {
    const { defaultI18n } = await import("./i18n-runtime");
    defaultI18n.setLanguage("en");
    const blueprint = getVerticalModuleBlueprint("clinic", "نوبت‌ها");
    expect(blueprint.capabilityContract.requiredCapabilities).toEqual(["booking"]);
    expect(blueprint.capabilityContract.requiredPermissions).toEqual(["booking.read", "booking.manage"]);

    const html = renderVerticalWorkflowCanvas({
      vertical: "clinic",
      module: "نوبت‌ها",
      businessId: "business-test",
      blueprint,
    });
    expect(html).toContain('data-vwf-capability="booking"');
    expect(html).toContain('data-vwf-required-permission="booking.read"');
    expect(html).toContain('data-vwf-required-permission="booking.manage"');
    expect(html).toContain("Capability Contract");
    expect(html).toContain(defaultI18n.t("ui.vertical_backendAuthoritative"));
    expect(html).toContain(defaultI18n.t("ui.vertical_capabilityDescription"));
    defaultI18n.setLanguage("fa");
  });

  it("escapes contextual identifiers before placing them into HTML attributes", () => {
    const blueprint = getVerticalModuleBlueprint("retail", "محصولات");
    const model: VerticalWorkflowCanvasModel = {
      vertical: 'retail"><script>',
      module: 'محصولات" aria-hidden="true',
      businessId: 'biz"&<>',
      blueprint,
    };

    const html = renderVerticalWorkflowCanvas(model);
    expect(html).not.toContain('retail"><script>');
    expect(html).not.toContain('biz"&<>');
    expect(html).toContain("retail&quot;&gt;&lt;script&gt;");
    expect(html).toContain("biz&quot;&amp;&lt;&gt;");
  });
});


describe("Vertical Workflow overview", () => {
  it("renders canonical schedulable resources for clinic providers", () => {
    const blueprint = getVerticalModuleBlueprint("clinic", "پزشکان");
    const html = renderVerticalWorkflowCanvas({
      vertical: "clinic",
      module: "پزشکان",
      businessId: "business-test",
      blueprint,
    });
    expect(html).toContain('data-vwf-layout="people"');
    expect(html).toContain('data-vwf-resources-live');
    expect(html).toContain('data-vwf-resource-type="person"');
    expect(html).toContain("Canonical Booking Resources");
  });


  it("renders canonical variant and attribute surfaces for retail catalog modules", () => {
    for (const module of ["مدل‌ها و تنوع", "سایز و رنگ"]) {
      const blueprint = getVerticalModuleBlueprint("retail", module);
      const html = renderVerticalWorkflowCanvas({
        vertical: "retail",
        module,
        businessId: "business-test",
        blueprint,
      });
      expect(html).toContain('data-vwf-layout="catalog"');
      expect(html).toContain('data-vwf-variants-live');
      expect(html).toContain('data-vwf-variant-items');
      expect(html).toContain("Canonical Catalog Variants");
    }
  });

  it("renders a live inventory surface for the retail inventory module", () => {
    const blueprint = getVerticalModuleBlueprint("retail", "موجودی");
    const html = renderVerticalWorkflowCanvas({
      vertical: "retail",
      module: "موجودی",
      businessId: "business-test",
      blueprint,
    });
    expect(html).toContain('data-vwf-layout="commerce"');
    expect(html).toContain('data-vwf-inventory-live');
    expect(html).toContain("Canonical Inventory");
    expect(html).toContain("موجودی واقعی این کسب‌وکار");
  });


  it("renders the shared canonical Commerce Order surface for order-oriented modules", () => {
    for (const [vertical, module] of [
      ["retail", "فروش امروز"],
      ["retail", "سفارش‌ها"],
      ["restaurant", "سفارش‌های امروز"],
    ] as const) {
      const blueprint = getVerticalModuleBlueprint(vertical, module);
      const html = renderVerticalWorkflowCanvas({
        vertical,
        module,
        businessId: "business-test",
        blueprint,
      });
      expect(html).toContain('data-vwf-layout="commerce"');
      expect(html).toContain('data-vwf-orders-live');
      expect(html).toContain('data-vwf-order-items');
      expect(html).toContain("Canonical Commerce Orders");
      expect(html).toContain("سفارش‌های این کسب‌وکار");
    }
  });

  it("renders the shared canonical Billing surface for payment modules", () => {
    for (const vertical of ["clinic", "restaurant", "salon"]) {
      const blueprint = getVerticalModuleBlueprint(vertical, "پرداخت");
      const html = renderVerticalWorkflowCanvas({
        vertical,
        module: "پرداخت",
        businessId: "business-test",
        blueprint,
      });
      expect(html).toContain('data-vwf-layout="commerce"');
      expect(html).toContain('data-vwf-billing-live');
      expect(html).toContain('data-vwf-invoice-items');
      expect(html).toContain("Canonical Billing");
      expect(html).toContain("صورتحساب‌های این کسب‌وکار");
    }
  });

  it("renders the shared canonical Fulfillment lookup for Operations modules", () => {
    const blueprint = getVerticalModuleBlueprint("restaurant", "تحویل");
    const html = renderVerticalWorkflowCanvas({
      vertical: "restaurant",
      module: "تحویل",
      businessId: "business-test",
      blueprint,
    });
    expect(html).toContain('data-vwf-fulfillment-live');
    expect(html).toContain('data-vwf-fulfillment-id');
    expect(html).toContain('data-vwf-load-fulfillment');
    expect(html).toContain('data-vwf-fulfillment-detail');
    expect(html).toContain("Canonical Fulfillment");
  });

  it("renders a live booking-resource surface for restaurant tables", () => {
    const blueprint = getVerticalModuleBlueprint("restaurant", "میزها");
    const html = renderVerticalWorkflowCanvas({
      vertical: "restaurant",
      module: "میزها",
      businessId: "business-test",
      blueprint,
    });
    expect(html).toContain('data-vwf-layout="operations"');
    expect(html).toContain('data-vwf-resources-live');
    expect(html).toContain('data-vwf-resource-type=""');
    expect(html).toContain("Canonical Booking Resources");
    expect(html).toContain("میزها و منابع رزرو");
  });

  it("renders a shared canonical booking lookup for appointment-oriented calendar modules", () => {
    for (const [vertical, module] of [
      ["clinic", "نوبت‌ها"],
      ["restaurant", "رزرو"],
      ["salon", "وقت‌های امروز"],
    ] as const) {
      const blueprint = getVerticalModuleBlueprint(vertical, module);
      const html = renderVerticalWorkflowCanvas({
        vertical,
        module,
        businessId: "business-test",
        blueprint,
      });
      expect(html).toContain('data-vwf-booking-live');
      expect(html).toContain('data-vwf-booking-id');
      expect(html).toContain('data-vwf-load-booking');
      expect(html).toContain('data-vwf-booking-detail');
      expect(html).toContain("Canonical Booking");
    }
  });

  it("covers all supported verticals with shared stage navigation", async () => {
    const { defaultI18n, translateUiText } = await import("./i18n-runtime");
    defaultI18n.setLanguage("fa");
    for (const vertical of ["clinic", "retail", "restaurant", "salon"] as const) {
      const html = renderVerticalWorkflowOverview({ vertical, businessId: "business-test" });
      expect(html).toContain('data-vwf-overview-vertical="' + vertical + '"');
      expect(html).toContain("Vertical Workflow UI Framework");
      expect(html).toContain('data-nav');
      expect(html).toContain("Backend authoritative");
      expect(html).toContain('data-vwf-overview-stage');
      const firstStageModule = getVerticalWorkflowStageModule(
        vertical,
        getVerticalWorkflowDefinition(vertical).steps[0]!,
      );
      expect(html).toContain(
        'data-vwf-overview-stage-module="' +
          translateUiText(firstStageModule ?? "", "fa") +
          '"',
      );
      expect(html).toContain('data-vwf-overview-access');
    }
  });

  it("keeps overview identifiers escaped", () => {
    const html = renderVerticalWorkflowOverview({
      vertical: 'clinic"><script>',
      businessId: 'biz"&<>',
    });
    expect(html).not.toContain('clinic"><script>');
    expect(html).not.toContain('biz"&<>');
    expect(html).toContain('data-vwf-overview-vertical="clinic&quot;&gt;&lt;script&gt;"');
  });
});

describe("Vertical Workflow contract", () => {
  const verticals = ["clinic", "retail", "restaurant", "salon"] as const;

  it("keeps every vertical workflow mapped to real module blueprints", () => {
    for (const vertical of verticals) {
      const definition = getVerticalWorkflowDefinition(vertical);
      expect(definition.steps.length).toBeGreaterThanOrEqual(4);
      for (const stage of definition.steps) {
        const module = getVerticalWorkflowStageModule(vertical, stage);
        expect(module).toBeTruthy();
        const blueprint = getVerticalModuleBlueprint(vertical, module!);
        expect(blueprint.blocks.length).toBeGreaterThanOrEqual(3);
        expect(blueprint.states.map((item) => item.key)).toEqual(
          expect.arrayContaining(["connected", "requires-input", "readonly", "unavailable"]),
        );
      }
    }
  });

  it("keeps semantic routes stable for all vertical module slugs", async () => {
    for (const vertical of verticals) {
      const entries = Object.entries(VERTICAL_MODULE_SLUGS[vertical]!);
      expect(entries.length).toBeGreaterThanOrEqual(4);
      for (const [module, slug] of entries) {
        expect(getVerticalModuleRoute(vertical, module)).toContain(
          "/business/workspace/" + vertical + "/" + slug,
        );
        expect(getVerticalModuleForSlug(vertical, slug, entries.map(([name]) => name))).toBe(module);
      }
    }
  });

  it("treats role emphasis as presentation, not authorization", () => {
    const management = resolveVerticalRoleLens(["owner"]);
    const specialist = resolveVerticalRoleLens(["specialist"]);
    const blueprint = getVerticalModuleBlueprint("clinic", "تقویم");

    expect(management.key).toBe("management");
    expect(specialist.key).toBe("specialist");
    expect(["primary", "shared"]).toContain(getVerticalModuleRoleFit(blueprint, management.key));
    expect(["primary", "shared"]).toContain(getVerticalModuleRoleFit(blueprint, specialist.key));
  });
});
