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
