import { describe, expect, it } from "vitest";
import { createAuthorizationRegistry } from "@qooqnos/runtime";
import { ApiRouter } from "./router";

describe("Case Support API routes", () => {
  it("protects Case intake", async () => {
    const router = new ApiRouter({ authorization: createAuthorizationRegistry() });
    const response = await router.handle(
      new Request("https://example.test/api/v1/cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(response.status).toBe(401);
  });
});
