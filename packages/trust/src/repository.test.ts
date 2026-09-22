import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { TrustReviewRepository } from "./repository";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "trust",
    operation: "trust.review.create",
    locale: "en",
    timezone: "UTC",
  };
}

describe("TrustReviewRepository", () => {
  it("requires exactly one canonical typed review target", async () => {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return null as T | null; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = { prepare() { return statement; }, async batch() { return []; } };
    const repository = new TrustReviewRepository(new D1Database(raw));

    await expect(repository.createReview(context(), {
      id: brandId<"EntityId">("review-1"),
      customerId: brandId<"EntityId">("customer-1"),
      ratingValue: 5,
      businessId: brandId<"EntityId">("business-1"),
      offeringId: brandId<"EntityId">("offering-1"),
      now: "2026-09-22T00:00:00.000Z",
    })).rejects.toThrow("exactly one");
  });

  it("allows a canonical Product target", async () => {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return {
        id: "review-3",
        organizationId: "tenant-1",
        workspaceId: "workspace-1",
        customerId: "customer-1",
        ratingValue: 5,
        content: null,
        moderationState: "pending",
        status: "draft",
        interactionReference: null,
        locale: "en",
        publishedAt: null,
        policyVersion: "v1",
        contentVersion: 1,
        businessId: null,
        offeringId: null,
        productId: "product-1",
        createdAt: "2026-09-22T00:00:00.000Z",
        updatedAt: "2026-09-22T00:00:00.000Z"
      } as T; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = { prepare() { return statement; }, async batch() { return []; } };
    const repository = new TrustReviewRepository(new D1Database(raw));

    await expect(repository.createReview(context(), {
      id: brandId<"EntityId">("review-3"),
      customerId: brandId<"EntityId">("customer-1"),
      ratingValue: 5,
      productId: brandId<"EntityId">("product-1"),
      now: "2026-09-22T00:00:00.000Z",
    })).resolves.toMatchObject({ productId: "product-1" });
  });

  it("rejects ratings outside the canonical 1-5 range", async () => {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return null as T | null; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = { prepare() { return statement; }, async batch() { return []; } };
    const repository = new TrustReviewRepository(new D1Database(raw));

    await expect(repository.createReview(context(), {
      id: brandId<"EntityId">("review-2"),
      customerId: brandId<"EntityId">("customer-1"),
      ratingValue: 6,
      businessId: brandId<"EntityId">("business-1"),
      now: "2026-09-22T00:00:00.000Z",
    })).rejects.toThrow("between 1 and 5");
  });
});

  it("rejects Review risk confidence outside 0..1", async () => {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return {
        id: "review-4",
        organizationId: "tenant-1",
        workspaceId: "workspace-1",
        customerId: "customer-1",
        ratingValue: 5,
        content: null,
        moderationState: "pending",
        status: "draft",
        interactionReference: null,
        locale: "en",
        publishedAt: null,
        policyVersion: "v1",
        contentVersion: 1,
        businessId: "business-1",
        offeringId: null,
        productId: null,
        createdAt: "2026-09-22T00:00:00.000Z",
        updatedAt: "2026-09-22T00:00:00.000Z",
      } as T; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = { prepare() { return statement; }, async batch() { return []; } };
    const repository = new TrustReviewRepository(new D1Database(raw));

    await expect(repository.recordRiskSignal(context(), {
      id: brandId<"EntityId">("risk-1"),
      reviewId: brandId<"EntityId">("review-4"),
      signalType: "spam_probability",
      confidence: 1.2,
      source: "ai",
      now: "2026-09-22T00:00:00.000Z",
    })).rejects.toThrow("between 0 and 1");
  });

  it("rejects empty moderation policy references", async () => {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return {
        id: "review-5",
        organizationId: "tenant-1",
        workspaceId: "workspace-1",
        customerId: "customer-1",
        ratingValue: 4,
        content: null,
        moderationState: "pending",
        status: "draft",
        interactionReference: null,
        locale: "en",
        publishedAt: null,
        policyVersion: "v1",
        contentVersion: 1,
        businessId: "business-1",
        offeringId: null,
        productId: null,
        createdAt: "2026-09-22T00:00:00.000Z",
        updatedAt: "2026-09-22T00:00:00.000Z",
      } as T; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = { prepare() { return statement; }, async batch() { return []; } };
    const repository = new TrustReviewRepository(new D1Database(raw));

    await expect(repository.createResponse(context(), {
      id: brandId<"EntityId">("response-1"),
      reviewId: brandId<"EntityId">("review-5"),
      businessId: brandId<"EntityId">("business-1"),
      actorReference: "member-1",
      content: "Thanks",
      policyVersion: "",
      now: "2026-09-22T00:00:00.000Z",
    })).rejects.toThrow("policy version is required");
  });
