import { describe, expect, it } from "vitest";
import { createAuthorizationRegistry } from "@qooqnos/runtime";
import { ApiRouter } from "./router";

describe("Fulfillment API routes", () => {
  it("registers protected fulfillment commitment intake", async () => {
    const router = new ApiRouter({ authorization: createAuthorizationRegistry() });

    const response = await router.handle(
      new Request("https://example.test/api/v1/fulfillment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceType: "commerce_order",
          sourceId: "order-1",
          businessId: "business-1",
          fulfillmentType: "physical",
        }),
      }),
    );

    expect(response.status).toBe(401);
  });
});
