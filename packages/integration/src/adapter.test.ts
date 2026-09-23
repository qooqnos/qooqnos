import { describe, expect, it } from "vitest";
import { createIntegrationProviderRegistry } from "./adapter";

describe("IntegrationProviderRegistry", () => {
  it("rejects duplicate provider registrations", () => {
    const adapter = {
      providerId: "provider-1",
      supportedWebhookTypes: ["event"],
      supportedSyncTypes: ["contacts"],
      async processWebhook() {
        return { status: "ignored" as const };
      },
      async processSync() {
        return { status: "ignored" as const };
      },
    };

    expect(() => createIntegrationProviderRegistry([adapter, adapter])).toThrow(
      "already registered",
    );
  });

  it("resolves adapters by provider id", () => {
    const adapter = {
      providerId: "provider-1",
      supportedWebhookTypes: ["event"],
      supportedSyncTypes: ["contacts"],
      async processWebhook() {
        return { status: "processed" as const };
      },
      async processSync() {
        return { status: "processed" as const };
      },
    };

    const registry = createIntegrationProviderRegistry([adapter]);
    expect(registry.resolve("provider-1")).toBe(adapter);
    expect(registry.resolve("missing")).toBeNull();
  });
});
