import { describe, expect, it } from "vitest";
import { createAuthorizationRegistry } from "@qooqnos/runtime";
import { ApiRouter } from "./router";

describe("Privacy API routes", () => {
  it("registers protected Consent and Privacy Request routes", async () => {
    const router = new ApiRouter({ authorization: createAuthorizationRegistry() });

    const consent = await router.handle(
      new Request("https://example.test/api/v1/privacy/consents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subjectType: "customer",
          subjectId: "customer-1",
          purpose: "marketing",
          consentVersion: "v1",
          source: "web",
        }),
      }),
    );
    expect(consent.status).toBe(401);

    const request = await router.handle(
      new Request("https://example.test/api/v1/privacy/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subjectType: "customer",
          subjectId: "customer-1",
          requestType: "export",
          requestedBy: "customer-1",
        }),
      }),
    );
    expect(request.status).toBe(401);
  });
});
