export type SeoInvalidationReason =
  | "entity-created"
  | "entity-updated"
  | "entity-published"
  | "entity-unpublished"
  | "entity-deleted"
  | "relationship-changed"
  | "location-changed"
  | "locale-published"
  | "credential-changed";

export interface SeoDomainChange {
  readonly eventId: string;
  readonly entityId: string;
  readonly entityType: string;
  readonly sourceModule: string;
  readonly sourceVersion: string;
  readonly reason: SeoInvalidationReason;
  readonly occurredAt: string;
  readonly relatedEntityIds?: readonly string[];
}

export interface SeoInvalidationTarget {
  readonly entityId: string;
  readonly reason: SeoInvalidationReason;
}

export function planSeoInvalidation(
  change: SeoDomainChange,
  dependencyRows: readonly { readonly representationEntityId: string; readonly dependencyEntityId: string }[],
): readonly SeoInvalidationTarget[] {
  const ids = new Map<string, SeoInvalidationTarget>();
  ids.set(change.entityId, { entityId: change.entityId, reason: change.reason });
  for (const relatedId of change.relatedEntityIds ?? []) {
    if (relatedId.trim()) ids.set(relatedId, { entityId: relatedId, reason: "relationship-changed" });
  }
  for (const row of dependencyRows) {
    if (row.dependencyEntityId === change.entityId) {
      ids.set(row.representationEntityId, { entityId: row.representationEntityId, reason: "relationship-changed" });
    }
  }
  return [...ids.values()].sort((a, b) => a.entityId.localeCompare(b.entityId));
}


export const SEO_EVENT_REASON_MAP: Readonly<Record<string, SeoInvalidationReason>> = {
  "entity.created": "entity-created",
  "entity.updated": "entity-updated",
  "entity.published": "entity-published",
  "entity.unpublished": "entity-unpublished",
  "entity.deleted": "entity-deleted",
  "entity.relationship.changed": "relationship-changed",
  "entity.location.changed": "location-changed",
  "entity.locale.published": "locale-published",
  "credential.changed": "credential-changed",
};

export function domainChangeFromOutboxEvent(event: {
  readonly id: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly occurredAt: string;
  readonly payloadJson: string;
}): SeoDomainChange | null {
  const reason = SEO_EVENT_REASON_MAP[event.eventType];
  if (!reason) return null;
  let payload: unknown;
  try { payload = JSON.parse(event.payloadJson); } catch { return null; }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const sourceModule = typeof record.sourceModule === "string" ? record.sourceModule : "unknown";
  const sourceVersion = typeof record.sourceVersion === "string" ? record.sourceVersion : String(event.eventVersion);
  const related = Array.isArray(record.relatedEntityIds)
    ? record.relatedEntityIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : undefined;
  return {
    eventId: event.id,
    entityId: event.aggregateId,
    entityType: event.aggregateType,
    sourceModule,
    sourceVersion,
    reason,
    occurredAt: event.occurredAt,
    relatedEntityIds: related,
  };
}
