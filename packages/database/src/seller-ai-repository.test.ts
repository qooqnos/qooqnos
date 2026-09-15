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
    const session = await repository.getSession(context(), brandId<"EntityId">("session-foreign"));

    expect(session).toBeNull();
    const lookup = statements.find((sql) => sql.includes("FROM seller_ai_creation_sessions"));
    expect(lookup).toContain("organization_id = ?");
    expect(lookup).toContain("workspace_id = ?");
  });

  it("checks media assets against the session scope before inserting input", async () => {
    const statements: string[] = [];
    const session = {
      id: "session-1",
      organizationId: "tenant-1",
      workspaceId: "workspace-1",
      actorId: "user-1",
      status: "initiated",
      currentDraftVersion: 0,
      createdAt: "2026-09-16T00:00:00.000Z",
      updatedAt: "2026-09-16T00:00:00.000Z",
    };
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return session as T; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
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
});
