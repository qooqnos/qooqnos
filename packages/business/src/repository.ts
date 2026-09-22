import type { EntityId, RequestContext } from "@qooqnos/core";
import { CommandRepository, type AtomicCommandResult, type RepositoryContext } from "@qooqnos/database";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type BusinessStatus = "draft" | "active" | "suspended" | "archived";
export type PublicationStatus = "unpublished" | "pending" | "published" | "blocked";

export interface BusinessRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId;
  readonly name: string;
  readonly displayName: string;
  readonly status: BusinessStatus;
  readonly publicationStatus: PublicationStatus;
  readonly businessType: string | null;
  readonly primaryCategoryId: string | null;
  readonly defaultLocale: string | null;
  readonly timezone: string | null;
  readonly defaultCurrency: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BusinessStatusHistoryRecord {
  readonly id: EntityId;
  readonly businessId: EntityId;
  readonly fromStatus: BusinessStatus | null;
  readonly toStatus: BusinessStatus;
  readonly changedAt: string;
  readonly createdAt: string;
}

export interface CreateBusinessInput {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId;
  readonly name: string;
  readonly displayName: string;
  readonly businessType?: string | undefined;
  readonly primaryCategoryId?: string | undefined;
  readonly defaultLocale?: string | undefined;
  readonly timezone?: string | undefined;
  readonly defaultCurrency?: string | undefined;
  readonly now: string;
}

export interface AtomicBusinessCreateOptions {
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly idempotencyExpiresAt: string;
  readonly auditId: string;
  readonly requestId: string;
  readonly correlationId: string;
}

export class BusinessRepository extends Repository {
  private readonly commands: CommandRepository;

  constructor(database: D1Database, commands = new CommandRepository(database)) {
    super(database);
    this.commands = commands;
  }

