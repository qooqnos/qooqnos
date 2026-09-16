import type { EntityId, RequestContext } from "@qooqnos/core";
import { DiscoveryProjector, type CatalogProductCreatedEvent } from "./projector";
import type { DiscoveryRepository } from "./repository";

export interface DiscoveryOutboxEvent {
  readonly id: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly payloadJson: string;
  readonly occurredAt: string;
}

export interface DiscoveryOutboxProcessorOptions {
  readonly repository: DiscoveryRepository;
}

export type DiscoveryProjectionResult =
  | { readonly status: "projected"; readonly eventId: string; readonly documentId: EntityId }
  | { readonly status: "ignored"; readonly eventId: string; readonly reason: "unsupported_event" };

/** Dispatches durable outbox events into the Discovery projection. Projection writes are monotonic and therefore safe to retry. */
export class DiscoveryOutboxProcessor {
  private readonly projector: DiscoveryProjector;

  constructor(options: DiscoveryOutboxProcessorOptions) {
    this.projector = new DiscoveryProjector({ repository: options.repository });
  }

  async process(context: RequestContext, event: DiscoveryOutboxEvent): Promise<DiscoveryProjectionResult> {
    if (event.eventType !== "catalog.product.created" || event.eventVersion !== 1) {
      return { status: "ignored", eventId: event.id, reason: "unsupported_event" };
    }

    const payload = parseCatalogProductCreatedPayload(event.payloadJson);
    const document = await this.projector.applyCatalogProductCreated(context, {
      eventType: "catalog.product.created",
      eventVersion: 1,
      payload,
      occurredAt: event.occurredAt,
    });
    return { status: "projected", eventId: event.id, documentId: document.id };
  }
}

function parseCatalogProductCreatedPayload(payloadJson: string): CatalogProductCreatedEvent["payload"] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadJson);
  } catch {
    throw new Error("Invalid catalog.product.created payload JSON");
  }
  if (!isRecord(parsed) || typeof parsed.productId !== "string" || typeof parsed.businessId !== "string" || typeof parsed.name !== "string") {
    throw new Error("Invalid catalog.product.created payload");
  }
  return {
    productId: parsed.productId as EntityId,
    businessId: parsed.businessId as EntityId,
    name: parsed.name,
    description: typeof parsed.description === "string" ? parsed.description : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
