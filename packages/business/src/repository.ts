import type { EntityId, RequestContext } from "@qooqnos/core";
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

export class BusinessRepository extends Repository {
  constructor(database: D1Database) { super(database); }

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

  async setPublicationStatus(context: RequestContext, id: EntityId, status: PublicationStatus, now: string): Promise<BusinessRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const result = await this.database.run(
      `UPDATE businesses SET publication_status = ?, updated_at = ?
       WHERE id = ? AND organization_id = ? AND workspace_id = ?`,
      status, now, id, organizationId, workspaceId,
    );
    if ((result.meta?.changes ?? 0) !== 1) throw new DatabaseError("Business publication update was rejected");
    const updated = await this.get(context, id);
    if (!updated) throw new DatabaseError("Business not found after publication update");
    return updated;
  }

  private async assertWorkspace(organizationId: EntityId, workspaceId: EntityId): Promise<void> {
    const workspace = await this.database.first<{ id: string }>(
      `SELECT id FROM workspaces WHERE id = ? AND organization_id = ? AND status = 'active' LIMIT 1`,
      workspaceId, organizationId,
    );
    if (!workspace) throw new DatabaseError("Workspace is not active in the requested organization");
  }
}
