import { brandId, type RequestContext } from "@qooqnos/core";
import type { D1Database } from "@qooqnos/database";
import { SeoRepository } from "./repository";
import { validateStructuredData } from "./structured-validation";
import { validateAnswerRepresentation } from "./answer-validation";
import { buildEntityGraph } from "./entity-graph";
import { buildSeoProjectionPlan } from "./projection";
import { planSeoInvalidation, type SeoDomainChange } from "./invalidation";
import { notifyIndexNow, type SeoIndexNowConfig } from "./indexnow";
import { BingWebmasterActions, GoogleSearchConsoleActions, YandexWebmasterActions, type BingWebmasterActionsConfig, type GoogleSearchConsoleActionsConfig, type YandexWebmasterActionsConfig } from "./search-engine-actions";
import type { SeoEntity } from "./types";

export type SeoPublicationReason = "entity-created" | "entity-updated" | "entity-published" | "entity-unpublished" | "entity-deleted" | "dependency-changed";

export interface SeoPublicationEvent {
  readonly id: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly organizationId: string;
  readonly workspaceId: string | null;
  readonly aggregateId?: string;
  readonly payloadJson: string;
  readonly occurredAt: string;
}

export interface SeoPublicationJob {
  readonly id: string;
  readonly organizationId: string;
  readonly workspaceId: string | null;
  readonly entityId: string;
  readonly entityType: string;
  readonly locale: string;
  readonly reason: string;
  readonly attempts: number;
  readonly availableAt: string;
  readonly sourceEventId: string | null;
}

const DOMAIN_EVENT_REASONS: Readonly<Record<string, SeoPublicationReason>> = {
  "entity.relationship.changed": "dependency-changed",
  "entity.location.changed": "dependency-changed",
  "entity.locale.published": "entity-published",
  "credential.changed": "dependency-changed",
};

const EVENT_REASON: Readonly<Record<string, SeoPublicationReason>> = {
  "entity.created": "entity-created",
  "entity.updated": "entity-updated",
  "entity.published": "entity-published",
  "entity.unpublished": "entity-unpublished",
  "entity.deleted": "entity-deleted",
  "business.created.v1": "entity-created",
  "business.publication.changed.v1": "entity-published",
  "business.profile.updated.v1": "entity-updated",
  "business.profile.published.v1": "entity-published",
  "business.profile.suspended.v1": "entity-unpublished",
  "catalog.product.created": "entity-created",
  "catalog.product.updated": "entity-updated",
  "catalog.variant.changed": "dependency-changed",
  "catalog.service.created": "entity-created",
};

function payloadEntity(payloadJson: string): SeoEntity | null {
  const payload: unknown = JSON.parse(payloadJson);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const payloadObject = payload as Record<string, unknown>;
  const value = payloadObject.seoEntity ?? payloadObject.entity;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (payloadObject.locationId && typeof payloadObject.businessId === "string" && typeof payloadObject.name === "string") {
      const status = payloadObject.status === "active" ? "published" : "unpublished";
      return {
        id: String(payloadObject.locationId), type: "Location", sourceModule: "business", sourceVersion: "1",
        publicationState: status, visibility: status === "published" ? "public" : "private", preferredName: String(payloadObject.name),
        summary: String(payloadObject.name), locale: typeof payloadObject.locale === "string" ? payloadObject.locale : "en",
        relatedEntityIds: [String(payloadObject.businessId)],
        relatedEntities: [{ entityId: String(payloadObject.businessId), relation: "locatedAtBusiness" }],
        ...(payloadObject.timezone ? { timezone: String(payloadObject.timezone) } : {}),
        ...optionalSeoEntityFields(payloadObject),
        updatedAt: typeof payloadObject.updatedAt === "string" ? payloadObject.updatedAt : new Date().toISOString(),
      } as SeoEntity;
    }
    if (payloadObject.businessId && typeof payloadObject.name === "string") {
      return {
        id: String(payloadObject.businessId), type: "Business", sourceModule: "business", sourceVersion: "1",
        publicationState: payloadObject.publicationStatus === "published" ? "published" : "unpublished",
        visibility: "public", preferredName: String(payloadObject.displayName ?? payloadObject.name),
        summary: String(payloadObject.name), locale: typeof payloadObject.locale === "string" ? payloadObject.locale : "en",
        ...optionalSeoEntityFields(payloadObject),
        updatedAt: typeof payloadObject.updatedAt === "string" ? payloadObject.updatedAt : new Date().toISOString(),
      } as SeoEntity;
    }
    if (payloadObject.productId && typeof payloadObject.name === "string") {
      return {
        id: String(payloadObject.productId), type: "Product", sourceModule: "catalog", sourceVersion: "1",
        publicationState: "published", visibility: "public", preferredName: String(payloadObject.name),
        ...(typeof payloadObject.description === "string" ? { description: payloadObject.description } : {}),
        locale: typeof payloadObject.locale === "string" ? payloadObject.locale : "en",
        relatedEntityIds: typeof payloadObject.businessId === "string" ? [String(payloadObject.businessId)] : [],
        ...optionalSeoEntityFields(payloadObject),
        updatedAt: typeof payloadObject.updatedAt === "string" ? payloadObject.updatedAt : new Date().toISOString(),
      } as SeoEntity;
    }
    return null;
  }
  const e = value as Record<string, unknown>;
  if (typeof e.id !== "string" || typeof e.type !== "string" || typeof e.sourceModule !== "string" || typeof e.sourceVersion !== "string"
    || typeof e.publicationState !== "string" || typeof e.visibility !== "string" || typeof e.preferredName !== "string"
    || typeof e.locale !== "string" || typeof e.updatedAt !== "string") return null;
  return e as unknown as SeoEntity;
}

