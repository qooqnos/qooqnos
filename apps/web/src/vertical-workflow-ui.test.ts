import { describe, expect, it } from "vitest";
import {
  getVerticalWorkflowOfferingActionHref,
  getVerticalWorkflowOfferingActionLabel,
  renderVerticalWorkflowCanvas,
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
      expect(html).toContain('data-vwf-action="refresh"');
      expect(html).toContain('data-vwf-state-label');
      expect(html).toContain('data-vwf-state="requires-input"');
      expect(html).toContain('role="tab"');
      expect(html).toContain('tabindex="0"');
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
      expect(html).toContain("زمان‌بندی");
      expect(html).toContain("پیگیری");
      expect(html).toContain("رزرو");
      expect(html).toContain("/business/workspace/clinic/calendar?business=business-test&fromModule=%D9%86%D9%88%D8%A8%D8%AA%E2%80%8C%D9%87%D8%A7");
    });

  it("centralizes canonical live supply actions", () => {
    expect(getVerticalWorkflowOfferingActionHref("service", "offering-service", "business-test"))
      .toBe("/booking?offering=offering-service&business=business-test");
    expect(getVerticalWorkflowOfferingActionHref("product", "offering-product", "business-test"))
      .toBe("/checkout?entity=offering-product&type=offering");
    expect(getVerticalWorkflowOfferingActionLabel("service")).toBe("رزرو خدمت");
    expect(getVerticalWorkflowOfferingActionLabel("product")).toBe("شروع خرید");
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
