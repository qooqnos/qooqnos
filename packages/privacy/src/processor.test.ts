import { describe, expect, it } from "vitest";
import { brandId } from "@qooqnos/core";
import { createPrivacyProcessorRegistry, type PrivacyProcessor } from "./processor";

describe("PrivacyProcessorRegistry", () => {
  const processor = (id: string): PrivacyProcessor => ({
    id,
    moduleId: "customer",
    requestTypes: ["export", "delete"],
    subjectTypes: ["customer"],
    async process() {
      return {
        status: "completed",
        processorId: id,
        action: "test",
      };
    },
  });

  it("resolves processors by request and subject type", () => {
    const registry = createPrivacyProcessorRegistry([processor("customer.export")]);
    expect(registry.resolve("export", "customer")).toHaveLength(1);
    expect(registry.resolve("delete", "user")).toHaveLength(0);
  });

  it("rejects duplicate processor ids", () => {
    expect(() =>
      createPrivacyProcessorRegistry([processor("duplicate"), processor("duplicate")]),
    ).toThrow("already registered");
  });

  it("keeps processor results independent from domain storage ownership", async () => {
    const registry = createPrivacyProcessorRegistry([processor("customer.export")]);
    const result = await registry.resolve("export", "customer")[0]!.process({
      request: {
        id: brandId<"EntityId">("req-1"),
        organizationId: brandId<"EntityId">("org-1"),
        workspaceId: null,
        subjectType: "customer",
        subjectId: brandId<"EntityId">("customer-1"),
        requestType: "export",
        status: "processing",
        requestedBy: "user-1",
        requestedAt: "2026-09-23T00:00:00.000Z",
        dueAt: null,
        completedAt: null,
        resultReference: null,
        rejectionReason: null,
        createdAt: "2026-09-23T00:00:00.000Z",
        updatedAt: "2026-09-23T00:00:00.000Z",
      },
      context: {
        requestId: brandId<"EntityId">("req-1"),
        organizationId: brandId<"EntityId">("org-1"),
        workspaceId: null,
        now: "2026-09-23T00:00:00.000Z",
        correlationId: "corr-1",
      },
    });
    expect(result.processorId).toBe("customer.export");
  });
});
