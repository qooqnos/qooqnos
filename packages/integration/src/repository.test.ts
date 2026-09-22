import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { IntegrationRepository } from "./repository";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "integration",
    operation: "integration.webhook.receive",
    locale: "en",
    timezone: "UTC",
  };
}

describe("IntegrationRepository", () => {
  it("is idempotent for repeated external webhook ids", async () => {
    const existing = {
      id: "webhook-1", integrationAccountId: "account-1", externalEventId: "evt-1",
      eventType: "booking.confirmed", signatureStatus: "verified",
      receivedAt: "2026-09-22T00:00:00.000Z", payloadReference: null,
      processingStatus: "received", processedAt: null, retryCount: 0,
      lastErrorReference: null, correlationId: "corr-1"
    };
    let writes=0;
    const statement:D1PreparedStatementLike={
      bind(){return this;},async first<T>(){return existing as T;},async all<T>(){return {results:[] as T[]};},
      async run(){writes+=1;return {success:true};}
    };
    const raw:D1DatabaseLike={prepare(){return statement;},async batch(){return[];}};
    const repository=new IntegrationRepository(new D1Database(raw));
    const result=await repository.recordWebhook(context(),{
      id:brandId<"EntityId">("webhook-new"),
      integrationAccountId:brandId<"EntityId">("account-1"),
      externalEventId:"evt-1",eventType:"booking.confirmed",signatureStatus:"verified",
      correlationId:"corr-1",now:"2026-09-22T00:00:01.000Z"
    });
    expect(result.id).toBe("webhook-1");
    expect(writes).toBe(0);
  });
});