export function seoEntityFromEvent(event: SeoPublicationEvent): SeoEntity | null {
  return payloadEntity(event.payloadJson);
}

export async function enqueueSeoPublication(
  database: D1Database,
  event: SeoPublicationEvent,
  now: string,
): Promise<number> {
  const eventPayload = JSON.parse(event.payloadJson) as Record<string, unknown>;
  const locationChange = event.eventType === "business.location.changed.v1" && typeof eventPayload.changeType === "string" ? eventPayload.changeType as SeoPublicationReason : undefined;
  const reason = locationChange ?? EVENT_REASON[event.eventType] ?? DOMAIN_EVENT_REASONS[event.eventType];
  if (!reason) return 0;
  const entity = payloadEntity(event.payloadJson);
  if (!entity) return 0;
  const invalidationChange: SeoDomainChange = {
    eventId: event.id,
    entityId: entity.id,
    entityType: entity.type,
    sourceModule: entity.sourceModule,
    sourceVersion: entity.sourceVersion,
    reason: reason === "dependency-changed" ? "relationship-changed" : reason,
    occurredAt: event.occurredAt,
    ...(entity.relatedEntityIds ? { relatedEntityIds: entity.relatedEntityIds } : {}),
  };
  const dependencyRows = await database.all<{ representationEntityId: string; dependencyEntityId: string }>(
    `SELECT r.entity_id AS representationEntityId, d.dependency_entity_id AS dependencyEntityId
     FROM seo_dependencies d
     JOIN seo_entity_representations r ON r.id=d.representation_id
     WHERE d.organization_id=? AND d.workspace_id IS ? AND d.dependency_entity_id=?`,
    event.organizationId, event.workspaceId, entity.id,
  );
  const targets = planSeoInvalidation(invalidationChange, dependencyRows);
  for (const target of targets) {
    const targetRow = await database.first<{ entityId: string; entityType: string; locale: string }>(
      `SELECT entity_id AS entityId, entity_type AS entityType, locale
       FROM seo_entity_representations
       WHERE organization_id=? AND workspace_id IS ? AND entity_id=? LIMIT 1`,
      event.organizationId, event.workspaceId, target.entityId,
    );
    if (!targetRow) continue;
    const targetId = `seo-job:${event.id}:${targetRow.entityId}:${targetRow.locale}:${target.reason}`;
    await database.run(
      `INSERT INTO seo_publication_jobs
        (id, organization_id, workspace_id, entity_id, entity_type, locale, reason, status, attempts,
         available_at, source_event_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?)
       ON CONFLICT(organization_id, workspace_id, entity_id, entity_type, locale, reason, source_event_id)
       DO UPDATE SET updated_at=excluded.updated_at, available_at=excluded.available_at, status='pending'`,
      targetId, event.organizationId, event.workspaceId, targetRow.entityId, targetRow.entityType, targetRow.locale,
      target.reason, now, event.id, now, now,
    );
  }
  return 1;
}

