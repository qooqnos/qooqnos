import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export interface CrmTimelineEventRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId;
  readonly relationshipId: EntityId;
  readonly sourceModule: string;
  readonly sourceEventId: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly occurredAt: string;
  readonly receivedAt: string;
  readonly actorReference: string | null;
  readonly visibility: string;
  readonly redactionClass: string;
  readonly payload: Readonly<Record<string, unknown>> | null;
  readonly projectionVersion: number;
}

export interface AppendCrmTimelineEventInput {
  readonly id: EntityId;
  readonly relationshipId: EntityId;
  readonly sourceModule: string;
  readonly sourceEventId: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly occurredAt: string;
  readonly receivedAt: string;
  readonly actorReference?: string | undefined;
  readonly visibility: string;
  readonly redactionClass: string;
  readonly payload?: Readonly<Record<string, unknown>> | undefined;
  readonly projectionVersion: number;
}

interface TimelineRow {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId;
  readonly relationshipId: EntityId;
  readonly sourceModule: string;
  readonly sourceEventId: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly occurredAt: string;
  readonly receivedAt: string;
  readonly actorReference: string | null;
  readonly visibility: string;
  readonly redactionClass: string;
  readonly payloadJson: string | null;
  readonly projectionVersion: number;
}

export class CrmTimelineRepository extends Repository {
  constructor(database: D1Database) {
    super(database);
  }

