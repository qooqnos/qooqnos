import type { EntityId, RequestContext } from "@qooqnos/core";
import type { AIResult, SellerProductDraft } from "./types";
import type { AIRuntimeClient } from "./runtime-client";

export const SELLER_AI_OPERATION_TYPES = {
  extract: "seller.product.extract",
  classify: "seller.product.classify",
  enrich: "seller.product.enrich",
  validate: "seller.product.validate_ai",
} as const;

export interface SellerProductSessionRepository {
  create(input: { readonly id: EntityId; readonly context: RequestContext; readonly now: string }): Promise<void>;
  addInput(input: { readonly context: RequestContext; readonly sessionId: EntityId; readonly mediaAssetId?: EntityId | undefined; readonly rawText?: string | undefined; readonly now: string }): Promise<void>;
  saveDraft(input: { readonly context: RequestContext; readonly sessionId: EntityId; readonly version: number; readonly draft: SellerProductDraft; readonly now: string }): Promise<void>;
  getDraft(context: RequestContext, sessionId: EntityId): Promise<SellerProductDraft | null>;
  reviewDraft(input: { readonly context: RequestContext; readonly sessionId: EntityId; readonly version: number; readonly now: string }): Promise<void>;
  confirmDraft(input: { readonly context: RequestContext; readonly sessionId: EntityId; readonly version: number; readonly now: string }): Promise<void>;
  cancelSession(input: { readonly context: RequestContext; readonly sessionId: EntityId; readonly now: string }): Promise<boolean>;
}

export interface SellerProductServiceOptions {
  readonly repository: SellerProductSessionRepository;
  readonly runtime: AIRuntimeClient;
  readonly id: () => EntityId;
  readonly now: () => string;
}

export class SellerProductService {
  constructor(private readonly options: SellerProductServiceOptions) {}

  async createSession(context: RequestContext): Promise<EntityId> {
    const id = this.options.id();
    await this.options.repository.create({ id, context, now: this.options.now() });
    return id;
  }

  async addInput(context: RequestContext, sessionId: EntityId, input: { readonly mediaAssetId?: EntityId; readonly rawText?: string }): Promise<void> {
    if (!input.mediaAssetId && !input.rawText?.trim()) throw new Error("Seller product input requires media or raw text");
    const rawText = input.rawText?.trim();
    await this.options.repository.addInput({
      context,
      sessionId,
      ...(input.mediaAssetId !== undefined ? { mediaAssetId: input.mediaAssetId } : {}),
      ...(rawText !== undefined ? { rawText } : {}),
      now: this.options.now(),
    });
  }

  async generateDraft<T extends SellerProductDraft>(
    context: RequestContext,
    sessionId: EntityId,
    request: Omit<Parameters<AIRuntimeClient["execute"]>[0], "context" | "sessionId">,
  ): Promise<AIResult<T>> {
    const result = await this.options.runtime.execute<T>({
      ...request,
      context,
      operationType: SELLER_AI_OPERATION_TYPES.extract,
      operationVersion: 1,
    });
    if (result.output) {
      await this.options.repository.saveDraft({
        context,
        sessionId,
        version: result.output.version,
        draft: result.output,
        now: this.options.now(),
      });
    }
    return result;
  }

  async reviewDraft(context: RequestContext, sessionId: EntityId, version: number): Promise<void> {
    await this.options.repository.reviewDraft({ context, sessionId, version, now: this.options.now() });
  }

  async confirmDraft(context: RequestContext, sessionId: EntityId, version: number): Promise<void> {
    await this.options.repository.confirmDraft({ context, sessionId, version, now: this.options.now() });
  }

  async cancelSession(context: RequestContext, sessionId: EntityId): Promise<boolean> {
    return this.options.repository.cancelSession({ context, sessionId, now: this.options.now() });
  }

  getDraft(context: RequestContext, sessionId: EntityId): Promise<SellerProductDraft | null> {
    return this.options.repository.getDraft(context, sessionId);
  }
}
