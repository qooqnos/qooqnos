import type { EntityId, RequestContext } from "@qooqnos/core";
import type { FulfillmentRepository, ShipmentRecord } from "./repository";

export interface FulfillmentTrackingEvent {
  readonly externalEventId?: string;
  readonly eventType: string;
  readonly occurredAt: string;
  readonly source: string;
  readonly locationRef?: string;
  readonly normalizedStatus: string;
  readonly providerPayloadRef?: string;
  readonly eventVersion?: number;
  readonly deduplicationKey: string;
}

export interface FulfillmentProviderRequest {
  readonly shipment: ShipmentRecord;
  readonly context: RequestContext;
  readonly now: string;
}

export interface FulfillmentProviderResult {
  readonly status: "no_change" | "updated";
  readonly trackingEvents: readonly FulfillmentTrackingEvent[];
}

export interface FulfillmentProviderAdapter {
  readonly providerId: string;
  readonly supportedCarrierRefs: readonly string[];
  refreshShipment(
    request: FulfillmentProviderRequest,
    repository: FulfillmentRepository,
  ): Promise<FulfillmentProviderResult>;
}

export interface FulfillmentProviderRegistry {
  resolve(providerId: string): FulfillmentProviderAdapter | null;
}

export function createFulfillmentProviderRegistry(
  adapters: readonly FulfillmentProviderAdapter[] = [],
): FulfillmentProviderRegistry {
  const providers = new Map<string, FulfillmentProviderAdapter>();

  for (const adapter of adapters) {
    if (!adapter.providerId.trim()) throw new Error("Fulfillment providerId is required");
    if (providers.has(adapter.providerId)) {
      throw new Error("Fulfillment provider already registered: " + adapter.providerId);
    }
    providers.set(adapter.providerId, adapter);
  }

  return {
    resolve(providerId) {
      return providers.get(providerId) ?? null;
    },
  };
}

export async function applyProviderTracking(
  repository: FulfillmentRepository,
  context: RequestContext,
  shipment: ShipmentRecord,
  providerResult: FulfillmentProviderResult,
  id: () => EntityId,
  now: string,
): Promise<void> {
  for (const event of providerResult.trackingEvents) {
    await repository.recordTrackingEvent(context, {
      id: id(),
      shipmentId: shipment.id,
      ...event,
      now,
    });
  }
}
