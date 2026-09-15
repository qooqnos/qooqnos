import type { EntityId, RequestContext } from "@qooqnos/core";

export type AIConfidence = "confirmed" | "high_confidence" | "needs_review" | "unknown" | "conflicting" | "rejected";
export type AIProvenance = "seller_input" | "seller_confirmed" | "ai_extracted" | "ai_generated" | "system_derived" | "external_verified" | "policy_validated";
export type AIDataClassification = "public" | "internal" | "confidential" | "personal" | "sensitive" | "regulated";

export interface AIRequest {
  readonly context: RequestContext;
  readonly operationId: string;
  readonly operationType: string;
  readonly operationVersion: number;
  readonly sessionId?: string;
  readonly idempotencyKey: string;
  readonly input: unknown;
  readonly inputHash: string;
  readonly promptVersion: string;
  readonly schemaVersion: string;
  readonly policyVersion: string;
  readonly dataClassification: AIDataClassification;
  readonly timeoutMs?: number;
  readonly budget?: { readonly maxTokens?: number; readonly maxCostUnits?: number };
}

export interface AIUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
  readonly imageUnits?: number;
  readonly audioSeconds?: number;
  readonly embeddingUnits?: number;
  readonly providerCostUnits?: number;
}

export interface AIResult<TOutput> {
  readonly operationId: string;
  readonly status: "succeeded" | "failed" | "partial" | "blocked" | "cancelled";
  readonly output?: TOutput;
  readonly outputSchemaVersion: string;
  readonly providerId?: string;
  readonly modelId?: string;
  readonly usage: AIUsage;
  readonly provenance: AIProvenance;
  readonly confidence?: AIConfidence;
  readonly safetyDecision: "allowed" | "blocked" | "review_required";
  readonly warnings: readonly string[];
  readonly errorCode?: string;
}

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
