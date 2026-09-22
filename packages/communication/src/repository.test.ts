import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { CommunicationRepository } from "./repository";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "communication",
    operation: "communication.notification.send",
    locale: "en",
    timezone: "UTC",
  };
}

describe("CommunicationRepository", () => {
  it("rejects empty message content", async () => {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return { id: "conversation-1", organizationId: "tenant-1", workspaceId: "workspace-1", customerId: null, status: "open", createdAt: "2026-09-22T00:00:00.000Z", updatedAt: "2026-09-22T00:00:00.000Z" } as T; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = { prepare() { return statement; }, async batch() { return []; } };
    const repository = new CommunicationRepository(new D1Database(raw));

    await expect(repository.sendMessage(context(), {
      id: brandId<"EntityId">("message-1"),
      conversationId: brandId<"EntityId">("conversation-1"),
      senderReference: "user-1",
      content: "   ",
      classification: "transactional",
      now: "2026-09-22T00:00:00.000Z",
    })).rejects.toThrow("content is required");
  });

  it("returns the existing notification for a repeated idempotency key", async () => {
    const existing = {
      id: "notification-1",
      organizationId: "tenant-1",
      workspaceId: "workspace-1",
      recipientReference: "customer-1",
      intent: "booking.confirmed",
      channel: "sms",
      templateReference: "booking-confirmed",
      templateVersion: "v1",
      locale: "en",
      variablesJson: "{}",
      priority: "normal",
      status: "created",
      idempotencyKey: "tenant-1:booking:evt-1",
      scheduledAt: null,
      expiresAt: null,
      lastPolicyEvaluatedAt: null,
      createdAt: "2026-09-22T00:00:00.000Z",
      updatedAt: "2026-09-22T00:00:00.000Z",
    };
    let writes = 0;
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return existing as T; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { writes += 1; return { success: true }; },
    };
    const raw: D1DatabaseLike = { prepare() { return statement; }, async batch() { return []; } };
    const repository = new CommunicationRepository(new D1Database(raw));

    const result = await repository.createNotification(context(), {
      id: brandId<"EntityId">("notification-new"),
      recipientReference: "customer-1",
      intent: "booking.confirmed",
      channel: "sms",
      idempotencyKey: "tenant-1:booking:evt-1",
      now: "2026-09-22T00:00:00.000Z",
    });

    expect(result.id).toBe("notification-1");
    expect(writes).toBe(0);
  });
});
