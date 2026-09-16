import { describe, expect, it } from "vitest";
import { brandId } from "@qooqnos/core";
import { validateSellerProductOutput, validateSellerProductSafety } from "./ai-validation";
import type { SellerProductDraft } from "@qooqnos/ai";

function validDraft(): SellerProductDraft {
  return {
    sessionId: brandId<"EntityId">("session-1"),
    version: 1,
    product: {
      name: {
        value: "Example",
        provenance: "ai_extracted",
        confidence: "high_confidence",
        sourceRefs: ["input-1"],
      },
    },
    missingRequiredFields: [],
    conflicts: [],
    readyForSellerReview: true,
  };
}

describe("Seller AI validation", () => {
  it("accepts a canonical SellerProductDraft", () => {
    expect(() => validateSellerProductOutput(validDraft(), "seller-product-draft-v1")).not.toThrow();
  });

  it("rejects malformed model output before draft persistence", () => {
    expect(() => validateSellerProductOutput({ sessionId: "session-1", version: 1 }, "seller-product-draft-v1")).toThrow(
      "canonical draft contract",
    );
  });

  it("blocks unsafe content markers in otherwise valid draft structure", async () => {
    const draft = validDraft();
    const unsafeDraft: SellerProductDraft = {
      ...draft,
      product: {
        ...draft.product,
        name: {
          ...draft.product.name,
          value: "<script>alert(1)</script>",
        },
      },
    };
    await expect(validateSellerProductSafety(unsafeDraft, "seller.product.extract")).resolves.toBe("blocked");
  });

  it("allows ordinary validated draft content", async () => {
    await expect(validateSellerProductSafety(validDraft(), "seller.product.extract")).resolves.toBe("allowed");
  });
});
