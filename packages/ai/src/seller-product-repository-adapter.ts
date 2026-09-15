import type { EntityId, RequestContext } from "@qooqnos/core";
import type { D1Database, SellerAIRepository } from "@qooqnos/database";
import type { SellerProductDraft, SellerProductSessionRepository } from "./seller-product-service";

export function createSellerProductSessionRepository(database: D1Database): SellerProductSessionRepository {
  const repository = new (requireRepository())(database);
  return {
    async create(input) {
      await repository.createSession(input.context, input.id, input.now);
    },
    async addInput(input) {
      await repository.addInput(input.context, {
        id: createId(),
        sessionId: input.sessionId,
        mediaAssetId: input.mediaAssetId,
        rawText: input.rawText,
        inputHash: hashInput(input.rawText, input.mediaAssetId),
        now: input.now,
      });
    },
    async saveDraft(input) {
      await repository.saveDraft(input.context, {
        id: input.id,
        sessionId: input.sessionId,
        version: input.version,
        draftJson: JSON.stringify(input.draft),
        now: input.now,
      });
    },
    async getDraft(context, sessionId) {
      const record = await repository.getDraft(context, sessionId);
      if (!record) return null;
      return JSON.parse(record.draftJson) as SellerProductDraft;
    },
  };

  function createId(): EntityId {
    return crypto.randomUUID() as EntityId;
  }

  function hashInput(rawText: string | undefined, mediaAssetId: EntityId | undefined): string {
    return `${mediaAssetId ?? ""}:${rawText ?? ""}`;
  }

  function requireRepository(): typeof SellerAIRepository {
    return SellerAIRepository;
  }
}