export async function processSeoPublicationJobs(
  database: D1Database,
  now: string,
  limit = 25,
  canonicalBaseUrl = "https://qooqnos.com",
  options: {
    readonly indexNow?: SeoIndexNowConfig;
    readonly google?: GoogleSearchConsoleActionsConfig;
    readonly googleSitemapUrl?: string;
    readonly googleInspectionLanguage?: string;
    readonly bing?: BingWebmasterActionsConfig;
    readonly yandex?: YandexWebmasterActionsConfig;
    readonly yandexRecrawl?: boolean;
  } = {},
): Promise<{ processed: number; succeeded: number; failed: number; indexNowFailures: number }> {
  const jobs = await database.all<SeoPublicationJob>(
    `SELECT id, organization_id AS organizationId, workspace_id AS workspaceId,
      entity_id AS entityId, entity_type AS entityType, locale, reason, attempts, available_at AS availableAt, source_event_id AS sourceEventId
     FROM seo_publication_jobs
     WHERE status='pending' AND available_at <= ?
     ORDER BY available_at ASC, created_at ASC
     LIMIT ?`,
    now, Math.min(Math.max(limit, 1), 100),
  );
  const repository = new SeoRepository(database);
  let succeeded = 0;
  let failed = 0;
  let indexNowFailures = 0;
  let searchEngineApiFailures = 0;

  for (const job of jobs) {
    const locked = await database.run(
      `UPDATE seo_publication_jobs SET status='processing', locked_at=?, attempts=attempts+1, updated_at=?
       WHERE id=? AND status='pending' AND available_at <= ?`,
      now, now, job.id, now,
    );
    if ((locked.meta?.changes ?? 0) !== 1) continue;
    try {
      const row = job.sourceEventId ? await database.first<{ payloadJson: string }>(
        `SELECT payload_json AS payloadJson FROM outbox_events WHERE id=? LIMIT 1`, job.sourceEventId,
      ) : null;
      let payload = row ? payloadEntity(row.payloadJson) : null;
      if (job.reason === "dependency-changed" && payload?.id !== job.entityId) {
        const stored = await database.first<{ representationJson: string }>(
          `SELECT representation_json AS representationJson FROM seo_entity_representations
           WHERE organization_id=? AND workspace_id IS ? AND entity_id=? AND entity_type=? AND locale=? LIMIT 1`,
          job.organizationId, job.workspaceId, job.entityId, job.entityType, job.locale,
        );
        if (stored) {
          const representation = JSON.parse(stored.representationJson) as { entity?: SeoEntity };
          payload = representation.entity ?? null;
        }
      }
      if (!payload) {
        throw new Error("SEO publication job has no canonical entity payload; source adapter must provide one.");
      }
      const context = {
        tenantId: job.organizationId,
        workspaceId: job.workspaceId ?? undefined,
        authenticated: true,
        actorId: "system",
        module: "seo",
        operation: "seo.publication.process",
        requestId: job.id,
        correlationId: job.id,
      } as RequestContext;
      const graph = await loadSeoEntityGraph(database, job.organizationId, job.workspaceId, payload.id, payload.locale);
      const plan = buildSeoProjectionPlan({ entity: payload, canonicalBaseUrl, now, ...(graph ? { graph } : {}) });
      const representationId = brandId<"EntityId">(`seo-representation:${payload.id}:${payload.locale}`);
      if (plan.audit.status === "blocked") {
        const details = plan.audit.blockingIssueCodes.join(", ");
        throw new Error(`SEO audit blocked publication: ${details}`);
      }
      const structuredValidation = validateStructuredData(plan.structuredData);
      if (!structuredValidation.valid) {
        const details = structuredValidation.issues.filter((issue) => issue.severity === "error").map((issue) => `${issue.path}: ${issue.message}`).join("; ");
        throw new Error(`SEO structured-data validation failed: ${details}`);
      }
      const answerValidation = validateAnswerRepresentation(plan.answer, plan.entity, now);
      if (!answerValidation.valid) {
        const details = answerValidation.issues.filter((issue) => issue.severity === "error").map((issue) => `${issue.path}: ${issue.message}`).join("; ");
        throw new Error(`SEO answer validation failed: ${details}`);
      }
      const contentHash = await stableHash(plan);
      await repository.publishRepresentationBundle(
        context,
        {
          id: representationId,
          plan,
          contentHash,
          sourceUpdatedAt: payload.updatedAt,
          sourceVersion: payload.sourceVersion,
          now,
        },
        [
          { id: brandId<"EntityId">(crypto.randomUUID()), representationId, artifactType: "metadata", artifactVersion: 1, payload: plan.metadata, contentHash: await stableHash(plan.metadata), now },
          { id: brandId<"EntityId">(crypto.randomUUID()), representationId, artifactType: "structured-data", artifactVersion: 1, payload: plan.structuredData, contentHash: await stableHash(plan.structuredData), now },
          { id: brandId<"EntityId">(crypto.randomUUID()), representationId, artifactType: "answer", artifactVersion: 1, payload: plan.answer, contentHash: await stableHash(plan.answer), now },
        ],
        [
          { entityId: payload.id, entityType: payload.type, version: payload.sourceVersion },
          ...(payload.relatedEntityIds ?? []).map((entityId) => ({ entityId, entityType: "related", version: payload.sourceVersion })),
        ],
      );
      if (options.google && plan.metadata.canonicalUrl) {
        try {
          const google = new GoogleSearchConsoleActions(options.google);
          if (options.googleSitemapUrl) await google.submitSitemap(options.googleSitemapUrl);
        } catch {
          searchEngineApiFailures += 1;
        }
      }
      if (options.bing && plan.metadata.canonicalUrl && job.reason !== "entity-unpublished") {
        try {
          await new BingWebmasterActions(options.bing).submitUrl(plan.metadata.canonicalUrl);
        } catch {
          searchEngineApiFailures += 1;
        }
      }
      if (options.yandex && options.yandexRecrawl && plan.metadata.canonicalUrl && job.reason !== "entity-unpublished") {
        try {
          await new YandexWebmasterActions(options.yandex).requestRecrawl(plan.metadata.canonicalUrl);
        } catch {
          searchEngineApiFailures += 1;
        }
      }
      if (options.indexNow?.key && plan.metadata.canonicalUrl) {
        try {
          await notifyIndexNow([plan.metadata.canonicalUrl], options.indexNow);
        } catch {
          // IndexNow is an external discovery hint; publication success must not depend on provider availability.
          indexNowFailures += 1;
        }
      }
      await database.run(`UPDATE seo_publication_jobs SET status='succeeded', updated_at=?, last_error=NULL WHERE id=?`, now, job.id);
      succeeded += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "SEO publication failed";
      await database.run(
        `UPDATE seo_publication_jobs SET status=CASE WHEN attempts >= 5 THEN 'failed' ELSE 'pending' END,
         available_at=?, last_error=?, updated_at=? WHERE id=?`,
        retryAt(job.attempts + 1, now), message.slice(0, 1000), now, job.id,
      );
      failed += 1;
    }
  }
  return { processed: succeeded + failed, succeeded, failed, indexNowFailures, searchEngineApiFailures };
}

