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
  it("requires exactly one typed review target", async () => {
    const statement: D1PreparedStatementLike = {
      bind(){ return this; },
      async first<T>() { return { id: "review-1" } as T; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = { prepare(){ return statement; }, async batch(){ return []; } };
    const repository = new TrustReviewRepository(new D1Database(raw));

    await expect(repository.createReview(context(), {
      id: brandId<"EntityId">("review-1"),
      customerId: brandId<"EntityId">("customer-1"),
      ratingValue: 5,
      now: "2026-09-22T00:00:00.000Z",
    } as never)).rejects.toThrow("exactly one");
  });
});
