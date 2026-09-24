import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";
import type { CrmTimelineEventRecord } from "./crm-timeline-repository";

export interface CrmTimelineProjectionRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId;
  readonly relationshipId: EntityId;
  readonly customerId: EntityId;
  readonly businessId: EntityId;
  readonly timelineEventId: EntityId;
  readonly sourceModule: string;
  readonly sourceEventId: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly occurredAt: string;
  readonly receivedAt: string;
  readonly actorReference: string | null;
  readonly visibility: string;
  readonly redactionClass: string;
  readonly projectionVersion: number;
  readonly projectedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface ProjectionRow {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId;
  readonly relationshipId: EntityId;
  readonly customerId: EntityId;
  readonly businessId: EntityId;
  readonly timelineEventId: EntityId;
  readonly sourceModule: string;
  readonly sourceEventId: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly occurredAt: string;
  readonly receivedAt: string;
  readonly actorReference: string | null;
  readonly visibility: string;
  readonly redactionClass: string;
  readonly projectionVersion: number;
  readonly projectedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface TimelineReadRow extends ProjectionRow {
  readonly payloadJson: string | null;
}

export type CrmTimelineProjectionRebuildScope =
  | { readonly type: "workspace" }
  | { readonly type: "relationship"; readonly relationshipId: EntityId }
  | { readonly type: "customer"; readonly customerId: EntityId };

export class CrmTimelineProjectionRepository extends Repository {
  constructor(database: D1Database) {
    super(database);
  }

  async project(
    context: RequestContext,
    timelineEventId: EntityId,
    projectedAt: string,
  ): Promise<CrmTimelineProjectionRecord | null> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });

    await this.database.run(
      `INSERT INTO crm_timeline_projections (
        id, organization_id, workspace_id, relationship_id, customer_id, business_id,
        timeline_event_id, source_module, source_event_id, event_type, event_version,
        occurred_at, received_at, actor_reference, visibility, redaction_class,
        projection_version, projected_at, created_at, updated_at
      )
      SELECT
        e.id, e.organization_id, e.workspace_id, e.relationship_id, cr.customer_id, cr.business_id,
        e.id, e.source_module, e.source_event_id, e.event_type, e.event_version,
        e.occurred_at, e.received_at, e.actor_reference, e.visibility, e.redaction_class,
        e.projection_version, ?, ?, ?
      FROM crm_timeline_events e
      INNER JOIN customer_relationships cr ON cr.id = e.relationship_id
      INNER JOIN customers c ON c.id = cr.customer_id
      INNER JOIN businesses b ON b.id = cr.business_id
      WHERE e.id = ?
        AND e.organization_id = ?
        AND e.workspace_id = ?
        AND c.organization_id = ?
        AND b.organization_id = ?
        AND b.workspace_id = ?
      ON CONFLICT(timeline_event_id) DO UPDATE SET
        organization_id = excluded.organization_id,
        workspace_id = excluded.workspace_id,
        relationship_id = excluded.relationship_id,
        customer_id = excluded.customer_id,
        business_id = excluded.business_id,
        source_module = excluded.source_module,
        source_event_id = excluded.source_event_id,
        event_type = excluded.event_type,
        event_version = excluded.event_version,
        occurred_at = excluded.occurred_at,
        received_at = excluded.received_at,
        actor_reference = excluded.actor_reference,
        visibility = excluded.visibility,
        redaction_class = excluded.redaction_class,
        projection_version = excluded.projection_version,
        projected_at = excluded.projected_at,
        updated_at = excluded.updated_at
      WHERE excluded.projection_version > crm_timeline_projections.projection_version`,
      projectedAt,
      projectedAt,
      projectedAt,
      timelineEventId,
      organizationId,
      workspaceId,
      organizationId,
      organizationId,
      workspaceId,
    );

    return this.get(context, timelineEventId);
  }

  async get(
    context: RequestContext,
    timelineEventId: EntityId,
  ): Promise<CrmTimelineProjectionRecord | null> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    return this.database.first<ProjectionRow>(
      `SELECT id, organization_id AS organizationId, workspace_id AS workspaceId,
        relationship_id AS relationshipId, customer_id AS customerId, business_id AS businessId,
        timeline_event_id AS timelineEventId, source_module AS sourceModule,
        source_event_id AS sourceEventId, event_type AS eventType, event_version AS eventVersion,
        occurred_at AS occurredAt, received_at AS receivedAt, actor_reference AS actorReference,
        visibility, redaction_class AS redactionClass, projection_version AS projectionVersion,
        projected_at AS projectedAt, created_at AS createdAt, updated_at AS updatedAt
       FROM crm_timeline_projections
       WHERE timeline_event_id = ? AND organization_id = ? AND workspace_id = ? LIMIT 1`,
      timelineEventId,
      organizationId,
      workspaceId,
    );
  }

  async listCustomerTimeline(
    context: RequestContext,
    customerId: EntityId,
    limit = 100,
  ): Promise<readonly CrmTimelineEventRecord[]> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);

    return this.listReadRows(
      context,
      `WHERE p.customer_id = ? AND p.organization_id = ? AND p.workspace_id = ?
       ORDER BY p.occurred_at DESC, p.timeline_event_id DESC LIMIT ?`,
      [customerId, organizationId, workspaceId, safeLimit],
    );
  }

  async listRelationshipTimeline(
    context: RequestContext,
    relationshipId: EntityId,
    limit = 100,
  ): Promise<readonly CrmTimelineEventRecord[]> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);

    return this.listReadRows(
      context,
      `WHERE p.relationship_id = ? AND p.organization_id = ? AND p.workspace_id = ?
       ORDER BY p.occurred_at DESC, p.timeline_event_id DESC LIMIT ?`,
      [relationshipId, organizationId, workspaceId, safeLimit],
    );
  }

  async rebuild(
    context: RequestContext,
    scope: CrmTimelineProjectionRebuildScope = { type: "workspace" },
    projectedAt = new Date().toISOString(),
  ): Promise<number> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });

    const scopeClause = this.scopeClause(scope);
    const scopeParams = this.scopeParams(scope);

    const statements = [
      {
        sql: `DELETE FROM crm_timeline_projections
          WHERE organization_id = ? AND workspace_id = ? ${scopeClause}`,
        params: [organizationId, workspaceId, ...scopeParams],
      },
      {
        sql: `INSERT INTO crm_timeline_projections (
          id, organization_id, workspace_id, relationship_id, customer_id, business_id,
          timeline_event_id, source_module, source_event_id, event_type, event_version,
          occurred_at, received_at, actor_reference, visibility, redaction_class,
          projection_version, projected_at, created_at, updated_at
        )
        SELECT
          e.id, e.organization_id, e.workspace_id, e.relationship_id, cr.customer_id, cr.business_id,
          e.id, e.source_module, e.source_event_id, e.event_type, e.event_version,
          e.occurred_at, e.received_at, e.actor_reference, e.visibility, e.redaction_class,
          e.projection_version, ?, ?, ?
        FROM crm_timeline_events e
        INNER JOIN customer_relationships cr ON cr.id = e.relationship_id
        INNER JOIN customers c ON c.id = cr.customer_id
        INNER JOIN businesses b ON b.id = cr.business_id
        WHERE e.organization_id = ?
          AND e.workspace_id = ?
          AND c.organization_id = ?
          AND b.organization_id = ?
          AND b.workspace_id = ?
          ${scopeClause}
        ORDER BY e.occurred_at ASC, e.id ASC`,
        params: [
          projectedAt,
          projectedAt,
          projectedAt,
          organizationId,
          workspaceId,
          organizationId,
          organizationId,
          workspaceId,
          ...scopeParams,
        ],
      },
    ];

    const results = await this.database.transaction(statements);
    return results[1]?.meta?.changes ?? 0;
  }

  private async listReadRows(
    context: RequestContext,
    where: string,
    params: readonly unknown[],
  ): Promise<readonly CrmTimelineEventRecord[]> {
    const rows = await this.database.all<TimelineReadRow>(
      `SELECT
        p.id, p.organization_id AS organizationId, p.workspace_id AS workspaceId,
        p.relationship_id AS relationshipId, p.customer_id AS customerId, p.business_id AS businessId,
        p.timeline_event_id AS timelineEventId, p.source_module AS sourceModule,
        p.source_event_id AS sourceEventId, p.event_type AS eventType, p.event_version AS eventVersion,
        p.occurred_at AS occurredAt, p.received_at AS receivedAt, p.actor_reference AS actorReference,
        p.visibility, p.redaction_class AS redactionClass, p.projection_version AS projectionVersion,
        p.projected_at AS projectedAt, p.created_at AS createdAt, p.updated_at AS updatedAt,
        e.payload_json AS payloadJson
       FROM crm_timeline_projections p
       INNER JOIN crm_timeline_events e ON e.id = p.timeline_event_id
       ${where}`,
      ...params,
    );

    return rows.map((row) => ({
      id: row.timelineEventId,
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
      payload: parsePayload(row.payloadJson),
      projectionVersion: row.projectionVersion,
    }));
  }

  private scopeClause(scope: CrmTimelineProjectionRebuildScope): string {
    if (scope.type === "workspace") return "";
    if (scope.type === "relationship") return "AND e.relationship_id = ?";
    return "AND cr.customer_id = ?";
  }

  private scopeParams(scope: CrmTimelineProjectionRebuildScope): readonly EntityId[] {
    if (scope.type === "workspace") return [];
    if (scope.type === "relationship") return [scope.relationshipId];
    return [scope.customerId];
  }
}

function parsePayload(value: string | null): Readonly<Record<string, unknown>> | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as Readonly<Record<string, unknown>>;
  } catch {
    throw new DatabaseError("Stored CRM timeline payload is invalid");
  }
}
