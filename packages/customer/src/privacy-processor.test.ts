import { describe, expect, it, vi } from "vitest";
import { brandId } from "@qooqnos/core";
import { createCustomerPrivacyProcessors } from "./privacy-processor";

describe("Customer privacy processors", () => {
  const repository = {
    privacyExport: vi.fn(async () => ({
      customer: {
        id: brandId<"EntityId">("customer-1"),
        organizationId: brandId<"EntityId">("org-1"),
        userId: null,
        status: "active" as const,
        locale: "en",
        timezone: "UTC",
        createdAt: "2026-09-24T00:00:00.000Z",
        updatedAt: "2026-09-24T00:00:00.000Z",
      },
      preferences: [{ id: brandId<"EntityId">("pref-1") }],
      addresses: [{ id: brandId<"EntityId">("address-1") }],
    })),
    privacyAnonymize: vi.fn(async () => undefined),
  };

  const request = {
    request: {
      id: brandId<"EntityId">("request-1"),
      organizationId: brandId<"EntityId">("org-1"),
      workspaceId: null,
      subjectType: "customer" as const,
      subjectId: brandId<"EntityId">("customer-1"),
      requestType: "export" as const,
      status: "processing" as const,
      requestedBy: "actor-1",
      requestedAt: "2026-09-24T00:00:00.000Z",
      dueAt: null,
      completedAt: null,
      resultReference: null,
      rejectionReason: null,
      createdAt: "2026-09-24T00:00:00.000Z",
      updatedAt: "2026-09-24T00:00:00.000Z",
    },
    context: {
      requestId: brandId<"EntityId">("request-1"),
      organizationId: brandId<"EntityId">("org-1"),
      workspaceId: null,
      now: "2026-09-24T00:00:00.000Z",
      correlationId: "privacy:request-1",
    },
  };

  it("exports customer-owned profile resources", async () => {
    const processor = createCustomerPrivacyProcessors({ repository: repository as never })[0]!;
    const result = await processor.process(request);
    expect(result.status).toBe("completed");
    expect(result.resultReference).toBe("privacy-export:request-1");
    expect(result.resourceReferences).toEqual(["customer-1", "pref-1", "address-1"]);
    expect(repository.privacyExport).toHaveBeenCalled();
  });

  it("anonymizes customer-owned data for delete requests", async () => {
    const processor = createCustomerPrivacyProcessors({ repository: repository as never })[1]!;
    const result = await processor.process({
      ...request,
      request: { ...request.request, requestType: "delete" as const },
    });
    expect(result.status).toBe("completed");
    expect(result.resultReference).toBe("privacy-delete:request-1");
    expect(repository.privacyAnonymize).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "org-1" }),
      "customer-1",
      "2026-09-24T00:00:00.000Z",
    );
  });
});
