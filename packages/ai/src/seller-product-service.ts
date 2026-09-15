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
  addInput(input: { readonly context: RequestContext; readonly sessionId: EntityId; readonly mediaAssetId?: EntityId; readonly rawText?: string; readonly now: string }): Promise<void>;
  saveDraft(input: { readonly context: RequestContext; readonly sessionId: EntityId; readonly version: number; readonly draft: SellerProductDraft; readonly now: string }): Promise<void>;
  getDraft(context: RequestContext, sessionId: EntityId): Promise<SellerProductDraft | null>;
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
    await this.options.repository.addInput({ context, sessionId, ...input, rawText: input.rawText?.trim(), now: this.options.now() });
  }

  async generateDraft<T extends SellerProductDraft>(
    context: RequestContext,
    sessionId: EntityId,
    request: Omit<Parameters<AIRuntimeClient["execute"]>[0], "context" | "sessionId">,
  ): Promise<AIResult<T>> {
    const result = await this.options.runtime.execute<T>({
      ...request,
      context,
      sessionId,
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

  getDraft(context: RequestContext, sessionId: EntityId): Promise<SellerProductDraft | null> {
    return this.options.repository.getDraft(context, sessionId);
  }
}
