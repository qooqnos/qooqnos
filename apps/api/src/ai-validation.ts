import type { SellerProductDraft } from "@qooqnos/ai";
import type { AIRuntimePolicy } from "@qooqnos/runtime";

export const validateSellerProductOutput: AIRuntimePolicy["validateOutput"] = (output) => {
  if (!isSellerProductDraft(output)) {
    throw new Error("AI seller product output does not match the canonical draft contract");
  }
}

export const validateSellerProductSafety: AIRuntimePolicy["validateSafety"] = (output) => {
  if (!isSellerProductDraft(output)) return "blocked";

  const serialized = JSON.stringify(output).toLowerCase();
  const unsafeMarkers = [
    "<script",
    "javascript:",
    "data:text/html",
    "ignore previous instructions",
    "ignore all previous instructions",
  ];

  if (unsafeMarkers.some((marker) => serialized.includes(marker))) return "blocked";
  return "allowed";
};

function isSellerProductDraft(value: unknown): value is SellerProductDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  if (typeof draft.sessionId !== "string" || typeof draft.version !== "number" || !Number.isInteger(draft.version) || draft.version <= 0) return false;
  if (!draft.product || typeof draft.product !== "object" || Array.isArray(draft.product)) return false;
  if (!Array.isArray(draft.missingRequiredFields) || !draft.missingRequiredFields.every((field) => typeof field === "string")) return false;
  if (!Array.isArray(draft.conflicts) || !draft.conflicts.every((field) => typeof field === "string")) return false;
  if (typeof draft.readyForSellerReview !== "boolean") return false;

  return Object.values(draft.product).every((field) => {
    if (!field || typeof field !== "object" || Array.isArray(field)) return false;
    const candidate = field as Record<string, unknown>;
    return (
      [
        "seller_input",
        "seller_confirmed",
        "ai_extracted",
        "ai_generated",
        "system_derived",
        "external_verified",
        "policy_validated",
      ].includes(candidate.provenance as string) &&
      ["confirmed", "high_confidence", "needs_review", "unknown", "conflicting", "rejected"].includes(candidate.confidence as string) &&
      Array.isArray(candidate.sourceRefs) &&
      candidate.sourceRefs.every((ref) => typeof ref === "string")
    );
  });
}