async function stableHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableStringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function retryAt(attempt: number, now: string): string {
  const bounded = Math.min(Math.max(attempt, 1), 5);
  return new Date(Date.parse(now) + Math.min(15 * 60_000, 1000 * 2 ** bounded)).toISOString();
}

export { planSeoInvalidation };


async function loadSeoEntityGraph(
  database: D1Database,
  organizationId: string,
  workspaceId: string | null,
  entityId: string,
  locale: string,
) {
  const edgeRows = await database.all<{
    sourceEntityId: string;
    targetEntityId: string;
    relation: string;
    provenance: string;
    confidence: number;
    verifiedAt: string | null;
  }>(
    `SELECT source_entity_id AS sourceEntityId,
            target_entity_id AS targetEntityId,
            relation,
            provenance,
            confidence,
            verified_at AS verifiedAt
       FROM seo_entity_graph_edges
      WHERE organization_id=? AND workspace_id IS ?
        AND (source_entity_id=? OR target_entity_id=?)
      ORDER BY confidence DESC, target_entity_id ASC`,
    organizationId, workspaceId, entityId, entityId,
  );
  if (!edgeRows.length) return null;

  const entityIds = [...new Set([entityId, ...edgeRows.flatMap((row) => [row.sourceEntityId, row.targetEntityId])])];
  const placeholders = entityIds.map(() => "?").join(", ");
  const nodeRows = await database.all<{
    entityId: string;
    entityType: string;
    sourceModule: string;
    sourceVersion: string;
    publicationState: string;
    visibility: string;
    locale: string | null;
    representationJson: string | null;
  }>(
    `SELECT n.entity_id AS entityId,
            n.entity_type AS entityType,
            n.source_module AS sourceModule,
            n.source_version AS sourceVersion,
            n.publication_state AS publicationState,
            n.visibility,
            n.locale,
            r.representation_json AS representationJson
       FROM seo_entity_graph_nodes n
       LEFT JOIN seo_entity_representations r
         ON r.organization_id=n.organization_id
        AND r.workspace_id IS n.workspace_id
        AND r.entity_id=n.entity_id
        AND r.locale=?
      WHERE n.organization_id=? AND n.workspace_id IS ?
        AND n.entity_id IN (${placeholders})`,
    locale, organizationId, workspaceId, ...entityIds,
  );

  const nodes = nodeRows.map((row) => {
    let preferredName: string | undefined;
    let canonicalUrl: string | undefined;
    if (row.representationJson) {
      try {
        const parsed = JSON.parse(row.representationJson) as {
          entity?: { preferredName?: string };
          metadata?: { canonicalUrl?: string };
        };
        preferredName = typeof parsed.entity?.preferredName === "string" ? parsed.entity.preferredName : undefined;
        canonicalUrl = typeof parsed.metadata?.canonicalUrl === "string" ? parsed.metadata.canonicalUrl : undefined;
      } catch {
        // Historical malformed projections are ignored; graph nodes remain valid for dependency planning.
      }
    }
    return {
      entityId: row.entityId,
      entityType: row.entityType as import("./types").SeoEntityType,
      sourceModule: row.sourceModule,
      sourceVersion: row.sourceVersion,
      publicationState: row.publicationState,
      visibility: row.visibility,
      ...(row.locale ? { locale: row.locale } : {}),
      ...(preferredName ? { preferredName } : {}),
      ...(canonicalUrl ? { canonicalUrl } : {}),
    };
  });

  const sourceNode = nodes.find((node) => node.entityId === entityId);
  if (!sourceNode) return null;

  return buildEntityGraph(nodes, edgeRows.map((row) => ({
    sourceEntityId: row.sourceEntityId,
    targetEntityId: row.targetEntityId,
    relation: row.relation,
    provenance: row.provenance,
    confidence: row.confidence,
    ...(row.verifiedAt ? { verifiedAt: row.verifiedAt } : {}),
  })));
}


