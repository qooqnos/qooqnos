import { CommunicationRepository } from "@qooqnos/communication";
import { MatchingLearningRepository, MatchingOutcomeProcessor } from "@qooqnos/matching";
import { DiscoveryOutboxProcessor, DiscoveryRepository } from "@qooqnos/discovery";
import { brandId } from "@qooqnos/core";
import { AnalyticsRepository, AnalyticsValidationError, OutboxService, type OutboxEventRecord } from "@qooqnos/database";
import { getDatabase } from "./database";
import { createRequestContext } from "./context";
import type { ApiEnv } from "./env";
import { processCaseDispatch } from "./case-dispatch-worker";
import { enqueueSeoPublication } from "@qooqnos/seo";
import { CatalogRepository } from "@qooqnos/catalog";
import { BusinessRepository } from "@qooqnos/business";

export interface ScheduledControllerLike {
  readonly scheduledTime: number;
}

export interface QueueMessageLike<T> {
  readonly body: T;
  ack(): void;
  retry(): void;
}

export interface QueueBatchLike<T> {
  readonly messages: readonly QueueMessageLike<T>[];
}

export async function publishPendingOutbox(
  env: ApiEnv,
  now = new Date().toISOString(),
  limit = 50,
): Promise<{ published: number; failed: number }> {
  const database = getDatabase(env);
  const queue = env.OUTBOX_QUEUE;
  if (!database || !queue) return { published: 0, failed: 0 };

  const outbox = new OutboxService(database);
  const events = await outbox.listPending(now, limit);
  let published = 0;
  let failed = 0;

  for (const event of events) {
    const leaseUntil = new Date(Date.parse(now) + 60_000).toISOString();
    const claimed = await outbox.claimPending(event.id, now, leaseUntil);
    if (!claimed) continue;

    try {
      await queue.send(event);
      await outbox.markPublished(event.id, new Date().toISOString());
      published += 1;
    } catch {
      await outbox.scheduleRetry(
        event.id,
        retryAt(event.attempts + 1, now),
      );
      failed += 1;
    }
  }

  return { published, failed };
}

export async function consumeOutbox(
  env: ApiEnv,
  batch: QueueBatchLike<OutboxEventRecord>,
): Promise<{ processed: number }> {
  const database = getDatabase(env);
  const communication = database ? new CommunicationRepository(database) : null;
  const discovery = database ? new DiscoveryOutboxProcessor({ repository: new DiscoveryRepository(database) }) : null;
  const matchingOutcomes = database ? new MatchingOutcomeProcessor({ learning: new MatchingLearningRepository(database), database }) : null;
  const analytics = database ? new AnalyticsRepository(database) : null;
  const catalog = database ? new CatalogRepository(database) : null;
  const business = database ? new BusinessRepository(database) : null;

  for (const message of batch.messages) {
    try {
      const event = message.body;

      if (analytics) {
        const analyticsContext = createRequestContext({
          module: "analytics",
          operation: "analytics.event.ingest",
          actorId: "system",
          tenantId: event.organizationId ?? undefined,
          workspaceId: event.workspaceId ?? undefined,
          correlationId: event.id,
          requestId: event.id,
          authenticated: true,
        });
        try {
          await analytics.ingestOutboxEvent(analyticsContext, {
            id: event.id,
            eventType: event.eventType,
            eventVersion: event.eventVersion,
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            organizationId: event.organizationId,
            workspaceId: event.workspaceId,
            payloadJson: event.payloadJson,
            occurredAt: event.occurredAt,
          }, new Date().toISOString());
        } catch (error) {
          if (!(error instanceof AnalyticsValidationError)) throw error;
          await analytics.quarantineOutboxEvent(
            {
              id: event.id,
              eventType: event.eventType,
              eventVersion: event.eventVersion,
              aggregateType: event.aggregateType,
              aggregateId: event.aggregateId,
              organizationId: event.organizationId,
              workspaceId: event.workspaceId,
              payloadJson: event.payloadJson,
              occurredAt: event.occurredAt,
            },
            error.message,
            new Date().toISOString(),
          );
        }
      }

      if (matchingOutcomes && isMatchingOutcomeEvent(event.eventType)) {
        if (!event.organizationId || !event.workspaceId) {
          throw new Error("Matching outcome event cannot be processed without tenant/workspace scope");
        }
        const context = createRequestContext({
          module: "matching",
          operation: "matching.learning.record",
          actorId: "system",
          tenantId: event.organizationId,
          workspaceId: event.workspaceId,
          correlationId: event.id,
          requestId: event.id,
          authenticated: true,
        });
        await matchingOutcomes.process(context, {
          id: event.id,
          eventType: event.eventType,
          eventVersion: event.eventVersion,
          aggregateType: event.aggregateType,
          aggregateId: brandId<"EntityId">(event.aggregateId),
          organizationId: brandId<"EntityId">(event.organizationId),
          workspaceId: brandId<"EntityId">(event.workspaceId),
          payloadJson: event.payloadJson,
          occurredAt: event.occurredAt,
        });
      }

      if (database && event.organizationId) {
        const seoContext = {
          id: event.id,
          eventType: event.eventType,
          eventVersion: event.eventVersion,
          organizationId: event.organizationId,
          workspaceId: event.workspaceId ?? null,
          ...(event.aggregateId ? { aggregateId: event.aggregateId } : {}),
          payloadJson: await enrichSeoPayload(event, catalog, business),
          occurredAt: event.occurredAt,
        };
        await enqueueSeoPublication(database, seoContext, new Date().toISOString());
      }

      if (event.eventType === "case.dispatch.requested") {
        await processCaseDispatch(env, new Date().toISOString());
      }

      if (event.eventType === "communication.notification.created") {
        if (!communication || !event.organizationId) {
          throw new Error("Communication notification event cannot be processed without D1 scope");
        }

        const payload = parsePayload(event.payloadJson);
        const notificationId = payload.notificationId;
        if (typeof notificationId !== "string" || !notificationId) {
          throw new Error("Communication notification event is missing notificationId");
        }

        await communication.queueNotificationFromSystem({
          organizationId: brandId<"EntityId">(event.organizationId),
          workspaceId: event.workspaceId ? brandId<"EntityId">(event.workspaceId) : null,
          notificationId: brandId<"EntityId">(notificationId),
          now: new Date().toISOString(),
        });
      }

      if (
        discovery
        && (
          event.eventType === "catalog.product.created"
          || event.eventType === "business.created.v1"
          || event.eventType === "business.publication.changed.v1"
        )
      ) {
        if (!event.organizationId || !event.workspaceId) {
          throw new Error("Discovery projection event cannot be processed without tenant/workspace scope");
        }
        const context = createRequestContext({
          module: "discovery",
          operation: "discovery.project",
          actorId: "system",
          tenantId: event.organizationId,
          workspaceId: event.workspaceId,
          correlationId: event.id,
          requestId: event.id,
          authenticated: true,
        });
        await discovery.process(context, {
          id: event.id,
          eventType: event.eventType,
          eventVersion: event.eventVersion,
          payloadJson: event.payloadJson,
          occurredAt: event.occurredAt,
        });
      }

      message.ack();
    } catch {
      message.retry();
    }
  }

  return { processed: batch.messages.length };
}

