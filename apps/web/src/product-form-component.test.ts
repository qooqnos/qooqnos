import { describe, it, expect } from "vitest";
import { ProductCreateFormComponent } from "./product-form-component";

describe("ProductCreateFormComponent (Simple/Variable & Physical/Digital Logic)", () => {
  it("generates Cartesian combinations for variable products with price inheritance", () => {
    const component = new ProductCreateFormComponent();
    const rows = component.generateVariantRows(2000000);

    // Default mock setup: 2 colors (مشکی, سفید) x 2 sizes (M, L) = 4 combinations
    expect(rows.length).toBe(4);
    expect(rows[0]?.name).toBe("مشکی / M");
    expect(rows[0]?.priceConsumer).toBe(2000000);
    expect(rows[0]?.pricePartner).toBe(1800000);
    expect(rows[0]?.priceAgent).toBe(1600000);

    expect(rows[1]?.name).toBe("مشکی / L");
    expect(rows[2]?.name).toBe("سفید / M");
    expect(rows[3]?.name).toBe("سفید / L");
  });

  it("renders clean UI without technical jargon (Product Entity, Asset ID, Variant UUID)", () => {
    const component = new ProductCreateFormComponent();
    const html = component.render();

    // Verify simple human-friendly Persian questions
    expect(html).toContain("چه چیزی می‌خواهید اضافه کنید؟");
    expect(html).toContain("کالا");
    expect(html).toContain("محصول دیجیتال");
    expect(html).toContain("این محصول چند مدل یا نوع دارد؟");
    expect(html).toContain("یک نوع (ساده)");
    expect(html).toContain("چند نوع");

    // Ensure customer group offer rows are present
    expect(html).toContain("مصرف‌کننده عادی");
    expect(html).toContain("همکار تجاری");
    expect(html).toContain("نماینده رسمی");

    // Ensure forbidden technical terms are NOT exposed to vendor
    expect(html).not.toContain("Product Type ID");
    expect(html).not.toContain("Product Entity");
    expect(html).not.toContain("Digital Asset");
    expect(html).not.toContain("Fulfillment Type");
    expect(html).not.toContain("Variant Entity");
    expect(html).not.toContain("Storage Path");
  });
});
