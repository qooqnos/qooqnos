import { describe, expect, it, vi } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { SellerProductService, SellerProductSessionService, type SellerProductSessionRepository, SELLER_AI_OPERATION_TYPES } from "./seller-product-service";
import type { AIRuntimeClient } from "./runtime-client";
import type { AIRequest, AIResult, SellerProductDraft } from "./types";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "ai",
    operation: "seller.product.extract",
    locale: "en",
    timezone: "UTC",
  };
}

function draft(): SellerProductDraft {
  return {
    sessionId: brandId<"EntityId">("session-1"),
    version: 1,
    product: {
      name: {
        value: "Example product",
        provenance: "seller_input",
        confidence: "confirmed",
        sourceRefs: ["input-1"],
      },
    },
    missingRequiredFields: [],
    conflicts: [],
    readyForSellerReview: true,
  };
}

function repository(): SellerProductSessionRepository {
  return {
    async create(input) {
      return {
        id: input.id,
        organizationId: brandId<"EntityId">("tenant-1"),
        workspaceId: brandId<"EntityId">("workspace-1"),
        businessId: input.businessId,
        catalogProductId: null,
        actorId: brandId<"EntityId">("user-1"),
        status: "initiated",
        currentDraftVersion: 0,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: input.requestFingerprint,
        requestId: input.context.requestId,
        correlationId: input.context.correlationId,
        expiresAt: input.expiresAt ?? null,
        createdAt: input.now,
        updatedAt: input.now,
      };
    },
    async getSession() { return null; },
    async getInputs() {
      return [{
        id: brandId<"EntityId">("input-1"),
        sessionId: brandId<"EntityId">("session-1"),
        mediaAssetId: null,
        rawText: "Example product",
        inputHash: "hash-1",
        createdAt: "2026-09-16T00:00:00.000Z",
      }];
    },
    async addInput() {},
    async saveDraft() {},
    async getDraft() { return null; },
    async reviewDraft() {},
    async confirmDraft() {},
    async markCatalogSaved() { return true; },
    async cancelSession() { return true; },
  };
}

describe("SellerProductSessionService", () => {
  it("creates a scoped seller session with explicit business ownership and idempotency", async () => {
    const create = vi.fn(async (input: Parameters<SellerProductSessionRepository["create"]>[0]) => ({
      id: input.id,
      organizationId: brandId<"EntityId">("tenant-1"),
      workspaceId: brandId<"EntityId">("workspace-1"),
      businessId: input.businessId,
      catalogProductId: null,
      actorId: brandId<"EntityId">("user-1"),
      status: "initiated",
      currentDraftVersion: 0,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: input.requestFingerprint,
      requestId: input.context.requestId,
      correlationId: input.context.correlationId,
      expiresAt: input.expiresAt ?? null,
      createdAt: input.now,
      updatedAt: input.now,
    }));
    const repo = repository();
    repo.create = create;
    const service = new SellerProductSessionService({
      repository: repo,
      id: () => brandId<"EntityId">("session-1"),
      now: () => "2026-09-16T00:00:00.000Z",
    });

    const result = await service.createSession(context(), {
      businessId: brandId<"EntityId">("business-1"),
      idempotencyKey: "idem-1",
      expiresAt: "2026-09-17T00:00:00.000Z",
    });

    expect(result.businessId).toBe(brandId<"EntityId">("business-1"));
    expect(result.requestFingerprint).toBe(brandId<"EntityId">("business-1"));
    expect(create).toHaveBeenCalledWith({
      id: brandId<"EntityId">("session-1"),
      context: context(),
      businessId: brandId<"EntityId">("business-1"),
      idempotencyKey: "idem-1",
      requestFingerprint: brandId<"EntityId">("business-1"),
      expiresAt: "2026-09-17T00:00:00.000Z",
      now: "2026-09-16T00:00:00.000Z",
    });
  });
});

