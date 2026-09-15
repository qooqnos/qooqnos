import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "./client";
import { SellerAIRepository } from "./seller-ai-repository";

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

const session = {
  id: brandId<"EntityId">("session-1"),
  organizationId: brandId<"EntityId">("tenant-1"),
  workspaceId: brandId<"EntityId">("workspace-1"),
  actorId: brandId<"EntityId">("user-1"),
  status: "draft_ready",
  currentDraftVersion: 3,
  createdAt: "2026-09-16T00:00:00.000Z",
  updatedAt: "2026-09-16T00:00:00.000Z",
};

describe("SellerAIRepository", () => {
  it("scopes seller AI sessions to tenant and workspace", async () => {
    const statements: string[] = [];
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return null as T | null; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare(sql: string) { statements.push(sql); return statement; },
      async batch() { return []; },
    };

    const repository = new SellerAIRepository(new D1Database(raw));
    const result = await repository.getSession(context(), brandId<"EntityId">("session-foreign"));

    expect(result).toBeNull();
    const lookup = statements.find((sql) => sql.includes("FROM seller_ai_creation_sessions"));
    expect(lookup).toContain("organization_id = ?");
    expect(lookup).toContain("workspace_id = ?");
  });

  it("checks media assets against the session scope before inserting input", async () => {
    const statements: string[] = [];
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return session as T; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true, meta: { changes: 1 } }; },
    };
    const raw: D1DatabaseLike = {
      prepare(sql: string) { statements.push(sql); return statement; },
      async batch() { return []; },
    };

    const repository = new SellerAIRepository(new D1Database(raw));
    await repository.addInput(context(), {
      id: brandId<"EntityId">("input-1"),
      sessionId: brandId<"EntityId">("session-1"),
      mediaAssetId: brandId<"EntityId">("asset-1"),
      inputHash: "hash",
      now: "2026-09-16T00:00:00.000Z",
    });

    const assetLookup = statements.find((sql) => sql.includes("FROM media_assets"));
    expect(assetLookup).toContain("organization_id = ?");
    expect(assetLookup).toContain("workspace_id = ?");
    expect(assetLookup).toContain("status <> 'deleted'");
  });

  it("requires draft review before confirmation and scopes both transitions", async () => {
    const statements: string[] = [];
    const draft = { id: brandId<"EntityId">("draft-1"), sessionId: session.id, version: 3, status: "seller_review", draftJson: "{}", createdAt: session.createdAt, updatedAt: session.updatedAt };
    let firstCalls = 0;
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() {
        firstCalls += 1;
        return (firstCalls % 2 === 1 ? session : draft) as unknown as T;
      },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true, meta: { changes: 1 } }; },
    };
    const raw: D1DatabaseLike = {
      prepare(sql: string) { statements.push(sql); return statement; },
      async batch() { return [{ success: true, meta: { changes: 1 } }, { success: true, meta: { changes: 1 } }]; },
    };

    const repository = new SellerAIRepository(new D1Database(raw));
    await repository.reviewDraft(context(), session.id, 3, "2026-09-16T00:01:00.000Z");
    await repository.confirmDraft(context(), session.id, 3, "2026-09-16T00:02:00.000Z");

    const reviewSql = statements.find((sql) => sql.includes("status = 'seller_review'"));
    const confirmSql = statements.find((sql) => sql.includes("status = 'confirmed'"));
    expect(reviewSql).toContain("status = 'draft'");
    expect(reviewSql).toContain("session_id = ?");
    expect(confirmSql).toContain("status = 'seller_review'");
    expect(confirmSql).toContain("session_id = ?");
  });

  it("cancels only live sessions and preserves terminal lifecycle states", async () => {
    const statements: string[] = [];
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return session as T; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true, meta: { changes: 1 } }; },
    };
    const raw: D1DatabaseLike = {
      prepare(sql: string) { statements.push(sql); return statement; },
      async batch() { return []; },
    };

    const repository = new SellerAIRepository(new D1Database(raw));
    await expect(repository.cancelSession(context(), session.id, "2026-09-16T00:03:00.000Z")).resolves.toBe(true);

    const cancelSql = statements.find((sql) => sql.includes("status = 'cancelled'"));
    expect(cancelSql).toContain("status NOT IN ('published','cancelled','expired')");
    expect(cancelSql).toContain("organization_id = ?");
    expect(cancelSql).toContain("workspace_id = ?");
  });
});
