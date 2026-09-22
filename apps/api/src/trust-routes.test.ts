import { describe, expect, it } from "vitest";
import { ApiRouter } from "./router";

describe("Trust API routes", () => {
  it("registers protected Review and Verification routes", async () => {
    const router = new ApiRouter();
    const reviewResponse = await router.handle(
      new Request("https://example.test/api/v1/trust/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerId: "customer-1",
          ratingValue: 5,
          businessId: "business-1",
        }),
      }),
    );

    expect(reviewResponse.status).toBe(401);

    const verificationResponse = await router.handle(
      new Request("https://example.test/api/v1/trust/verification-cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subjectType: "business",
          subjectId: "business-1",
          policyId: "business-verification",
          policyVersion: "v1",
          riskClass: "standard",
        }),
      }),
    );

    expect(verificationResponse.status).toBe(401);
  });
});
