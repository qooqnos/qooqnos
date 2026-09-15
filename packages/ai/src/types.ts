import type { EntityId } from "@qooqnos/core";
import type { AIDataClassification, AIRuntimeRequest, AIRuntimeResult, AIRuntimeUsage } from "@qooqnos/runtime";

export type { AIDataClassification, AIRuntimeRequest, AIRuntimeResult, AIRuntimeUsage };
export type AIRequest = AIRuntimeRequest;
export type AIResult<TOutput = unknown> = AIRuntimeResult<TOutput>;
export type AIUsage = AIRuntimeUsage;

export type AIConfidence = "confirmed" | "high_confidence" | "needs_review" | "unknown" | "conflicting" | "rejected";
export type AIProvenance = "seller_input" | "seller_confirmed" | "ai_extracted" | "ai_generated" | "system_derived" | "external_verified" | "policy_validated";

export interface SellerProductField<T = unknown> {
  readonly value: T | null;
  readonly provenance: AIProvenance;
  readonly confidence: AIConfidence;
  readonly sourceRefs: readonly string[];
}

export interface SellerProductDraft {
  readonly sessionId: EntityId;
  readonly version: number;
  readonly product: Readonly<Record<string, SellerProductField>>;
  readonly missingRequiredFields: readonly string[];
  readonly conflicts: readonly string[];
  readonly readyForSellerReview: boolean;
}
