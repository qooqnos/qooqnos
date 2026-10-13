import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { ProductForm, ProductStep2Schema, ProductStep3Schema } from "./ProductForm";

describe("ProductForm Zod Validation (apps/web/src/components/ProductForm.tsx)", () => {
  it("strictly validates step 2 required fields (title, category) using Zod schema", () => {
    // Missing title and category
    const invalidResult = ProductStep2Schema.safeParse({
      title: "",
      category: "",
    });
    expect(invalidResult.success).toBe(false);
    if (!invalidResult.success) {
      const messages = invalidResult.error.issues.map((i) => i.message);
      expect(messages).toContain("لطفاً نام محصول را وارد کنید.");
      expect(messages).toContain("لطفاً دسته‌بندی محصول را مشخص کنید.");
    }

    // Title less than 3 chars
    const shortTitleResult = ProductStep2Schema.safeParse({
      title: "اب",
      category: "پوشاک",
    });
    expect(shortTitleResult.success).toBe(false);
    if (!shortTitleResult.success) {
      expect(shortTitleResult.error.issues[0]?.message).toBe("نام محصول باید حداقل ۳ کاراکتر باشد.");
    }

    // Valid step 2 data
    const validResult = ProductStep2Schema.safeParse({
      title: "تیشرت ورزشی",
      category: "پوشاک",
      description: "توضیحات تست",
    });
    expect(validResult.success).toBe(true);
  });

  it("strictly validates step 3 price and inventory using Zod schema", () => {
    // Invalid non-positive price
    const invalidPriceResult = ProductStep3Schema.safeParse({
      nature: "physical",
      structure: "simple",
      basePriceConsumer: 0,
    });
    expect(invalidPriceResult.success).toBe(false);
    if (!invalidPriceResult.success) {
      expect(invalidPriceResult.error.issues[0]?.message).toBe("قیمت مصرف‌کننده باید بیشتر از صفر باشد.");
    }

    // Invalid negative stock
    const negativeStockResult = ProductStep3Schema.safeParse({
      nature: "physical",
      structure: "simple",
      basePriceConsumer: 500000,
      stockQuantity: -5,
    });
    expect(negativeStockResult.success).toBe(false);
    if (!negativeStockResult.success) {
      expect(negativeStockResult.error.issues[0]?.message).toBe("موجودی انبار نمی‌تواند منفی باشد.");
    }

    // Valid step 3 data
    const validPriceResult = ProductStep3Schema.safeParse({
      nature: "physical",
      structure: "simple",
      basePriceConsumer: 1500000,
      stockQuantity: 25,
    });
    expect(validPriceResult.success).toBe(true);
  });

  it("renders multi-step form with human-friendly options and shields technical identifiers", () => {
    const html = renderToString(React.createElement(ProductForm));

    expect(html).toContain("مرحله");
    expect(html).toContain("از ۳");
    expect(html).toContain("چه چیزی می‌خواهید اضافه کنید؟");
    expect(html).toContain("کالا");
    expect(html).toContain("محصول دیجیتال");

    // Verify forbidden technical terms are NOT exposed
    expect(html).not.toContain("Product Type ID");
    expect(html).not.toContain("Entity UUID");
    expect(html).not.toContain("Storage Path");
    expect(html).not.toContain("Asset ID");
  });
});
