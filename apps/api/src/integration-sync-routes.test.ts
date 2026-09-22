import { describe, expect, it } from "vitest";
import { createAuthorizationRegistry } from "@qooqnos/runtime";
import { ApiRouter } from "./router";

describe("Integration sync API", () => {
  it("registers the protected sync-job route", async () => {
    const router = new ApiRouter({ authorization: createAuthorizationRegistry() });
    const response = await router.handle(
      new Request("https://example.test/api/v1/integrations/sync-jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          integrationAccountId: "account-1",
          syncType: "catalog.pull",
          direction: "inbound",
        }),
      }),
    );
    expect(response.status).toBe(401);
  });
});
