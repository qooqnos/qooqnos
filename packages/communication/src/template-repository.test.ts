import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { CommunicationRepository } from "./repository";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("admin-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "communication",
    operation: "communication.template.manage",
    locale: "en",
    timezone: "UTC",
  };
}

describe("CommunicationRepository template registry", () => {
  it("resolves only approved active templates in the tenant scope", async () => {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() {
        return {
          id: "template-version-1",
          templateId: "template-1",
          version: 1,
          locale: "en",
          variablesSchemaJson: JSON.stringify({ name: "string" }),
          contentReference: "r2://templates/booking-confirmed-v1",
          contentChecksum: "checksum-1",
          approvalState: "approved",
          effectiveFrom: null,
          effectiveTo: null,
          createdBy: "admin-1",
          createdAt: "2026-09-23T00:00:00.000Z",
          updatedAt: "2026-09-23T00:00:00.000Z",
        } as T;
      },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true, meta: { changes: 1 } }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch() { return []; },
    };
    const repository = new CommunicationRepository(new D1Database(raw));

    const result = await repository.getApprovedTemplateVersion(context(), {
      templateKey: "booking-confirmed",
      version: 1,
      channel: "sms",
      locale: "en",
      intent: "booking.confirmed",
      now: "2026-09-23T00:01:00.000Z",
    });

    expect(result.approvalState).toBe("approved");
    expect(result.contentReference).toContain("booking-confirmed");
  });
});
