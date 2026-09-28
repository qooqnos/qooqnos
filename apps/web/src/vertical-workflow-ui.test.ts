import { describe, expect, it } from "vitest";
import {
  renderVerticalWorkflowCanvas,
  type VerticalWorkflowCanvasModel,
} from "./vertical-workflow-ui";
import { getVerticalModuleBlueprint } from "./business-module-ui";

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
    }
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
