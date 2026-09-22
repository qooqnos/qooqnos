import { describe, expect, it } from "vitest";
import { createAuthorizationRegistry } from "@qooqnos/runtime";
import { ApiRouter } from "./router";

describe("Automation API routes", () => {
  it("registers protected workflow and execution routes", async () => {
    const router = new ApiRouter({ authorization: createAuthorizationRegistry() });

    const workflow = await router.handle(
      new Request("https://example.test/api/v1/automation/workflows", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "test", scope: "organization" }),
      }),
    );
    expect(workflow.status).toBe(401);

    const execution = await router.handle(
      new Request("https://example.test/api/v1/automation/workflows/wf-1/executions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workflowVersionId: "v1", triggerId: "t1" }),
      }),
    );
    expect(execution.status).toBe(401);
  });
});
