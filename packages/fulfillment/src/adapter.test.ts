import { describe, expect, it } from "vitest";
import { createFulfillmentProviderRegistry } from "./adapter";

describe("FulfillmentProviderRegistry", () => {
  it("rejects duplicate provider registrations", () => {
    const adapter = {
      providerId: "carrier-1",
      supportedCarrierRefs: ["carrier-1"],
      async refreshShipment() {
        return { status: "no_change" as const, trackingEvents: [] };
      },
    };

    expect(() => createFulfillmentProviderRegistry([adapter, adapter])).toThrow(
      "already registered",
    );
  });

  it("resolves registered providers without exposing provider SDKs", () => {
    const adapter = {
      providerId: "carrier-1",
      supportedCarrierRefs: ["carrier-1"],
      async refreshShipment() {
        return {
          status: "updated" as const,
          trackingEvents: [
            {
              eventType: "in_transit",
              occurredAt: "2026-09-23T00:00:00.000Z",
              source: "carrier",
              normalizedStatus: "in_transit",
              deduplicationKey: "carrier-evt-1",
            },
          ],
        };
      },
    };

    const registry = createFulfillmentProviderRegistry([adapter]);
    expect(registry.resolve("carrier-1")).toBe(adapter);
    expect(registry.resolve("missing")).toBeNull();
  });
});
