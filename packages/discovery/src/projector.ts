import type { EntityId, RequestContext } from "@qooqnos/core";
import { DiscoveryRepository, type SearchDocumentRecord } from "./repository";

export interface CatalogProductCreatedEvent {
  readonly eventType: "catalog.product.created";
  readonly eventVersion: 1;
  readonly payload: {
    readonly productId: EntityId;
    readonly businessId: EntityId;
    readonly name: string;
    readonly description: string | null;
  };
  readonly occurredAt: string;
}

export interface DiscoveryProjectorOptions {
  readonly repository: DiscoveryRepository;
}

/** Applies canonical domain events to the Discovery projection. */
export class DiscoveryProjector {
  constructor(private readonly options: DiscoveryProjectorOptions) {}

  async applyCatalogProductCreated(context: RequestContext, event: CatalogProductCreatedEvent): Promise<SearchDocumentRecord> {
    if (event.eventType !== "catalog.product.created" || event.eventVersion !== 1) {
      throw new Error("Unsupported catalog product event");
    }
    return this.options.repository.upsert({
      context,
      id: event.payload.productId,
      sourceType: "catalog.product",
      sourceId: event.payload.productId,
      documentVersion: 1,
      title: event.payload.name,
      ...(event.payload.description !== null ? { body: event.payload.description } : {}),
      metadata: { businessId: event.payload.businessId },
      eligibility: "ineligible",
      now: event.occurredAt,
    });
  }
}
