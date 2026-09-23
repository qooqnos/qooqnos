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


  it("creates a notification and its policy decision plus outbox event in one batch", async () => {
    let firstCalls = 0;
    const notification = {
      id: "notification-2",
      organizationId: "tenant-1",
      workspaceId: "workspace-1",
      recipientReference: "customer-2",
      intent: "booking.confirmed",
      channel: "sms",
      templateReference: null,
      templateVersion: null,
      locale: "en",
      variablesJson: "{}",
      priority: "normal",
      status: "created",
      idempotencyKey: "tenant-1:booking:evt-2",
      scheduledAt: null,
      expiresAt: null,
      policyVersion: "1",
      lastPolicyEvaluatedAt: "2026-09-22T00:00:00.000Z",
      createdAt: "2026-09-22T00:00:00.000Z",
      updatedAt: "2026-09-22T00:00:00.000Z",
    };
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() {
        firstCalls += 1;
        const values: unknown[] = [
          null,
          {
            id: "policy-1",
            intentKey: "booking.confirmed",
            category: "transactional",
            requiresOptIn: 0,
            allowedChannelsJson: "[\"in_app\",\"whatsapp\",\"sms\",\"email\"]",
            policyVersion: "1",
            status: "active",
          },
          null,
          null,
          notification,
        ];
        return values[firstCalls - 1] as T;
      },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true, meta: { changes: 1 } }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch(statements) {
        expect(statements.length).toBe(3);
        return statements.map(() => ({ success: true, meta: { changes: 1 } }));
      },
    };
    const repository = new CommunicationRepository(new D1Database(raw));

    const result = await repository.createNotification(context(), {
      id: brandId<"EntityId">("notification-2"),
      recipientReference: "customer-2",
      intent: "booking.confirmed",
      channel: "sms",
      idempotencyKey: "tenant-1:booking:evt-2",
      now: "2026-09-22T00:00:00.000Z",
    });

    expect(result.id).toBe("notification-2");
    expect(result.status).toBe("created");
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
      policyVersion: "1",
      lastPolicyEvaluatedAt: "2026-09-22T00:00:00.000Z",
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
  });  it("suppresses marketing notifications when explicit opt-in is absent", async () => {
    let firstCalls = 0;
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() {
        firstCalls += 1;
        const values: unknown[] = [
          null,
          {
            id: "policy-2",
            intentKey: "marketing.campaign",
            category: "marketing",
            requiresOptIn: 1,
            allowedChannelsJson: "[\"in_app\",\"whatsapp\",\"sms\",\"email\"]",
            policyVersion: "1",
            status: "active",
          },
          null,
          null,
          {
            id: "notification-marketing",
            organizationId: "tenant-1",
            workspaceId: "workspace-1",
            recipientReference: "customer-3",
            intent: "marketing.campaign",
            channel: "email",
            templateReference: null,
            templateVersion: null,
            locale: null,
            variablesJson: null,
            priority: "normal",
            status: "suppressed",
            idempotencyKey: "tenant-1:marketing:evt-1",
            scheduledAt: null,
            expiresAt: null,
            policyVersion: "1",
            lastPolicyEvaluatedAt: "2026-09-22T00:00:00.000Z",
            createdAt: "2026-09-22T00:00:00.000Z",
            updatedAt: "2026-09-22T00:00:00.000Z",
          },
        ];
        return values[firstCalls - 1] as T;
      },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true, meta: { changes: 1 } }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch(statements) {
        expect(statements.length).toBe(2);
        return statements.map(() => ({ success: true, meta: { changes: 1 } }));
      },
    };
    const repository = new CommunicationRepository(new D1Database(raw));

    const result = await repository.createNotification(context(), {
      id: brandId<"EntityId">("notification-marketing"),
      recipientReference: "customer-3",
      intent: "marketing.campaign",
      channel: "email",
      idempotencyKey: "tenant-1:marketing:evt-1",
      now: "2026-09-22T00:00:00.000Z",
    });

    expect(result.status).toBe("suppressed");
  });


});
