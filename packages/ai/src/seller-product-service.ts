import type { EntityId, RequestContext } from "@qooqnos/core";
import type { AIResult, SellerProductDraft } from "./types";
import type { AIRuntimeClient } from "./runtime-client";

export const SELLER_AI_OPERATION_TYPES = {
  extract: "seller.product.extract",
  classify: "seller.product.classify",
  enrich: "seller.product.enrich",
  validate: "seller.product.validate_ai",
} as const;

export interface SellerProductSessionRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId;
  readonly actorId: EntityId | null;
  readonly status: string;
  readonly currentDraftVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SellerProductProvenanceRecord {
  readonly fieldPath: string;
  readonly provenance: "seller_input" | "seller_confirmed" | "ai_extracted" | "ai_generated" | "system_derived" | "external_verified" | "policy_validated";
  readonly confidence: "confirmed" | "high_confidence" | "needs_review" | "unknown" | "conflicting" | "rejected";
  readonly sourceRefs: readonly string[];
}

export interface SellerProductSessionRepository {
  create(input: { readonly id: EntityId; readonly context: RequestContext; readonly now: string }): Promise<void>;
  getSession(context: RequestContext, sessionId: EntityId): Promise<SellerProductSessionRecord | null>;
  addInput(input: { readonly context: RequestContext; readonly sessionId: EntityId; readonly mediaAssetId?: EntityId | undefined; readonly rawText?: string | undefined; readonly now: string }): Promise<void>;
  saveDraft(input: { readonly context: RequestContext; readonly sessionId: EntityId; readonly version: number; readonly draft: SellerProductDraft; readonly provenance: readonly SellerProductProvenanceRecord[]; readonly now: string }): Promise<void>;
  getDraft(context: RequestContext, sessionId: EntityId): Promise<SellerProductDraft | null>;
  reviewDraft(input: { readonly context: RequestContext; readonly sessionId: EntityId; readonly version: number; readonly now: string }): Promise<void>;
  confirmDraft(input: { readonly context: RequestContext; readonly sessionId: EntityId; readonly version: number; readonly now: string }): Promise<void>;
  cancelSession(input: { readonly context: RequestContext; readonly sessionId: EntityId; readonly now: string }): Promise<boolean>;
}

export interface SellerProductSessionServiceOptions {
  readonly repository: SellerProductSessionRepository;
  readonly id: () => EntityId;
  readonly now: () => string;
}

export class SellerProductSessionService {
  constructor(protected readonly sessionOptions: SellerProductSessionServiceOptions) {}

  async createSession(context: RequestContext): Promise<EntityId> {
    const id = this.sessionOptions.id();
    await this.sessionOptions.repository.create({ id, context, now: this.sessionOptions.now() });
    return id;
  }

  getSession(context: RequestContext, sessionId: EntityId): Promise<SellerProductSessionRecord | null> {
    return this.sessionOptions.repository.getSession(context, sessionId);
  }

  async addInput(
    context: RequestContext,
    sessionId: EntityId,
    input: { readonly mediaAssetId?: EntityId; readonly rawText?: string },
  ): Promise<void> {
    if (!input.mediaAssetId && !input.rawText?.trim()) throw new Error("Seller product input requires media or raw text");
    const rawText = input.rawText?.trim();
    await this.sessionOptions.repository.addInput({
      context,
      sessionId,
      ...(input.mediaAssetId !== undefined ? { mediaAssetId: input.mediaAssetId } : {}),
      ...(rawText !== undefined ? { rawText } : {}),
      now: this.sessionOptions.now(),
    });
  }

  async reviewDraft(context: RequestContext, sessionId: EntityId, version: number): Promise<void> {
    await this.sessionOptions.repository.reviewDraft({ context, sessionId, version, now: this.sessionOptions.now() });
  }

  async confirmDraft(context: RequestContext, sessionId: EntityId, version: number): Promise<void> {
    await this.sessionOptions.repository.confirmDraft({ context, sessionId, version, now: this.sessionOptions.now() });
  }

  async cancelSession(context: RequestContext, sessionId: EntityId): Promise<boolean> {
    return this.sessionOptions.repository.cancelSession({ context, sessionId, now: this.sessionOptions.now() });
  }

  getDraft(context: RequestContext, sessionId: EntityId): Promise<SellerProductDraft | null> {
    return this.sessionOptions.repository.getDraft(context, sessionId);
  }
}

export interface SellerProductServiceOptions extends SellerProductSessionServiceOptions {
  readonly runtime: AIRuntimeClient;
}

export class SellerProductService extends SellerProductSessionService {
  constructor(private readonly productOptions: SellerProductServiceOptions) {
    super(productOptions);
  }

  async generateDraft<T extends SellerProductDraft>(
    context: RequestContext,
    sessionId: EntityId,
    request: Omit<Parameters<AIRuntimeClient["execute"]>[0], "context" | "sessionId">,
  ): Promise<AIResult<T>> {
    const result = await this.productOptions.runtime.execute<T>({
      ...request,
      context,
      operationType: SELLER_AI_OPERATION_TYPES.extract,
      operationVersion: 1,
    });
    if (result.output) {
      const provenance = Object.entries(result.output.product).map(([fieldPath, field]) => ({
        fieldPath,
        provenance: field.provenance,
        confidence: field.confidence,
        sourceRefs: field.sourceRefs,
      }));
      await this.productOptions.repository.saveDraft({
        context,
        sessionId,
        version: result.output.version,
        draft: result.output,
        provenance,
        now: this.productOptions.now(),
      });
    }
    return result;
  }
}
