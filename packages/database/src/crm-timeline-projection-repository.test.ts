import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { CrmTimelineProjectionRepository } from "./crm-timeline-projection-repository";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "./client";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "crm",
    operation: "crm.timeline.project",
    locale: "en",
    timezone: "UTC",
  };
}

describe("CrmTimelineProjectionRepository", () => {
  it("projects a source event with relationship-derived customer/business keys", async () => {
    const statements: string[] = [];
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() {
        return {
          id: "projection-1",
          organizationId: "tenant-1",
          workspaceId: "workspace-1",
          relationshipId: "relationship-1",
          customerId: "customer-1",
          businessId: "business-1",
          timelineEventId: "timeline-1",
          sourceModule: "booking",
          sourceEventId: "event-1",
          eventType: "booking.confirmed.v1",
          eventVersion: 1,
          occurredAt: "2026-09-22T00:00:00.000Z",
          receivedAt: "2026-09-22T00:01:00.000Z",
          actorReference: null,
          visibility: "relationship",
          redactionClass: "standard",
          projectionVersion: 1,
          projectedAt: "2026-09-22T00:01:00.000Z",
          createdAt: "2026-09-22T00:01:00.000Z",
          updatedAt: "2026-09-22T00:01:00.000Z",
        } as T;
      },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true, meta: { changes: 1 } }; },
    };
    const raw: D1DatabaseLike = {
      prepare(sql: string) { statements.push(sql); return statement; },
      async batch() { return []; },
    };
    const repository = new CrmTimelineProjectionRepository(new D1Database(raw));

    const result = await repository.project(context(), brandId<"EntityId">("timeline-1"), "2026-09-22T00:01:00.000Z");

    expect(result?.timelineEventId).toBe("timeline-1");
    expect(statements[0]).toContain("ON CONFLICT(timeline_event_id) DO UPDATE");
    expect(statements[0]).toContain("excluded.projection_version > crm_timeline_projections.projection_version");
  });

  it("rebuilds a workspace from canonical timeline events, never from the projection", async () => {
    const statements: string[] = [];
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return null as T | null; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true, meta: { changes: 0 } }; },
    };
    const raw: D1DatabaseLike = {
      prepare(sql: string) { statements.push(sql); return statement; },
      async batch(batchStatements) {
        return batchStatements.map((_, index) => ({
          success: true,
          meta: { changes: index === 1 ? 3 : 3 },
        }));
      },
    };
    const repository = new CrmTimelineProjectionRepository(new D1Database(raw));

    const count = await repository.rebuild(context(), { type: "workspace" }, "2026-09-24T00:00:00.000Z");

    expect(count).toBe(3);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain("DELETE FROM crm_timeline_projections");
    expect(statements[1]).toContain("FROM crm_timeline_events e");
    expect(statements[1]).not.toContain("FROM crm_timeline_projections");
    expect(statements[1]).toContain("ORDER BY e.occurred_at ASC, e.id ASC");
  });
});
