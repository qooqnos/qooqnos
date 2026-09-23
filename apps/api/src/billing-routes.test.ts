import { describe, expect, it } from "vitest";
import { createAuthorizationRegistry } from "@qooqnos/runtime";
import { ApiRouter } from "./router";

describe("Billing API routes", () => {
  it("protects the Billing plan listing surface", async () => {
    const router = new ApiRouter({ authorization: createAuthorizationRegistry() });
    const response = await router.handle(
      new Request("https://example.test/api/v1/billing/plans", { method: "GET" }),
    );

    expect(response.status).toBe(401);
  });
});