  async get(context: RequestContext, id: EntityId): Promise<BusinessRecord | null> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    return this.database.first<BusinessRecord>(
      `SELECT id, organization_id AS organizationId, workspace_id AS workspaceId,
              name, display_name AS displayName, status,
              publication_status AS publicationStatus, business_type AS businessType,
              primary_category_id AS primaryCategoryId, default_locale AS defaultLocale,
              timezone, default_currency AS defaultCurrency,
              created_at AS createdAt, updated_at AS updatedAt
       FROM businesses
       WHERE id = ? AND organization_id = ? AND workspace_id = ?
       LIMIT 1`,
      id, organizationId, workspaceId,
    );
  }

  async create(input: CreateBusinessInput): Promise<BusinessRecord> {
    await this.assertWorkspace(input.organizationId, input.workspaceId);
    await this.database.run(
      `INSERT INTO businesses
       (id, organization_id, workspace_id, name, display_name, status, publication_status,
        business_type, primary_category_id, default_locale, timezone, default_currency, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'draft', 'unpublished', ?, ?, ?, ?, ?, ?, ?)`,
      input.id, input.organizationId, input.workspaceId, input.name, input.displayName,
      input.businessType ?? null, input.primaryCategoryId ?? null, input.defaultLocale ?? null,
      input.timezone ?? null, input.defaultCurrency ?? null, input.now, input.now,
    );
    const record = await this.get({ tenantId: input.organizationId, workspaceId: input.workspaceId } as RequestContext, input.id);
    if (!record) throw new DatabaseError("Business not found after creation");
    return record;
  }

  async createAtomic(
    context: RequestContext,
    input: CreateBusinessInput,
    options: AtomicBusinessCreateOptions,
  ): Promise<AtomicCommandResult<BusinessRecord>> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    if (organizationId !== input.organizationId || workspaceId !== input.workspaceId) {
      throw new DatabaseError("Business creation scope does not match request context");
    }
    await this.assertWorkspace(input.organizationId, input.workspaceId);

    const result: BusinessRecord = {
      id: input.id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      name: input.name,
      displayName: input.displayName,
      status: "draft",
      publicationStatus: "unpublished",
      businessType: input.businessType ?? null,
      primaryCategoryId: input.primaryCategoryId ?? null,
      defaultLocale: input.defaultLocale ?? null,
      timezone: input.timezone ?? null,
      defaultCurrency: input.defaultCurrency ?? null,
      createdAt: input.now,
      updatedAt: input.now,
    };

    return this.commands.execute(context as RepositoryContext, {
      key: options.idempotencyKey,
      requestFingerprint: options.requestFingerprint,
      createdAt: input.now,
      expiresAt: options.idempotencyExpiresAt,
      result,
      statements: [
        {
          sql: `INSERT INTO businesses
               (id, organization_id, workspace_id, name, display_name, status, publication_status,
                business_type, primary_category_id, default_locale, timezone, default_currency, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 'draft', 'unpublished', ?, ?, ?, ?, ?, ?, ?)`,
          params: [
            input.id, input.organizationId, input.workspaceId, input.name, input.displayName,
            input.businessType ?? null, input.primaryCategoryId ?? null, input.defaultLocale ?? null,
            input.timezone ?? null, input.defaultCurrency ?? null, input.now, input.now,
          ],
        },
      ],
      audit: {
        id: options.auditId,
        ...(context.actorId ? { actorId: context.actorId } : {}),
        action: "business.created",
        targetType: "business",
        targetId: input.id,
        outcome: "success",
        requestId: options.requestId,
        correlationId: options.correlationId,
        metadata: { name: input.name },
      },
      outbox: [
        {
          id: `${input.id}:business.created.v1`,
          eventType: "business.created.v1",
          eventVersion: 1,
          aggregateType: "business",
          aggregateId: input.id,
          payload: {
            businessId: input.id,
            organizationId: input.organizationId,
            workspaceId: input.workspaceId,
            name: input.name,
            displayName: input.displayName,
            publicationStatus: "unpublished",
          },
          availableAt: input.now,
          occurredAt: input.now,
        },
      ],
    });
  }

  async update(context: RequestContext, id: EntityId, patch: Pick<CreateBusinessInput, "name" | "displayName"> & Partial<Omit<CreateBusinessInput, "id" | "organizationId" | "workspaceId" | "name" | "displayName" | "now">>, now: string): Promise<BusinessRecord> {
    const current = await this.get(context, id);
    if (!current) throw new DatabaseError("Business not found");
    await this.database.run(
      `UPDATE businesses
       SET name = ?, display_name = ?, business_type = ?, primary_category_id = ?,
           default_locale = ?, timezone = ?, default_currency = ?, updated_at = ?
       WHERE id = ? AND organization_id = ? AND workspace_id = ?`,
      patch.name, patch.displayName, patch.businessType ?? current.businessType,
      patch.primaryCategoryId ?? current.primaryCategoryId, patch.defaultLocale ?? current.defaultLocale,
      patch.timezone ?? current.timezone, patch.defaultCurrency ?? current.defaultCurrency,
      now, id, current.organizationId, current.workspaceId,
    );
    const updated = await this.get(context, id);
    if (!updated) throw new DatabaseError("Business not found after update");
    return updated;
  }

  async setStatus(
    context: RequestContext,
    id: EntityId,
    status: BusinessStatus,
    now: string,
    historyId: EntityId = id + ":status:" + now,
  ): Promise<BusinessRecord> {
    const current = await this.get(context, id);
    if (!current) throw new DatabaseError("Business not found");
    if (current.status === status) return current;

    await this.database.run(
      "UPDATE businesses SET status = ?, updated_at = ? WHERE id = ? AND organization_id = ? AND workspace_id = ?",
      status,
      now,
      id,
      current.organizationId,
      current.workspaceId,
    );

    await this.database.run(
      "INSERT INTO business_status_history (id, business_id, from_status, to_status, changed_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      historyId,
      id,
      current.status,
      status,
      now,
      now,
    );

    const updated = await this.get(context, id);
    if (!updated) throw new DatabaseError("Business not found after status update");
    return updated;
  }

  async listStatusHistory(
    context: RequestContext,
    id: EntityId,
    limit = 100,
  ): Promise<readonly BusinessStatusHistoryRecord[]> {
    const current = await this.get(context, id);
    if (!current) throw new DatabaseError("Business not found");
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
    return this.database.all<BusinessStatusHistoryRecord>(
      "SELECT id, business_id AS businessId, from_status AS fromStatus, to_status AS toStatus, changed_at AS changedAt, created_at AS createdAt FROM business_status_history WHERE business_id = ? ORDER BY changed_at DESC, id DESC LIMIT ?",
      id,
      safeLimit,
    );
  }

  async setPublicationStatus(context: RequestContext, id: EntityId, status: PublicationStatus, now: string): Promise<BusinessRecord> {
    return this.setPublicationStatusAndRecord(context, id, status, now);
  }

  async setPublicationStatusAndRecord(
    context: RequestContext,
    id: EntityId,
    status: PublicationStatus,
    now: string,
  ): Promise<BusinessRecord> {
    const current = await this.get(context, id);
    if (!current) throw new DatabaseError("Business not found");
    if (current.publicationStatus === status) return current;

    const eventId = `${id}:business.publication.changed.v1:${now}`;
    const results = await this.database.transaction([
      {
        sql: `UPDATE businesses SET publication_status = ?, updated_at = ?
              WHERE id = ? AND organization_id = ? AND workspace_id = ? AND publication_status = ?`,
        params: [status, now, id, current.organizationId, current.workspaceId, current.publicationStatus],
      },
      {
        sql: `INSERT INTO audit_events
              (id, actor_id, organization_id, workspace_id, action, target_type, target_id,
               outcome, request_id, correlation_id, metadata_json, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          eventId + ":audit",
          context.actorId ?? null,
          current.organizationId,
          current.workspaceId,
          "business.publication.changed",
          "business",
          id,
          "succeeded",
          context.requestId,
          context.correlationId,
          JSON.stringify({ fromStatus: current.publicationStatus, toStatus: status }),
          now,
        ],
      },
      {
        sql: `INSERT INTO outbox_events
              (id, event_type, event_version, aggregate_type, aggregate_id,
               organization_id, workspace_id, payload_json, status, attempts, available_at, occurred_at, published_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, NULL)`,
        params: [
          eventId,
          "business.publication.changed.v1",
          1,
          "business",
          id,
          current.organizationId,
          current.workspaceId,
          JSON.stringify({
            businessId: id,
            organizationId: current.organizationId,
            workspaceId: current.workspaceId,
            name: current.name,
            displayName: current.displayName,
            publicationStatus: status,
            updatedAt: now,
          }),
          now,
          now,
        ],
      },
    ]);

    if ((results[0]?.meta?.changes ?? 0) !== 1) {
      throw new DatabaseError("Concurrent business publication transition rejected");
    }

    const result = await this.database.first<BusinessRecord>(
      `SELECT id, organization_id AS organizationId, workspace_id AS workspaceId,
              name, display_name AS displayName, status, publication_status AS publicationStatus,
              business_type AS businessType, primary_category_id AS primaryCategoryId,
              default_locale AS defaultLocale, timezone, default_currency AS defaultCurrency,
              created_at AS createdAt, updated_at AS updatedAt
       FROM businesses
       WHERE id = ? AND organization_id = ? AND workspace_id = ? LIMIT 1`,
      id,
      current.organizationId,
      current.workspaceId,
    );
    if (!result) throw new DatabaseError("Business not found after publication update");
    return result;
  }

  private async assertWorkspace(organizationId: EntityId, workspaceId: EntityId): Promise<void> {
    const workspace = await this.database.first<{ id: string }>(
      `SELECT id FROM workspaces WHERE id = ? AND organization_id = ? AND status = 'active' LIMIT 1`,
      workspaceId, organizationId,
    );
    if (!workspace) throw new DatabaseError("Workspace is not active in the requested organization");
  }
}
