import type { EntityId, RequestContext } from "@qooqnos/core";
import { DiscoveryProjector, type BusinessCreatedEvent, type BusinessPublicationChangedEvent, type CatalogProductCreatedEvent } from "./projector";
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
    if (event.eventType === "catalog.product.created" && event.eventVersion === 1) {
      const payload = parseCatalogProductCreatedPayload(event.payloadJson);
      const document = await this.projector.applyCatalogProductCreated(context, {
        eventType: "catalog.product.created",
        eventVersion: 1,
        payload,
        occurredAt: event.occurredAt,
      });
      return { status: "projected", eventId: event.id, documentId: document.id };
    }

    if (event.eventType === "business.created.v1" && event.eventVersion === 1) {
      const payload = parseBusinessCreatedPayload(event.payloadJson);
      const document = await this.projector.applyBusinessCreated(context, {
        eventType: "business.created.v1",
        eventVersion: 1,
        payload,
        occurredAt: event.occurredAt,
      });
      return { status: "projected", eventId: event.id, documentId: document.id };
    }

    if (event.eventType === "business.publication.changed.v1" && event.eventVersion === 1) {
      const payload = parseBusinessPublicationChangedPayload(event.payloadJson);
      const document = await this.projector.applyBusinessPublicationChanged(context, {
        eventType: "business.publication.changed.v1",
        eventVersion: 1,
        payload,
        occurredAt: event.occurredAt,
      });
      return { status: "projected", eventId: event.id, documentId: document.id };
    }

    return { status: "ignored", eventId: event.id, reason: "unsupported_event" };
  }
}


function parseBusinessCreatedPayload(payloadJson: string): BusinessCreatedEvent["payload"] {
  let parsed: unknown;
  try { parsed = JSON.parse(payloadJson); } catch { throw new Error("Invalid business.created.v1 payload JSON"); }
  if (!isRecord(parsed)
    || typeof parsed.businessId !== "string"
    || typeof parsed.organizationId !== "string"
    || typeof parsed.workspaceId !== "string"
    || typeof parsed.name !== "string"
    || typeof parsed.displayName !== "string"
    || !isPublicationStatus(parsed.publicationStatus)) {
    throw new Error("Invalid business.created.v1 payload");
  }
  return {
    businessId: parsed.businessId as EntityId,
    organizationId: parsed.organizationId as EntityId,
    workspaceId: parsed.workspaceId as EntityId,
    name: parsed.name,
    displayName: parsed.displayName,
    publicationStatus: parsed.publicationStatus,
  };
}

function parseBusinessPublicationChangedPayload(payloadJson: string): BusinessPublicationChangedEvent["payload"] {
  let parsed: unknown;
  try { parsed = JSON.parse(payloadJson); } catch { throw new Error("Invalid business.publication.changed.v1 payload JSON"); }
  if (!isRecord(parsed)
    || typeof parsed.businessId !== "string"
    || typeof parsed.organizationId !== "string"
    || typeof parsed.workspaceId !== "string"
    || typeof parsed.name !== "string"
    || typeof parsed.displayName !== "string"
    || typeof parsed.updatedAt !== "string"
    || !isPublicationStatus(parsed.publicationStatus)) {
    throw new Error("Invalid business.publication.changed.v1 payload");
  }
  return {
    businessId: parsed.businessId as EntityId,
    organizationId: parsed.organizationId as EntityId,
    workspaceId: parsed.workspaceId as EntityId,
    name: parsed.name,
    displayName: parsed.displayName,
    publicationStatus: parsed.publicationStatus,
    updatedAt: parsed.updatedAt,
  };
}

function isPublicationStatus(value: unknown): value is BusinessCreatedEvent["payload"]["publicationStatus"] {
  return value === "unpublished" || value === "pending" || value === "published" || value === "blocked";
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
