import { describe, expect, it } from "vitest";
import { DiscoveryOutboxProcessor } from "./outbox-processor";
import type { SearchDocumentRecord } from "./repository";

const context = {
  requestId: "req_1" as never,
  correlationId: "cor_1" as never,
  tenantId: "org_1" as never,
  workspaceId: "ws_1" as never,
  actorId: "user_1" as never,
  module: "discovery",
  operation: "discovery.project",
  locale: "en-US",
  timezone: "UTC",
};

describe("DiscoveryOutboxProcessor", () => {
  it("projects a versioned catalog product event", async () => {
    let received: unknown;
    const repository = {
      upsert: async (input: unknown): Promise<SearchDocumentRecord> => {
        received = input;
        return {
          id: "product_1" as never,
          organizationId: "org_1" as never,
          workspaceId: "ws_1" as never,
          sourceType: "catalog.product",
          sourceId: "product_1" as never,
          documentVersion: 1,
          title: "Test product",
          body: "Description",
          metadata: { businessId: "business_1" },
          eligibility: "ineligible",
          createdAt: "2026-09-16T10:00:00.000Z",
          updatedAt: "2026-09-16T10:00:00.000Z",
        };
      },
    };

    const result = await new DiscoveryOutboxProcessor({ repository: repository as never }).process(context, {
      id: "event_1",
      eventType: "catalog.product.created",
      eventVersion: 1,
      payloadJson: JSON.stringify({ productId: "product_1", businessId: "business_1", name: "Test product", description: "Description" }),
      occurredAt: "2026-09-16T10:00:00.000Z",
    });

    expect(result).toEqual({ status: "projected", eventId: "event_1", documentId: "product_1" });
    expect(received).toMatchObject({
      id: "product_1",
      sourceType: "catalog.product",
      sourceId: "product_1",
      title: "Test product",
      body: "Description",
      eligibility: "ineligible",
    });
  });

  it("ignores unsupported event versions without touching the projection", async () => {
    let called = false;
    const repository = { upsert: async (): Promise<never> => { called = true; throw new Error("must not project"); } };
    const result = await new DiscoveryOutboxProcessor({ repository: repository as never }).process(context, {
      id: "event_2",
      eventType: "catalog.product.created",
      eventVersion: 2,
      payloadJson: "{}",
      occurredAt: "2026-09-16T10:00:00.000Z",
    });

    expect(result).toEqual({ status: "ignored", eventId: "event_2", reason: "unsupported_event" });
    expect(called).toBe(false);
  });

  it("rejects malformed supported event payloads", async () => {
    const repository = { upsert: async (): Promise<never> => { throw new Error("must not project"); } };
    await expect(new DiscoveryOutboxProcessor({ repository: repository as never }).process(context, {
      id: "event_3",
      eventType: "catalog.product.created",
      eventVersion: 1,
      payloadJson: JSON.stringify({ productId: "product_1", businessId: "business_1" }),
      occurredAt: "2026-09-16T10:00:00.000Z",
    })).rejects.toThrow("Invalid catalog.product.created payload");
  });
});
