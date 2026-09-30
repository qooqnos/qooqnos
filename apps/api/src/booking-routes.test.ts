import { describe, expect, it } from "vitest";
import { createAuthorizationRegistry } from "@qooqnos/runtime";
import { ApiRouter } from "./router";

describe("Booking API routes", () => {
  it("protects the business-scoped booking list", async () => {
    const router = new ApiRouter({ authorization: createAuthorizationRegistry() });

    const response = await router.handle(
      new Request("https://example.test/api/v1/booking?businessId=business-1", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(401);
  });
});
