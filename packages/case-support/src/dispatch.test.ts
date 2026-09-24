/* @ts-nocheck */
import { describe, expect, it } from "vitest";
import { brandId } from "@qooqnos/core";
import {
  createCaseDispatchProviderRegistry,
  createHttpCaseDispatchProviderAdapter,
} from "./dispatch-adapter";

describe("case dispatch provider adapters", () => {
  it("rejects duplicate provider registrations", () => {
    expect(() => createCaseDispatchProviderRegistry([
      { providerId: "queue-a", dispatch: async () => ({ status: "accepted", providerId: "queue-a" }) },
      { providerId: "queue-a", dispatch: async () => ({ status: "accepted", providerId: "queue-a" }) },
    ])).toThrow("already registered");
  });

  it("classifies provider HTTP failures", async () => {
    const adapter = createHttpCaseDispatchProviderAdapter({
      providerId: "queue-a",
      baseUrl: "https://dispatch.example.test",
      dispatchPath: "/cases",
      credentialReference: "secret://case/queue-a",
      credentialResolver: { resolve: async () => ({ secret: "secret" }) },
      fetchImpl: async () => new Response(JSON.stringify({ code: "rate_limited" }), { status: 429 }),
    });
    await expect(adapter.dispatch({
      dispatchId: brandId<"EntityId">("dispatch-1"),
      caseId: brandId<"EntityId">("case-1"),
      assignmentId: brandId<"EntityId">("assignment-1"),
      queueId: brandId<"EntityId">("queue-1"),
      routeReference: null,
      idempotencyKey: "case-dispatch:assignment-1",
      organizationId: brandId<"EntityId">("org-1"),
      workspaceId: brandId<"EntityId">("ws-1"),
      caseTypeId: brandId<"EntityId">("type-1"),
      priority: "urgent",
      subjectType: "customer",
      subjectId: brandId<"EntityId">("customer-1"),
      requesterType: "customer",
      requesterId: brandId("customer-1"),
      correlationId: "dispatch-1",
    })).rejects.toMatchObject({ failureClass: "transient", failureCode: "rate_limited" });
  });

  it("sends provider credentials at runtime and returns normalized reference", async () => {
    let capturedHeaders: Headers | null = null;
    const adapter = createHttpCaseDispatchProviderAdapter({
      providerId: "queue-a",
      baseUrl: "https://dispatch.example.test",
      dispatchPath: "/cases",
      credentialReference: "secret://case/queue-a",
      credentialResolver: { resolve: async () => ({ secret: "secret" }) },
      fetchImpl: async (_url, init) => {
        capturedHeaders = new Headers(init?.headers);
        return new Response(JSON.stringify({ status: "accepted", externalReference: "ext-1" }), { status: 202 });
      },
    });
    const result = await adapter.dispatch({
      dispatchId: brandId("dispatch-1"),
      caseId: brandId("case-1"),
      assignmentId: brandId("assignment-1"),
      queueId: brandId("queue-1"),
      routeReference: "support-tier-2",
      idempotencyKey: "case-dispatch:assignment-1",
      organizationId: brandId("org-1"),
      workspaceId: brandId("ws-1"),
      caseTypeId: brandId("type-1"),
      priority: "high",
      subjectType: "customer",
      subjectId: brandId("customer-1"),
      requesterType: "customer",
      requesterId: brandId("customer-1"),
      correlationId: "dispatch-1",
    });
    expect(result).toMatchObject({ status: "accepted", externalReference: "ext-1", providerId: "queue-a" });
    expect(capturedHeaders).toMatchObject({
      authorization: "Bearer secret",
      "idempotency-key": "case-dispatch:assignment-1",
      "x-correlation-id": "dispatch-1",
    });
  });
});
