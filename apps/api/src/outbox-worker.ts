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
import { CommerceRepository } from "@qooqnos/commerce";

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
  const commerce = database ? new CommerceRepository(database) : null;

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
          payloadJson: await enrichSeoPayload(event, catalog, business, commerce),
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
          || event.eventType === "catalog.service.created"
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
  commerce: CommerceRepository | null,
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

  if (catalog && (
    event.eventType === "catalog.product.created"
    || event.eventType === "catalog.product.updated"
    || event.eventType === "catalog.variant.changed"
  ) && typeof payload.productId === "string") {
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
        relatedEntities: [{ entityId: product.businessId, relation: "ownedByBusiness" }],
        productGroupId: product.id,
        ...(variants.length ? { productVariants: variants } : {}),
        updatedAt: product.updatedAt,
      };
    }
  }

  if (catalog && commerce && (
    event.eventType === "catalog.product.created"
    || event.eventType === "catalog.product.updated"
    || event.eventType === "catalog.variant.changed"
    || event.eventType === "commerce.fulfillment.policy.changed"
  ) && typeof payload.productId === "string") {
    const product = await catalog.getProduct(context, brandId<"EntityId">(payload.productId));
    if (product) {
      const policy = await commerce.getFulfillmentPolicy(context, product.businessId, "product", product.id);
      if (policy) {
        const commercePolicy = {
          shippingDetails: {
            ...(policy.destinationCountry ? { country: policy.destinationCountry } : {}),
            ...(policy.destinationRegion ? { region: policy.destinationRegion } : {}),
            ...(policy.destinationPostalCode ? { postalCode: policy.destinationPostalCode } : {}),
            ...(policy.shippingRateMinor !== null ? { shippingRate: policy.shippingRateMinor / 100 } : {}),
            ...(policy.shippingCurrency ? { currency: policy.shippingCurrency } : {}),
            ...(policy.handlingTimeMinDays !== null ? { handlingTimeMinDays: policy.handlingTimeMinDays } : {}),
            ...(policy.handlingTimeMaxDays !== null ? { handlingTimeMaxDays: policy.handlingTimeMaxDays } : {}),
          },
          returnPolicy: {
            ...(policy.destinationCountry ? { applicableCountry: policy.destinationCountry } : {}),
            ...(policy.returnWindowDays !== null ? { returnWindowDays: policy.returnWindowDays } : {}),
            ...(policy.returnFees ? { returnFees: policy.returnFees } : {}),
            ...(policy.returnMethod ? { returnMethod: policy.returnMethod } : {}),
          },
          policyVersion: policy.policyVersion,
        };
        if (payload.seoEntity && typeof payload.seoEntity === "object" && !Array.isArray(payload.seoEntity)) {
          payload.seoEntity = {
            ...(payload.seoEntity as Record<string, unknown>),
            shippingDetails: commercePolicy.shippingDetails,
            returnPolicy: commercePolicy.returnPolicy,
          };
        }
      }
    }
  }

  if (catalog && event.eventType === "catalog.service.created" && typeof payload.serviceId === "string") {
    const service = await catalog.getService(context, brandId<"EntityId">(payload.serviceId));
    if (service) {
      payload.seoEntity = {
        id: service.id,
        type: "Service",
        sourceModule: "catalog",
        sourceVersion: "1",
        publicationState: service.status === "active" ? "published" : "unpublished",
        visibility: service.status === "active" ? "public" : "private",
        preferredName: service.name,
        ...(service.description ? { description: service.description } : {}),
        locale: typeof payload.locale === "string" ? payload.locale : "en",
        ...(service.businessId ? {
          relatedEntityIds: [service.businessId],
          relatedEntities: [{ entityId: service.businessId, relation: "ownedByBusiness" }],
        } : {}),
        updatedAt: service.updatedAt,
      };
    }
  }

  if (business && event.eventType === "business.location.changed.v1" && typeof payload.locationId === "string") {
    const location = await business.getLocation(context, brandId<"EntityId">(payload.locationId));
    if (location) {
      const locale = typeof payload.locale === "string" ? payload.locale : "en";
      const published = location.status === "active" && (typeof payload.businessPublicationStatus === "string" ? payload.businessPublicationStatus === "published" : false);
      const hours = await business.listHours(context, location.businessId, location.id);
      const openingHours = hours.map((entry) => ({
        dayOfWeek: [schemaDayOfWeek(entry.dayOfWeek)],
        opens: entry.opens,
        closes: entry.closes,
      }));
      payload.seoEntity = {
        id: location.id,
        type: "Location",
        sourceModule: "business",
        sourceVersion: "1",
        publicationState: published ? "published" : "unpublished",
        visibility: published ? "public" : "private",
        preferredName: location.name,
        summary: location.name,
        locale,
        relatedEntityIds: [location.businessId],
        relatedEntities: [{ entityId: location.businessId, relation: "locatedAtBusiness" }],
        ...(location.geoPoint ? { geoPoint: location.geoPoint, geoScope: "exact" as const } : {}),
        ...(location.address ? { address: mapSeoAddress(location.address) } : {}),
        ...(location.timezone ? { timezone: location.timezone } : {}),
        ...(openingHours.length ? { openingHours } : {}),
        updatedAt: location.updatedAt,
      };
    }
  }

  if (business && (event.eventType === "business.created.v1" || event.eventType === "business.publication.changed.v1"
    || event.eventType === "business.profile.updated.v1" || event.eventType === "business.profile.published.v1"
    || event.eventType === "business.profile.suspended.v1")) {
    const businessId = typeof payload.businessId === "string" ? payload.businessId : undefined;
    if (businessId) {
      const record = await business.get(context, brandId<"EntityId">(businessId));
      if (record) {
        const locations = await business.listLocations(context, record.id);
        const catalogRelationships = catalog ? await catalog.listBusinessEntityIds(context, record.id) : { productIds: [], serviceIds: [] };
        const relatedEntities = [
          ...catalogRelationships.productIds.map((entityId) => ({ entityId, relation: "offersProduct" })),
          ...catalogRelationships.serviceIds.map((entityId) => ({ entityId, relation: "offersService" })),
          ...locations.filter((item) => item.status === "active").map((item) => ({ entityId: item.id, relation: "hasLocation" })),
        ].filter((item) => item.entityId !== record.id);
        const relatedEntityIds = relatedEntities.map((item) => item.entityId);
        const location = locations.find((item) => item.status === "active" && item.locationType === "physical" && item.geoPoint);
        if (location) {
          const hours = await business.listHours(context, record.id, location.id);
          const contacts = await business.listPublicContacts(context, record.id);
          const socialLinks = await business.listPublicSocialLinks(context, record.id);
          const phone = contacts.find((contact) => contact.contactType === "phone")?.value;
          const email = contacts.find((contact) => contact.contactType === "email")?.value;
          const sameAs = socialLinks.map((link) => link.url);
          const openingHours = hours.map((entry) => ({
            dayOfWeek: [schemaDayOfWeek(entry.dayOfWeek)],
            opens: entry.opens,
            closes: entry.closes,
          }));
          payload.seoEntity = {
            id: record.id,
            type: "Business",
            sourceModule: "business",
            sourceVersion: "1",
            publicationState: record.publicationStatus === "published" ? "published" : "unpublished",
            visibility: "public",
            preferredName: record.displayName,
            locale: record.defaultLocale ?? "en",
            ...(relatedEntityIds.length ? { relatedEntityIds } : {}),
            ...(relatedEntities.length ? { relatedEntities } : {}),
            ...(location.id ? { locationId: location.id } : {}),
            geoScope: "exact",
            geoPoint: location.geoPoint ?? undefined,
            ...(location.address ? { address: mapSeoAddress(location.address) } : {}),
            ...(phone ? { telephone: phone } : {}),
            ...(email ? { email } : {}),
            ...(sameAs.length ? { sameAs } : {}),
            ...(openingHours.length ? { openingHours } : {}),
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

function schemaDayOfWeek(day: number): string {
  const days = [
    "https://schema.org/Monday",
    "https://schema.org/Tuesday",
    "https://schema.org/Wednesday",
    "https://schema.org/Thursday",
    "https://schema.org/Friday",
    "https://schema.org/Saturday",
    "https://schema.org/Sunday",
  ];
  return days[Math.min(Math.max(day, 1), 7) - 1];
}