function isMatchingOutcomeEvent(eventType: string): boolean {
  return eventType === "booking.completed"
    || eventType === "booking.no_show"
    || eventType === "booking.cancelled"
    || eventType === "commerce.order.completed"
    || eventType === "commerce.payment.completed"
    || eventType === "payment.captured"
    || eventType === "fulfillment.completed";
}

function parsePayload(payloadJson: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(payloadJson);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Outbox payload must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function retryAt(attempt: number, now: string): string {
  const boundedAttempt = Math.min(Math.max(attempt, 1), 10);
  const delayMs = Math.min(5 * 60_000, 1_000 * 2 ** boundedAttempt);
  return new Date(Date.parse(now) + delayMs).toISOString();
}

async function enrichSeoPayload(
  event: OutboxEventRecord,
  catalog: CatalogRepository | null,
  business: BusinessRepository | null,
): Promise<string> {
  if (!event.organizationId || !event.workspaceId) return event.payloadJson;
  const payload = parsePayload(event.payloadJson);
  const context = createRequestContext({
    module: "seo",
    operation: "seo.canonical-source.enrich",
    actorId: "system",
    tenantId: event.organizationId,
    workspaceId: event.workspaceId,
    correlationId: event.id,
    requestId: event.id,
    authenticated: true,
  });

  if (catalog && event.eventType === "catalog.product.created" && typeof payload.productId === "string") {
    const product = await catalog.getProduct(context, brandId<"EntityId">(payload.productId));
    if (product) {
      const variants = (await catalog.listProductVariants(context, product.id))
        .filter((variant) => variant.status === "active")
        .map((variant) => ({
          id: variant.id,
          ...(variant.sku ? { sku: variant.sku } : {}),
          attributes: Object.fromEntries(Object.entries(variant.attributes ?? {}).map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : String(value)])),
        }));
      payload.seoEntity = {
        id: product.id,
        type: "Product",
        sourceModule: "catalog",
        sourceVersion: "1",
        publicationState: "published",
        visibility: "public",
        preferredName: product.name,
        ...(product.description ? { description: product.description } : {}),
        locale: typeof payload.locale === "string" ? payload.locale : "en",
        relatedEntityIds: [product.businessId],
        productGroupId: product.id,
        ...(variants.length ? { productVariants: variants } : {}),
        updatedAt: product.updatedAt,
      };
    }
  }

  if (business && (event.eventType === "business.created.v1" || event.eventType === "business.publication.changed.v1")) {
    const businessId = typeof payload.businessId === "string" ? payload.businessId : undefined;
    if (businessId) {
      const record = await business.get(context, brandId<"EntityId">(businessId));
      if (record) {
        const locations = await business.listLocations(context, record.id);
        const location = locations.find((item) => item.status === "active" && item.locationType === "physical" && item.geoPoint);
        if (location) {
          payload.seoEntity = {
            id: record.id,
            type: "Business",
            sourceModule: "business",
            sourceVersion: "1",
            publicationState: record.publicationStatus === "published" ? "published" : "unpublished",
            visibility: "public",
            preferredName: record.displayName,
            locale: record.defaultLocale ?? "en",
            ...(location.id ? { locationId: location.id } : {}),
            geoScope: "exact",
            geoPoint: location.geoPoint ?? undefined,
            ...(location.address ? { address: mapSeoAddress(location.address) } : {}),
            updatedAt: record.updatedAt,
          };
        }
      }
    }
  }

  return JSON.stringify(payload);
}

function mapSeoAddress(value: Readonly<Record<string, unknown>>): Record<string, string> {
  const fields = ["streetAddress", "addressLocality", "addressRegion", "postalCode", "addressCountry"] as const;
  const result: Record<string, string> = {};
  for (const field of fields) {
    const item = value[field];
    if (typeof item === "string" && item.trim()) result[field] = item.trim();
  }
  return result;
}