  async get(context: RequestContext, id: EntityId): Promise<CrmTimelineEventRecord | null> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });

    const row = await this.database.first<TimelineRow>(
      "SELECT e.id, e.organization_id AS organizationId, e.workspace_id AS workspaceId, e.relationship_id AS relationshipId, e.source_module AS sourceModule, e.source_event_id AS sourceEventId, e.event_type AS eventType, e.event_version AS eventVersion, e.occurred_at AS occurredAt, e.received_at AS receivedAt, e.actor_reference AS actorReference, e.visibility, e.redaction_class AS redactionClass, e.payload_json AS payloadJson, e.projection_version AS projectionVersion FROM crm_timeline_events e WHERE e.id = ? AND e.organization_id = ? AND e.workspace_id = ? LIMIT 1",
      id,
      organizationId,
      workspaceId,
    );

    return row ? this.hydrate(row) : null;
  }

  async append(
    context: RequestContext,
    input: AppendCrmTimelineEventInput,
  ): Promise<CrmTimelineEventRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });

    if (!input.sourceModule.trim()) throw new DatabaseError("Timeline source module is required");
    if (!input.sourceEventId.trim()) throw new DatabaseError("Timeline source event id is required");
    if (!input.eventType.trim()) throw new DatabaseError("Timeline event type is required");
    if (input.eventVersion < 1) throw new DatabaseError("Timeline event version must be positive");
    if (input.projectionVersion < 1) throw new DatabaseError("Timeline projection version must be positive");

    const existing = await this.database.first<TimelineRow>(
      "SELECT e.id, e.organization_id AS organizationId, e.workspace_id AS workspaceId, e.relationship_id AS relationshipId, e.source_module AS sourceModule, e.source_event_id AS sourceEventId, e.event_type AS eventType, e.event_version AS eventVersion, e.occurred_at AS occurredAt, e.received_at AS receivedAt, e.actor_reference AS actorReference, e.visibility, e.redaction_class AS redactionClass, e.payload_json AS payloadJson, e.projection_version AS projectionVersion FROM crm_timeline_events e WHERE e.source_module = ? AND e.source_event_id = ? LIMIT 1",
      input.sourceModule,
      input.sourceEventId,
    );
    if (existing) {
      const sameScope =
        existing.organizationId === organizationId &&
        existing.workspaceId === workspaceId &&
        existing.relationshipId === input.relationshipId;
      if (!sameScope) {
        throw new DatabaseError("Timeline source event conflicts with an existing scoped event");
      }
      return this.hydrate(existing);
    }

    const payloadJson = input.payload ? JSON.stringify(input.payload) : null;
    await this.database.run(
      "INSERT INTO crm_timeline_events (id, organization_id, workspace_id, relationship_id, source_module, source_event_id, event_type, event_version, occurred_at, received_at, actor_reference, visibility, redaction_class, payload_json, projection_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id,
      organizationId,
      workspaceId,
      input.relationshipId,
      input.sourceModule.trim(),
      input.sourceEventId.trim(),
      input.eventType.trim(),
      input.eventVersion,
      input.occurredAt,
      input.receivedAt,
      input.actorReference ?? null,
      input.visibility.trim(),
      input.redactionClass.trim(),
      payloadJson,
      input.projectionVersion,
    );

    const record = await this.get(context, input.id);
    if (!record) throw new DatabaseError("Timeline event not found after append");
    return record;
  }

  async listCustomerTimeline(
    context: RequestContext,
    customerId: EntityId,
    limit = 100,
  ): Promise<readonly CrmTimelineEventRecord[]> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);

    const rows = await this.database.all<TimelineRow>(
      "SELECT e.id, e.organization_id AS organizationId, e.workspace_id AS workspaceId, e.relationship_id AS relationshipId, e.source_module AS sourceModule, e.source_event_id AS sourceEventId, e.event_type AS eventType, e.event_version AS eventVersion, e.occurred_at AS occurredAt, e.received_at AS receivedAt, e.actor_reference AS actorReference, e.visibility, e.redaction_class AS redactionClass, e.payload_json AS payloadJson, e.projection_version AS projectionVersion FROM crm_timeline_events e INNER JOIN customer_relationships cr ON cr.id = e.relationship_id WHERE cr.customer_id = ? AND e.organization_id = ? AND e.workspace_id = ? ORDER BY e.occurred_at DESC, e.id DESC LIMIT ?",
      customerId,
      organizationId,
      workspaceId,
      safeLimit,
    );

    return rows.map((row) => this.hydrate(row));
  }

  async listRelationshipTimeline(
    context: RequestContext,
    relationshipId: EntityId,
    limit = 100,
  ): Promise<readonly CrmTimelineEventRecord[]> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);

    const rows = await this.database.all<TimelineRow>(
      "SELECT e.id, e.organization_id AS organizationId, e.workspace_id AS workspaceId, e.relationship_id AS relationshipId, e.source_module AS sourceModule, e.source_event_id AS sourceEventId, e.event_type AS eventType, e.event_version AS eventVersion, e.occurred_at AS occurredAt, e.received_at AS receivedAt, e.actor_reference AS actorReference, e.visibility, e.redaction_class AS redactionClass, e.payload_json AS payloadJson, e.projection_version AS projectionVersion FROM crm_timeline_events e WHERE e.relationship_id = ? AND e.organization_id = ? AND e.workspace_id = ? ORDER BY e.occurred_at DESC, e.id DESC LIMIT ?",
      relationshipId,
      organizationId,
      workspaceId,
      safeLimit,
    );

    return rows.map((row) => this.hydrate(row));
  }

  private hydrate(row: TimelineRow): CrmTimelineEventRecord {
    return {
      id: row.id,
      organizationId: row.organizationId,
      workspaceId: row.workspaceId,
      relationshipId: row.relationshipId,
      sourceModule: row.sourceModule,
      sourceEventId: row.sourceEventId,
      eventType: row.eventType,
      eventVersion: row.eventVersion,
      occurredAt: row.occurredAt,
      receivedAt: row.receivedAt,
      actorReference: row.actorReference,
      visibility: row.visibility,
      redactionClass: row.redactionClass,
      payload: this.parsePayload(row.payloadJson),
      projectionVersion: row.projectionVersion,
    };
  }

  private parsePayload(value: string | null): Readonly<Record<string, unknown>> | null {
    if (!value) return null;
    try {
      return JSON.parse(value) as Readonly<Record<string, unknown>>;
    } catch {
      throw new DatabaseError("Stored CRM timeline payload is invalid");
    }
  }
}
