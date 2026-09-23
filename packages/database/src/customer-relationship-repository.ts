import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type CustomerRelationshipStatus = "prospect" | "active" | "inactive";

export interface CustomerRelationshipRecord {
  readonly id: EntityId;
  readonly customerId: EntityId;
  readonly businessId: EntityId;
  readonly relationshipType: string;
  readonly status: CustomerRelationshipStatus;
  readonly firstInteractionAt: string | null;
  readonly lastInteractionAt: string | null;
  readonly source: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateCustomerRelationshipInput {
  readonly id: EntityId;
  readonly customerId: EntityId;
  readonly businessId: EntityId;
  readonly relationshipType: string;
  readonly source: string;
  readonly firstInteractionAt?: string | undefined;
  readonly lastInteractionAt?: string | undefined;
  readonly now: string;
}

export class CustomerRelationshipRepository extends Repository {
  constructor(database: D1Database) {
    super(database);
  }

  async get(context: RequestContext, id: EntityId): Promise<CustomerRelationshipRecord | null> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });

    return this.database.first<CustomerRelationshipRecord>(
      "SELECT cr.id, cr.customer_id AS customerId, cr.business_id AS businessId, cr.relationship_type AS relationshipType, cr.status, cr.first_interaction_at AS firstInteractionAt, cr.last_interaction_at AS lastInteractionAt, cr.source, cr.created_at AS createdAt, cr.updated_at AS updatedAt FROM customer_relationships cr INNER JOIN customers c ON c.id = cr.customer_id INNER JOIN businesses b ON b.id = cr.business_id WHERE cr.id = ? AND c.organization_id = ? AND b.organization_id = ? AND b.workspace_id = ? LIMIT 1",
      id,
      organizationId,
      organizationId,
      workspaceId,
    );
  }

  async getByCustomerBusinessType(
    context: RequestContext,
    customerId: EntityId,
    businessId: EntityId,
    relationshipType: string,
  ): Promise<CustomerRelationshipRecord | null> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    return this.database.first<CustomerRelationshipRecord>(
      "SELECT cr.id, cr.customer_id AS customerId, cr.business_id AS businessId, cr.relationship_type AS relationshipType, cr.status, cr.first_interaction_at AS firstInteractionAt, cr.last_interaction_at AS lastInteractionAt, cr.source, cr.created_at AS createdAt, cr.updated_at AS updatedAt FROM customer_relationships cr INNER JOIN customers c ON c.id=cr.customer_id INNER JOIN businesses b ON b.id=cr.business_id WHERE cr.customer_id=? AND cr.business_id=? AND cr.relationship_type=? AND c.organization_id=? AND b.organization_id=? AND b.workspace_id=? LIMIT 1",
      customerId, businessId, relationshipType.trim(), organizationId, organizationId, workspaceId,
    );
  }

  async create(
    context: RequestContext,
    input: CreateCustomerRelationshipInput,
  ): Promise<CustomerRelationshipRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const scope = await this.database.first<{ customerId: EntityId; businessId: EntityId }>(
      "SELECT c.id AS customerId, b.id AS businessId FROM customers c INNER JOIN businesses b ON b.organization_id = c.organization_id WHERE c.id = ? AND c.organization_id = ? AND b.id = ? AND b.organization_id = ? AND b.workspace_id = ? LIMIT 1",
      input.customerId,
      organizationId,
      input.businessId,
      organizationId,
      workspaceId,
    );
    if (!scope) throw new DatabaseError("Customer and Business are not available in the current workspace");

    if (!input.relationshipType.trim()) throw new DatabaseError("Relationship type is required");
    if (!input.source.trim()) throw new DatabaseError("Relationship source is required");
    if (
      input.firstInteractionAt &&
      input.lastInteractionAt &&
      input.lastInteractionAt < input.firstInteractionAt
    ) {
      throw new DatabaseError("Last interaction cannot precede first interaction");
    }

    await this.database.transaction([
      {
        sql: "INSERT INTO customer_relationships (id, customer_id, business_id, relationship_type, status, first_interaction_at, last_interaction_at, source, created_at, updated_at) VALUES (?, ?, ?, ?, 'prospect', ?, ?, ?, ?, ?)",
        params: [
          input.id,
          input.customerId,
          input.businessId,
          input.relationshipType.trim(),
          input.firstInteractionAt ?? null,
          input.lastInteractionAt ?? null,
          input.source.trim(),
          input.now,
          input.now,
        ],
      },
      {
        sql: "INSERT INTO outbox_events (id, event_type, event_version, aggregate_type, aggregate_id, organization_id, workspace_id, payload_json, status, attempts, available_at, occurred_at, published_at) VALUES (?, 'customer.relationship.linked', 1, 'CustomerRelationship', ?, ?, ?, ?, 'pending', 0, ?, ?, NULL)",
        params: [
          input.id + ":linked",
          input.id,
          organizationId,
          workspaceId,
          JSON.stringify({
            customerId: input.customerId,
            businessId: input.businessId,
            relationshipType: input.relationshipType.trim(),
          }),
          input.now,
          input.now,
        ],
      },
    ]);

    const record = await this.get(context, input.id);
    if (!record) throw new DatabaseError("Customer relationship not found after creation");
    return record;
  }

  async setStatus(
    context: RequestContext,
    id: EntityId,
    status: CustomerRelationshipStatus,
    now: string,
  ): Promise<CustomerRelationshipRecord> {
    const current = await this.get(context, id);
    if (!current) throw new DatabaseError("Customer relationship not found");

    const result = await this.database.run(
      "UPDATE customer_relationships SET status = ?, updated_at = ? WHERE id = ? AND status = ?",
      status,
      now,
      id,
      current.status,
    );
    if ((result.meta?.changes ?? 0) !== 1) {
      throw new DatabaseError("Customer relationship changed concurrently");
    }

    const updated = await this.get(context, id);
    if (!updated) throw new DatabaseError("Customer relationship not found after status update");
    return updated;
  }

  async recordInteraction(
    context: RequestContext,
    id: EntityId,
    occurredAt: string,
    now: string,
  ): Promise<CustomerRelationshipRecord> {
    const current = await this.get(context, id);
    if (!current) throw new DatabaseError("Customer relationship not found");

    await this.database.run(
      "UPDATE customer_relationships SET " +
        "first_interaction_at = CASE WHEN first_interaction_at IS NULL OR first_interaction_at > ? THEN ? ELSE first_interaction_at END, " +
        "last_interaction_at = CASE WHEN last_interaction_at IS NULL OR last_interaction_at < ? THEN ? ELSE last_interaction_at END, " +
        "updated_at = ? WHERE id = ?",
      occurredAt,
      occurredAt,
      occurredAt,
      occurredAt,
      now,
      id,
    );

    const updated = await this.get(context, id);
    if (!updated) throw new DatabaseError("Customer relationship not found after interaction update");
    return updated;
  }
}
