import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { VerificationRepository } from "./verification-repository";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "./client";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("reviewer-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "trust",
    operation: "trust.verification.create",
    locale: "en",
    timezone: "UTC",
  };
}

describe("VerificationRepository", () => {
  it("rejects a case outside the current organization", async () => {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return null as T | null; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch() { return []; },
    };
    const repository = new VerificationRepository(new D1Database(raw));

    await expect(repository.createCase(context(), {
      id: brandId<"EntityId">("case-1"),
      organizationId: brandId<"EntityId">("tenant-2"),
      workspaceId: brandId<"EntityId">("workspace-1"),
      subjectType: "business",
      subjectId: brandId<"EntityId">("business-1"),
      policyId: "business-verification",
      policyVersion: "2026-09",
      riskClass: "standard",
      now: "2026-09-22T00:00:00.000Z",
    })).rejects.toThrow("does not match request context");
  });

  it("requires case submission before later review states are introduced", async () => {
    let call = 0;
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() {
        call += 1;
        return {
          id: "case-1",
          organizationId: "tenant-1",
          workspaceId: "workspace-1",
          subjectType: "business",
          subjectId: "business-1",
          policyId: "business-verification",
          policyVersion: "2026-09",
          status: "submitted",
          riskClass: "standard",
          submittedAt: "2026-09-22T00:00:00.000Z",
          resolvedAt: null,
          expiresAt: null,
          createdAt: "2026-09-22T00:00:00.000Z",
          updatedAt: "2026-09-22T00:00:00.000Z",
        } as T;
      },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch() { return []; },
    };
    const repository = new VerificationRepository(new D1Database(raw));

    const result = await repository.submitCase(
      context(),
      brandId<"EntityId">("case-1"),
      "2026-09-22T00:00:00.000Z",
      "2026-09-22T00:00:01.000Z",
    );

    expect(result.status).toBe("submitted");
    expect(call).toBe(1);
  });
});