function optionalSeoEntityFields(payload: Record<string, unknown>): Partial<SeoEntity> {
  const fields: Partial<SeoEntity> = {};
  const strings = [
    "country", "locationId", "canonicalId", "imageUrl", "telephone", "email",
    "priceRange", "currency", "availability", "brandName", "categoryName",
    "startDate", "endDate",
  ] as const;
  for (const key of strings) {
    if (typeof payload[key] === "string" && String(payload[key]).trim()) {
      (fields as Record<string, unknown>)[key] = String(payload[key]).trim();
    }
  }
  if (Array.isArray(payload.relatedEntities)) {
    const values = payload.relatedEntities
      .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value))
      .map((value) => ({
        entityId: typeof value.entityId === "string" ? value.entityId.trim() : "",
        relation: typeof value.relation === "string" ? value.relation.trim() : "",
      }))
      .filter((value) => value.entityId && value.relation);
    if (values.length) fields.relatedEntities = values;
  }
  if (typeof payload.price === "number" && Number.isFinite(payload.price)) fields.price = payload.price;
  if (payload.geoPoint && typeof payload.geoPoint === "object" && !Array.isArray(payload.geoPoint)) {
    const raw = payload.geoPoint as Record<string, unknown>;
    if (typeof raw.latitude === "number" && Number.isFinite(raw.latitude) && typeof raw.longitude === "number" && Number.isFinite(raw.longitude)) {
      fields.geoPoint = { latitude: raw.latitude, longitude: raw.longitude };
    }
  }
  if (payload.geoScope === "exact" || payload.geoScope === "branch" || payload.geoScope === "city" ||
      payload.geoScope === "region" || payload.geoScope === "country" || payload.geoScope === "service-area") {
    fields.geoScope = payload.geoScope;
  }
  if (Array.isArray(payload.serviceArea)) {
    const values = payload.serviceArea.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean);
    if (values.length) fields.serviceArea = values;
  }
  if (payload.address && typeof payload.address === "object" && !Array.isArray(payload.address)) {
    const raw = payload.address as Record<string, unknown>;
    const address: NonNullable<SeoEntity["address"]> = {};
    for (const key of ["streetAddress", "addressLocality", "addressRegion", "postalCode", "addressCountry"] as const) {
      if (typeof raw[key] === "string" && raw[key].trim()) address[key] = raw[key].trim();
    }
    if (Object.keys(address).length) fields.address = address;
  }
  return fields;
}
