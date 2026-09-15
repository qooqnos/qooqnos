import type { EntityId } from "@qooqnos/core";
import { SellerAIRepository, sha256Hex, type D1Database } from "@qooqnos/database";
import type { SellerProductDraft } from "./types";
import type { SellerProductSessionRepository } from "./seller-product-service";

export function createSellerProductSessionRepository(database: D1Database): SellerProductSessionRepository {
  const repository = new SellerAIRepository(database);
  return {
    async create(input) {
      await repository.createSession(input.context, input.id, input.now);
    },
    async addInput(input) {
      const rawText = input.rawText?.trim();
      const inputHash = await sha256Hex(`${input.mediaAssetId ?? ""}\n${rawText ?? ""}`);
      await repository.addInput(input.context, {
        id: createId(),
        sessionId: input.sessionId,
        ...(input.mediaAssetId !== undefined ? { mediaAssetId: input.mediaAssetId } : {}),
        ...(rawText !== undefined ? { rawText } : {}),
        inputHash,
        now: input.now,
      });
    },
    async saveDraft(input) {
      await repository.saveDraft(input.context, {
        id: createId(),
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
    async reviewDraft(input) {
      await repository.reviewDraft(input.context, input.sessionId, input.version, input.now);
    },
    async confirmDraft(input) {
      await repository.confirmDraft(input.context, input.sessionId, input.version, input.now);
    },
    async cancelSession(input) {
      return repository.cancelSession(input.context, input.sessionId, input.now);
    },
  };

  function createId(): EntityId {
    return crypto.randomUUID() as EntityId;
  }
}
