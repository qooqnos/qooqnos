import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database } from "./client";
import { CommandRepository, type AtomicCommandResult } from "./command-repository";

export interface CreateProductCommandInput {
  readonly context: RequestContext;
  readonly id: EntityId;
  readonly businessId: EntityId;
  readonly name: string;
  readonly description?: string;
  readonly now: string;
  readonly expiresAt: string;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly auditId: string;
  readonly eventId: string;
}

export interface CatalogProductCommandResult {
  readonly productId: EntityId;
  readonly businessId: EntityId;
}

export interface CreateServiceCommandInput {
  readonly context: RequestContext;
  readonly id: EntityId;
  readonly businessId: EntityId;
  readonly name: string;
  readonly description?: string;
  readonly now: string;
  readonly expiresAt: string;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly auditId: string;
  readonly eventId: string;
}

export interface CatalogServiceCommandResult {
  readonly serviceId: EntityId;
  readonly businessId: EntityId;
}

/** Canonical transactional command adapter for Catalog product creation. */
export class CatalogCommandRepository {
  private readonly commands: CommandRepository;

  constructor(database: D1Database) {
    this.commands = new CommandRepository(database);
  }

  async createProduct(input: CreateProductCommandInput): Promise<AtomicCommandResult<CatalogProductCommandResult>> {
    const tenantId = input.context.tenantId;
    const workspaceId = input.context.workspaceId;
    if (!tenantId || !workspaceId) throw new DatabaseError("Catalog product creation requires tenant and workspace context");

    return this.commands.execute(
      { organizationId: tenantId, workspaceId },
      {
        key: input.idempotencyKey,
        requestFingerprint: input.requestFingerprint,
        createdAt: input.now,
        expiresAt: input.expiresAt,
        statements: [
          {
            sql: `INSERT INTO products
                  (id, business_id, name, description, status, created_at, updated_at)
                  SELECT ?, ?, ?, ?, 'draft', ?, ?
                  WHERE EXISTS (
                    SELECT 1 FROM businesses
                    WHERE id = ? AND organization_id = ? AND workspace_id = ?
                      AND status IN ('draft', 'active')
                  )`,
            params: [input.id, input.businessId, input.name, input.description ?? null, input.now, input.now, input.businessId, tenantId, workspaceId],
          },
        ],
        audit: {
          id: input.auditId,
          ...(input.context.actorId ? { actorId: input.context.actorId } : {}),
          action: "catalog.product.create",
          targetType: "product",
          targetId: input.id,
          outcome: "succeeded",
          requestId: input.context.requestId,
          correlationId: input.context.correlationId,
        },
        outbox: [
          {
            id: input.eventId,
            eventType: "catalog.product.created",
            eventVersion: 1,
            aggregateType: "product",
            aggregateId: input.id,
            payload: {
              productId: input.id,
              businessId: input.businessId,
              name: input.name,
              description: input.description ?? null,
            },
            availableAt: input.now,
            occurredAt: input.now,
          },
        ],
        result: { productId: input.id, businessId: input.businessId },
      },
    );
  }
  async createService(input: CreateServiceCommandInput): Promise<AtomicCommandResult<CatalogServiceCommandResult>> {
    const tenantId = input.context.tenantId;
    const workspaceId = input.context.workspaceId;
    if (!tenantId || !workspaceId) throw new DatabaseError("Catalog service creation requires tenant and workspace context");

    return this.commands.execute(
      { organizationId: tenantId, workspaceId },
      {
        key: input.idempotencyKey,
        requestFingerprint: input.requestFingerprint,
        createdAt: input.now,
        expiresAt: input.expiresAt,
        statements: [{
          sql: `INSERT INTO services
                (id, business_id, name, description, status, created_at, updated_at)
                SELECT ?, ?, ?, ?, 'draft', ?, ?
                WHERE EXISTS (
                  SELECT 1 FROM businesses
                  WHERE id = ? AND organization_id = ? AND workspace_id = ?
                    AND status IN ('draft', 'active')
                )`,
          params: [input.id, input.businessId, input.name, input.description ?? null, input.now, input.now, input.businessId, tenantId, workspaceId],
        }],
        audit: {
          id: input.auditId,
          ...(input.context.actorId ? { actorId: input.context.actorId } : {}),
          action: "catalog.service.create",
          targetType: "service",
          targetId: input.id,
          outcome: "succeeded",
          requestId: input.context.requestId,
          correlationId: input.context.correlationId,
        },
        outbox: [{
          id: input.eventId,
          eventType: "catalog.service.created",
          eventVersion: 1,
          aggregateType: "service",
          aggregateId: input.id,
          payload: { serviceId: input.id, businessId: input.businessId, name: input.name, description: input.description ?? null },
          availableAt: input.now,
          occurredAt: input.now,
        }],
        result: { serviceId: input.id, businessId: input.businessId },
      },
    );
  }

}
