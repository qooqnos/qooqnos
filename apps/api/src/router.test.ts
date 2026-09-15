import { describe, expect, it } from "vitest";
import { ApiRouter } from "./router";

function router(): ApiRouter {
  const instance = new ApiRouter();
  instance.register({
    method: "GET",
    path: "/health",
    module: "platform",
    operation: "health.read",
    handler: ({ context }) =>
      new Response(JSON.stringify({ requestId: context.requestId }), {
        headers: { "content-type": "application/json" },
      }),
  });
  return instance;
}

describe("ApiRouter", () => {
  it("creates trusted request and correlation context", async () => {
    const response = await router().handle(
      new Request("https://example.test/health", {
        headers: {
          "x-request-id": "req-test-1",
          "x-correlation-id": "cor-test-1",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("req-test-1");
    expect(response.headers.get("x-correlation-id")).toBe("cor-test-1");
    await expect(response.json()).resolves.toEqual({ requestId: "req-test-1" });
  });

  it("returns a structured 404 for an unregistered route", async () => {
    const response = await router().handle(new Request("https://example.test/missing"));

    expect(response.status).toBe(404);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "NOT_FOUND", message: "Route not found." },
    });
  });

  it("rejects duplicate method/path registrations", () => {
    const instance = router();

    expect(() =>
      instance.register({
        method: "GET",
        path: "/health",
        module: "platform",
        operation: "health.duplicate",
        handler: () => new Response("duplicate"),
      }),
    ).toThrow("Duplicate API route: GET /health");
  });
});
