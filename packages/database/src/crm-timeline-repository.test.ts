import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { CrmTimelineRepository } from "./crm-timeline-repository";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "./client";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "crm",
    operation: "crm.timeline.append",
    locale: "en",
    timezone: "UTC",
  };
}

describe("CrmTimelineRepository", () => {
  it("enforces organization and workspace scope on reads", async () => {
    const statements: string[] = [];
    let firstCall = 0;
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
    const repository = new CrmTimelineRepository(new D1Database(raw));

    const result = await repository.get(context(), brandId<"EntityId">("timeline-foreign"));

    expect(result).toBeNull();
    expect(statements[0]).toContain("organization_id = ?");
    expect(statements[0]).toContain("workspace_id = ?");
  });

  it("is idempotent for the same source event", async () => {
    const batches: Array<readonly unknown[]> = [];
    let firstCall = 0;
    const existing = {
      id: "timeline-1",
      organizationId: "tenant-1",
      workspaceId: "workspace-1",
      relationshipId: "relationship-1",
      sourceModule: "booking",
      sourceEventId: "event-1",
      eventType: "booking.confirmed.v1",
      eventVersion: 1,
      occurredAt: "2026-09-22T00:00:00.000Z",
      receivedAt: "2026-09-22T00:01:00.000Z",
      actorReference: null,
      visibility: "relationship",
      redactionClass: "standard",
      payloadJson: "{\"bookingId\":\"booking-1\"}",
      projectionVersion: 1,
    };

    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() {
        firstCall += 1;
        if (firstCall === 1) return existing as T;
        return existing as T;
      },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch(statements) {
        batches.push(statements);
        return statements.map(() => ({ success: true }));
      },
    };
    const repository = new CrmTimelineRepository(new D1Database(raw));

    const result = await repository.append(context(), {
      id: brandId<"EntityId">("timeline-new"),
      relationshipId: brandId<"EntityId">("relationship-1"),
      sourceModule: "booking",
      sourceEventId: "event-1",
      eventType: "booking.confirmed.v1",
      eventVersion: 1,
      occurredAt: "2026-09-22T00:00:00.000Z",
      receivedAt: "2026-09-22T00:01:00.000Z",
      visibility: "relationship",
      redactionClass: "standard",
      projectionVersion: 1,
    });

    expect(result.id).toBe("timeline-1");
    expect(batches).toHaveLength(0);
  });

  it("atomically persists the event and its projection", async () => {
    const batches: Array<readonly D1PreparedStatementLike[]> = [];
    let firstCall = 0;
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() {
        if (firstCall++ === 0) return null;
        return {
          id: "timeline-2",
          organizationId: "tenant-1",
          workspaceId: "workspace-1",
          relationshipId: "relationship-1",
          sourceModule: "booking",
          sourceEventId: "event-2",
          eventType: "booking.completed.v1",
          eventVersion: 1,
          occurredAt: "2026-09-22T00:00:00.000Z",
          receivedAt: "2026-09-22T00:01:00.000Z",
          actorReference: null,
          visibility: "relationship",
          redactionClass: "standard",
          payloadJson: null,
          projectionVersion: 1,
        } as T;
      },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true, meta: { changes: 1 } }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch(statements) {
        batches.push(statements);
        return statements.map(() => ({ success: true, meta: { changes: 1 } }));
      },
    };
    const repository = new CrmTimelineRepository(new D1Database(raw));

    await repository.append(context(), {
      id: brandId<"EntityId">("timeline-2"),
      relationshipId: brandId<"EntityId">("relationship-1"),
      sourceModule: "booking",
      sourceEventId: "event-2",
      eventType: "booking.completed.v1",
      eventVersion: 1,
      occurredAt: "2026-09-22T00:00:00.000Z",
      receivedAt: "2026-09-22T00:01:00.000Z",
      visibility: "relationship",
      redactionClass: "standard",
      projectionVersion: 1,
    });

    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(2);
  });

});
