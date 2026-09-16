export interface SellerAIProductCreationSessionResponse {
  readonly id: string;
  readonly organizationId: string;
  readonly workspaceId: string;
  readonly businessId: string | null;
  readonly catalogProductId: string | null;
  readonly actorId: string | null;
  readonly status: string;
  readonly currentDraftVersion: number;
  readonly idempotencyKey: string | null;
  readonly requestId: string | null;
  readonly correlationId: string | null;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SellerAIProductCreationRunOptions {
  readonly dataClassification?: "public" | "internal";
  readonly promptVersion?: string;
  readonly outputSchemaVersion?: string;
  readonly policyVersion?: string;
  readonly inputReference?: string;
  readonly inputHash?: string;
  readonly budgetUnits?: number;
}

export interface SellerAIProductCreationRunResponse<TDraft = unknown> {
  readonly operationId: string;
  readonly operationType: "seller.product.extract";
  readonly operationVersion: 1;
  readonly status: "succeeded" | "failed" | "blocked" | "abstained";
  readonly output?: TDraft;
  readonly providerId?: string;
  readonly modelId?: string;
  readonly safetyDecision: "allowed" | "blocked" | "abstained";
  readonly provenance: "none" | "ai_generated" | "ai_extracted" | "seller_confirmed";
  readonly warnings: readonly string[];
  readonly retryable: boolean;
}
