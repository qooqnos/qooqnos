import type { RequestContext } from "@qooqnos/core";
import type { D1Database } from "@qooqnos/database";
import { SeoRepository } from "./repository";
import { buildSeoProjectionPlan } from "./projection";
import { planSeoInvalidation, type SeoDomainChange } from "./invalidation";
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
  "catalog.product.created": "entity-created",
};

function payloadEntity(payloadJson: string): SeoEntity | null {
  const payload: unknown = JSON.parse(payloadJson);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const payloadObject = payload as Record<string, unknown>;
  const value = payloadObject.seoEntity ?? payloadObject.entity;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (payloadObject.businessId && typeof payloadObject.name === "string") {
      return {
        id: String(payloadObject.businessId), type: "Business", sourceModule: "business", sourceVersion: "1",
        publicationState: payloadObject.publicationStatus === "published" ? "published" : "unpublished",
        visibility: "public", preferredName: String(payloadObject.displayName ?? payloadObject.name),
        summary: String(payloadObject.name), locale: typeof payloadObject.locale === "string" ? payloadObject.locale : "en",
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
  const reason = EVENT_REASON[event.eventType] ?? DOMAIN_EVENT_REASONS[event.eventType];
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
  const invalidationTargets = planSeoInvalidation(invalidationChange, []);
  const id = `seo-job:${event.id}:${entity.id}:${entity.locale}:${reason}`;
  await database.run(
    `INSERT INTO seo_publication_jobs
      (id, organization_id, workspace_id, entity_id, entity_type, locale, reason, status, attempts,
       available_at, source_event_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?)
     ON CONFLICT(organization_id, workspace_id, entity_id, entity_type, locale, reason, source_event_id)
     DO UPDATE SET updated_at=excluded.updated_at, available_at=excluded.available_at, status='pending'`,
    id, event.organizationId, event.workspaceId, entity.id, entity.type, entity.locale, reason,
    now, event.id, now, now,
  );
  return 1;
}

export async function processSeoPublicationJobs(
  database: D1Database,
  now: string,
  limit = 25,
  canonicalBaseUrl = "https://qooqnos.com",
): Promise<{ processed: number; succeeded: number; failed: number }> {
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
      const payload = row ? payloadEntity(row.payloadJson) : null;
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
      const plan = buildSeoProjectionPlan({ entity: payload, canonicalBaseUrl, now });
      const representation = await repository.saveRepresentation(context, {
        id: `seo-representation:${payload.id}:${payload.locale}`,
        plan,
        contentHash: await stableHash(plan),
        sourceUpdatedAt: payload.updatedAt,
        now,
      });
      await repository.replaceDependencies(context, representation.id, [
        { entityId: payload.id, entityType: payload.type, version: payload.sourceVersion },
        ...(payload.relatedEntityIds ?? []).map((entityId) => ({ entityId, entityType: "related", version: payload.sourceVersion })),
      ]);
      await repository.saveArtifact(context, { id: crypto.randomUUID(), representationId: representation.id, artifactType: "metadata", artifactVersion: 1, payload: plan.metadata, contentHash: await stableHash(plan.metadata), now });
      await repository.saveArtifact(context, { id: crypto.randomUUID(), representationId: representation.id, artifactType: "structured-data", artifactVersion: 1, payload: plan.structuredData, contentHash: await stableHash(plan.structuredData), now });
      await repository.saveArtifact(context, { id: crypto.randomUUID(), representationId: representation.id, artifactType: "answer", artifactVersion: 1, payload: plan.answer, contentHash: await stableHash(plan.answer), now });
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
  return { processed: succeeded + failed, succeeded, failed };
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
