import { describe, expect, it } from "vitest";
import { createAuthorizationRegistry } from "@qooqnos/runtime";
import { ApiRouter } from "./router";

describe("Integration API routes", () => {
  it("registers protected account and webhook routes", async () => {
    const router = new ApiRouter({ authorization: createAuthorizationRegistry() });

    const account = await router.handle(
      new Request("https://example.test/api/v1/integrations/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerId: "provider-1",
          accountType: "marketplace",
          externalAccountReference: "external-1",
        }),
      }),
    );
    expect(account.status).toBe(401);

    const webhook = await router.handle(
      new Request("https://example.test/api/v1/integrations/webhooks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          integrationAccountId: "account-1",
          externalEventId: "event-1",
          eventType: "booking.confirmed",
          signatureStatus: "verified",
        }),
      }),
    );
    expect(webhook.status).toBe(401);
  });
});