describe("SellerProductService", () => {
  it("passes trusted request context and persisted session inputs into the canonical AI runtime and persists field provenance", async () => {
    const saveDraft = vi.fn(async () => undefined);
    const executeMock = vi.fn(async (request: AIRequest): Promise<AIResult<unknown>> => ({
      operationId: request.operationId,
      operationType: request.operationType,
      operationVersion: 1,
      status: "succeeded",
      output: draft(),
      safetyDecision: "allowed",
      provenance: "ai_extracted",
      warnings: [],
      retryable: false,
    }));
    const execute = executeMock as unknown as AIRuntimeClient["execute"];
    const repo = repository();
    repo.saveDraft = saveDraft;

    const service = new SellerProductService({
      repository: repo,
      runtime: { execute },
      id: () => brandId<"EntityId">("session-1"),
      now: () => "2026-09-16T00:00:00.000Z",
    });

    const result = await service.generateDraft(context(), brandId<"EntityId">("session-1"), {
      operationId: "op-1",
      idempotencyKey: "idem-1",
      input: { callerPayloadMustBeIgnored: true },
      dataClassification: "internal",
      promptVersion: "seller-product-v1",
      outputSchemaVersion: "seller-product-draft-v1",
      policyVersion: "seller-product-policy-v1",
    });

    expect(executeMock).toHaveBeenCalledWith(expect.objectContaining({
      context: context(),
      sessionId: brandId<"EntityId">("session-1"),
      operationType: SELLER_AI_OPERATION_TYPES.extract,
      operationVersion: 1,
      input: {
        sessionId: brandId<"EntityId">("session-1"),
        inputs: [{
          id: brandId<"EntityId">("input-1"),
          sessionId: brandId<"EntityId">("session-1"),
          mediaAssetId: null,
          rawText: "Example product",
          inputHash: "hash-1",
          createdAt: "2026-09-16T00:00:00.000Z",
        }],
      },
      inputReference: brandId<"EntityId">("input-1"),
      inputHash: "hash-1",
    }));
    expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({
      provenance: [{ fieldPath: "name", provenance: "seller_input", confidence: "confirmed", sourceRefs: ["input-1"] }],
    }));
    expect(result.output).toEqual(draft());
  });

  it("rejects execution before provider runtime when a session has no persisted inputs", async () => {
    const repo = repository();
    repo.getInputs = vi.fn(async () => []);
    const execute = vi.fn();
    const service = new SellerProductService({
      repository: repo,
      runtime: { execute },
      id: () => brandId<"EntityId">("session-1"),
      now: () => "2026-09-16T00:00:00.000Z",
    });

    await expect(service.generateDraft(context(), brandId<"EntityId">("session-1"), {
      operationId: "op-empty",
      idempotencyKey: "idem-empty",
      input: { callerPayloadMustBeIgnored: true },
      dataClassification: "internal",
      promptVersion: "seller-product-v1",
      outputSchemaVersion: "seller-product-draft-v1",
      policyVersion: "seller-product-policy-v1",
    })).rejects.toThrow("has no persisted inputs");
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects inputs before persistence when neither media nor text is supplied", async () => {
    const addInput = vi.fn(async () => undefined);
    const repo = repository();
    repo.addInput = addInput;
    const service = new SellerProductService({
      repository: repo,
      runtime: { execute: vi.fn() },
      id: () => brandId<"EntityId">("session-1"),
      now: () => "2026-09-16T00:00:00.000Z",
    });

    await expect(service.addInput(context(), brandId<"EntityId">("session-1"), {})).rejects.toThrow(
      "Seller product input requires media or raw text",
    );
    expect(addInput).not.toHaveBeenCalled();
  });

  it("delegates draft review and confirmation with the caller-visible draft version", async () => {
    const reviewDraft = vi.fn(async () => undefined);
    const confirmDraft = vi.fn(async () => undefined);
    const repo = repository();
    repo.reviewDraft = reviewDraft;
    repo.confirmDraft = confirmDraft;
    const service = new SellerProductService({
      repository: repo,
      runtime: { execute: vi.fn() },
      id: () => brandId<"EntityId">("session-1"),
      now: () => "2026-09-16T00:00:00.000Z",
    });

    await service.reviewDraft(context(), brandId<"EntityId">("session-1"), 3);
    await service.confirmDraft(context(), brandId<"EntityId">("session-1"), 3);

    expect(reviewDraft).toHaveBeenCalledWith({ context: context(), sessionId: brandId<"EntityId">("session-1"), version: 3, now: "2026-09-16T00:00:00.000Z" });
    expect(confirmDraft).toHaveBeenCalledWith({ context: context(), sessionId: brandId<"EntityId">("session-1"), version: 3, now: "2026-09-16T00:00:00.000Z" });
  });

  it("returns cancellation outcome from the canonical repository", async () => {
    const cancelSession = vi.fn(async () => false);
    const repo = repository();
    repo.cancelSession = cancelSession;
    const service = new SellerProductService({
      repository: repo,
      runtime: { execute: vi.fn() },
      id: () => brandId<"EntityId">("session-1"),
      now: () => "2026-09-16T00:00:00.000Z",
    });

    await expect(service.cancelSession(context(), brandId<"EntityId">("session-1"))).resolves.toBe(false);
    expect(cancelSession).toHaveBeenCalledWith({ context: context(), sessionId: brandId<"EntityId">("session-1"), now: "2026-09-16T00:00:00.000Z" });
  });
});
