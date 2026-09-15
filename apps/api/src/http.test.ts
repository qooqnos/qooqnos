import { describe, expect, it } from "vitest";
import { AppError, brandId } from "@qooqnos/core";
import { errorResponse } from "./http";

describe("API error boundary", () => {
  it("maps application errors to stable HTTP responses", async () => {
    const requestId = brandId<"RequestId">("req-test");
    const response = errorResponse(
      new AppError({ code: "FORBIDDEN", message: "Access denied." }),
      requestId,
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("x-request-id")).toBe("req-test");
    await expect(response.json()).resolves.toEqual({
      error: { code: "FORBIDDEN", message: "Access denied." },
    });
  });

  it("does not expose unexpected internal errors", async () => {
    const requestId = brandId<"RequestId">("req-test");
    const response = errorResponse(new Error("database password leaked"), requestId);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    });
  });
});
