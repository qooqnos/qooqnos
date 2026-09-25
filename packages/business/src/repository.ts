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

export interface BusinessLocationRecord {
  readonly id: EntityId;
  readonly businessId: EntityId;
  readonly name: string;
  readonly locationType: "physical" | "virtual" | "service_area";
  readonly timezone: string | null;
  readonly address: Readonly<Record<string, unknown>> | null;
  readonly geoPoint: { readonly latitude: number; readonly longitude: number } | null;
  readonly status: "active" | "inactive" | "archived";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BusinessHoursRecord {
  readonly id: EntityId;
  readonly businessId: EntityId;
  readonly locationId: EntityId | null;
  readonly dayOfWeek: number;
  readonly opens: string;
  readonly closes: string;
  readonly timezone: string | null;
  readonly status: "active" | "inactive" | "archived";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BusinessPublicContactRecord {
  readonly id: EntityId;
  readonly businessId: EntityId;
  readonly locationId: EntityId | null;
  readonly contactType: "phone" | "email" | "website";
  readonly value: string;
  readonly isPrimary: boolean;
}

export interface BusinessSocialLinkRecord {
  readonly id: EntityId;
  readonly businessId: EntityId;
  readonly platform: string;
  readonly url: string;
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

  async listPublicContacts(context: RequestContext, businessId: EntityId): Promise<readonly BusinessPublicContactRecord[]> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    return this.database.all<BusinessPublicContactRecord>(
      `SELECT c.id, c.business_id AS businessId, c.location_id AS locationId,
              c.contact_type AS contactType, c.value, c.is_primary AS isPrimary
       FROM business_contacts c
       INNER JOIN businesses b ON b.id = c.business_id
       WHERE c.business_id = ? AND b.organization_id = ? AND b.workspace_id = ?
         AND c.visibility = 'public' AND c.status = 'active'
       ORDER BY c.is_primary DESC, c.contact_type ASC, c.id ASC`,
      businessId, organizationId, workspaceId,
    );
  }

  async listPublicSocialLinks(context: RequestContext, businessId: EntityId): Promise<readonly BusinessSocialLinkRecord[]> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    return this.database.all<BusinessSocialLinkRecord>(
      `SELECT s.id, s.business_id AS businessId, s.platform, s.url
       FROM business_social_links s
       INNER JOIN businesses b ON b.id = s.business_id
       WHERE s.business_id = ? AND b.organization_id = ? AND b.workspace_id = ?
         AND s.visibility = 'public' AND s.status = 'active'
       ORDER BY s.platform ASC, s.id ASC`,
      businessId, organizationId, workspaceId,
    );
  }

  async listHours(context: RequestContext, businessId: EntityId, locationId?: EntityId): Promise<readonly BusinessHoursRecord[]> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const rows = await this.database.all<BusinessHoursRecord>(
      `SELECT h.id, h.business_id AS businessId, h.location_id AS locationId,
              h.day_of_week AS dayOfWeek, h.opens, h.closes, h.timezone,
              h.status, h.created_at AS createdAt, h.updated_at AS updatedAt
       FROM business_hours h
       INNER JOIN businesses b ON b.id = h.business_id
       LEFT JOIN locations l ON l.id = h.location_id
       WHERE h.business_id = ? AND b.organization_id = ? AND b.workspace_id = ?
         AND h.status = 'active'
         AND (? IS NULL OR h.location_id = ?)
       ORDER BY h.day_of_week ASC, h.opens ASC, h.id ASC`,
      businessId, organizationId, workspaceId, locationId ?? null, locationId ?? null,
    );
    return rows;
  }

  async listLocations(context: RequestContext, businessId: EntityId): Promise<readonly BusinessLocationRecord[]> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const rows = await this.database.all<{
      id: EntityId; businessId: EntityId; name: string; locationType: BusinessLocationRecord["locationType"];
      timezone: string | null; addressJson: string | null; geoPointJson: string | null;
      status: BusinessLocationRecord["status"]; createdAt: string; updatedAt: string;
    }>(
      `SELECT l.id, l.business_id AS businessId, l.name, l.location_type AS locationType,
              l.timezone, l.address_json AS addressJson, l.geo_point_json AS geoPointJson,
              l.status, l.created_at AS createdAt, l.updated_at AS updatedAt
       FROM locations l
       INNER JOIN businesses b ON b.id = l.business_id
       WHERE l.business_id = ? AND b.organization_id = ? AND b.workspace_id = ?
       ORDER BY l.id ASC`,
      businessId, organizationId, workspaceId,
    );
    return rows.map((row) => {
      let address: Readonly<Record<string, unknown>> | null = null;
      let geoPoint: BusinessLocationRecord["geoPoint"] = null;
      if (row.addressJson) {
        try {
          const parsed: unknown = JSON.parse(row.addressJson);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) address = parsed as Readonly<Record<string, unknown>>;
        } catch { address = null; }
      }
      if (row.geoPointJson) {
        try {
          const parsed: unknown = JSON.parse(row.geoPointJson);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            const value = parsed as Record<string, unknown>;
            if (typeof value.latitude === "number" && Number.isFinite(value.latitude) &&
                typeof value.longitude === "number" && Number.isFinite(value.longitude) &&
                value.latitude >= -90 && value.latitude <= 90 &&
                value.longitude >= -180 && value.longitude <= 180) {
              geoPoint = { latitude: value.latitude, longitude: value.longitude };
            }
          }
        } catch { geoPoint = null; }
      }
      return { id: row.id, businessId: row.businessId, name: row.name, locationType: row.locationType,
        timezone: row.timezone, address, geoPoint, status: row.status, createdAt: row.createdAt, updatedAt: row.updatedAt };
    });
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

    const results = await this.database.transaction([
      {
        sql: "UPDATE businesses SET status = ?, updated_at = ? WHERE id = ? AND organization_id = ? AND workspace_id = ? AND status = ?",
        params: [status, now, id, current.organizationId, current.workspaceId, current.status],
      },
      {
        sql: "INSERT INTO business_status_history (id, business_id, from_status, to_status, changed_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        params: [historyId, id, current.status, status, now, now],
      },
    ]);
    if ((results[0]?.meta?.changes ?? 0) !== 1) {
      throw new DatabaseError("Concurrent business status transition rejected");
    }

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

  async createLocation(context: RequestContext, input: {
    readonly id: EntityId;
    readonly businessId: EntityId;
    readonly name: string;
    readonly locationType: BusinessLocationRecord["locationType"];
    readonly timezone?: string | undefined;
    readonly address?: Readonly<Record<string, unknown>> | undefined;
    readonly geoPoint?: BusinessLocationRecord["geoPoint"] | undefined;
    readonly now: string;
  }): Promise<BusinessLocationRecord> {
    const business = await this.get(context, input.businessId);
    if (!business) throw new DatabaseError("Business not found");
    const addressJson = input.address ? JSON.stringify(input.address) : null;
    const geoPointJson = input.geoPoint ? JSON.stringify(input.geoPoint) : null;
    await this.database.transaction([
      {
        sql: `INSERT INTO locations
          (id, business_id, name, location_type, timezone, address_json, geo_point_json, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        params: [input.id, input.businessId, input.name, input.locationType, input.timezone ?? business.timezone, addressJson, geoPointJson, input.now, input.now],
      },
      {
        sql: `INSERT INTO outbox_events
          (id, event_type, event_version, aggregate_type, aggregate_id, organization_id, workspace_id, payload_json, status, attempts, available_at, occurred_at, published_at)
          VALUES (?, 'business.location.changed.v1', 1, 'location', ?, ?, ?, ?, 'pending', 0, ?, ?, NULL)`,
        params: [
          `${input.id}:business.location.changed.v1:${input.now}`, input.id, business.organizationId, business.workspaceId,
          JSON.stringify({ businessId: business.id, locationId: input.id, changeType: "entity-created", status: "active", name: input.name, locationType: input.locationType, timezone: input.timezone ?? business.timezone, address: input.address ?? null, geoPoint: input.geoPoint ?? null, businessPublicationStatus: business.publicationStatus, updatedAt: input.now }), input.now, input.now,
        ],
      },
    ]);
    const created = (await this.listLocations(context, input.businessId)).find((item) => item.id === input.id);
    if (!created) throw new DatabaseError("Location not found after creation");
    return created;
  }

  async updateLocation(context: RequestContext, id: EntityId, patch: {
    readonly name?: string | undefined;
    readonly locationType?: BusinessLocationRecord["locationType"] | undefined;
    readonly timezone?: string | null | undefined;
    readonly address?: Readonly<Record<string, unknown>> | null | undefined;
    readonly geoPoint?: BusinessLocationRecord["geoPoint"] | null | undefined;
  }, now: string): Promise<BusinessLocationRecord> {
    const current = await this.getLocation(context, id);
    if (!current) throw new DatabaseError("Location not found");
    const business = await this.get(context, current.businessId);
    if (!business) throw new DatabaseError("Business not found");
    const nextName = patch.name ?? current.name;
    const nextType = patch.locationType ?? current.locationType;
    const nextTimezone = patch.timezone === undefined ? current.timezone : patch.timezone;
    const nextAddress = patch.address === undefined ? current.address : patch.address;
    const nextGeo = patch.geoPoint === undefined ? current.geoPoint : patch.geoPoint;
    const results = await this.database.transaction([
      {
        sql: `UPDATE locations SET name=?, location_type=?, timezone=?, address_json=?, geo_point_json=?, updated_at=? WHERE id=? AND business_id=? AND status != 'archived'`,
        params: [nextName, nextType, nextTimezone, nextAddress ? JSON.stringify(nextAddress) : null, nextGeo ? JSON.stringify(nextGeo) : null, now, id, current.businessId],
      },
      {
        sql: `INSERT INTO outbox_events
          (id, event_type, event_version, aggregate_type, aggregate_id, organization_id, workspace_id, payload_json, status, attempts, available_at, occurred_at, published_at)
          VALUES (?, 'business.location.changed.v1', 1, 'location', ?, ?, ?, ?, 'pending', 0, ?, ?, NULL)`,
        params: [
          `${id}:business.location.changed.v1:${now}`, id, business.organizationId, business.workspaceId,
          JSON.stringify({ businessId: business.id, locationId: id, changeType: "entity-updated", status: current.status, name: nextName, locationType: nextType, timezone: nextTimezone, address: nextAddress, geoPoint: nextGeo, businessPublicationStatus: business.publicationStatus, updatedAt: now }), now, now,
        ],
      },
    ]);
    if ((results[0]?.meta?.changes ?? 0) !== 1) throw new DatabaseError("Concurrent location update rejected");
    const updated = await this.getLocation(context, id);
    if (!updated) throw new DatabaseError("Location not found after update");
    return updated;
  }

  async setLocationStatus(context: RequestContext, id: EntityId, status: BusinessLocationRecord["status"], now: string): Promise<BusinessLocationRecord> {
    const current = await this.getLocation(context, id);
    if (!current) throw new DatabaseError("Location not found");
    if (current.status === status) return current;
    const business = await this.get(context, current.businessId);
    if (!business) throw new DatabaseError("Business not found");
    const changeType = status === "active" ? "entity-published" : "entity-unpublished";
    const results = await this.database.transaction([
      { sql: `UPDATE locations SET status=?, updated_at=? WHERE id=? AND business_id=? AND status=?`, params: [status, now, id, current.businessId, current.status] },
      { sql: `INSERT INTO outbox_events
          (id, event_type, event_version, aggregate_type, aggregate_id, organization_id, workspace_id, payload_json, status, attempts, available_at, occurred_at, published_at)
          VALUES (?, 'business.location.changed.v1', 1, 'location', ?, ?, ?, ?, 'pending', 0, ?, ?, NULL)`,
        params: [`${id}:business.location.changed.v1:${now}`, id, business.organizationId, business.workspaceId,
          JSON.stringify({ businessId: business.id, locationId: id, changeType, status, name: current.name, locationType: current.locationType, timezone: current.timezone, address: current.address, geoPoint: current.geoPoint, businessPublicationStatus: business.publicationStatus, updatedAt: now }), now, now] },
    ]);
    if ((results[0]?.meta?.changes ?? 0) !== 1) throw new DatabaseError("Concurrent location status transition rejected");
    const updated = await this.getLocation(context, id);
    if (!updated) throw new DatabaseError("Location not found after status update");
    return updated;
  }

  async getLocation(context: RequestContext, id: EntityId): Promise<BusinessLocationRecord | null> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const row = await this.database.first<{ id: EntityId; businessId: EntityId; name: string; locationType: BusinessLocationRecord["locationType"]; timezone: string | null; addressJson: string | null; geoPointJson: string | null; status: BusinessLocationRecord["status"]; createdAt: string; updatedAt: string }>(
      `SELECT l.id,l.business_id AS businessId,l.name,l.location_type AS locationType,l.timezone,l.address_json AS addressJson,l.geo_point_json AS geoPointJson,l.status,l.created_at AS createdAt,l.updated_at AS updatedAt
       FROM locations l JOIN businesses b ON b.id=l.business_id
       WHERE l.id=? AND b.organization_id=? AND b.workspace_id=? LIMIT 1`, id, organizationId, workspaceId);
    if (!row) return null;
    return parseLocationRow(row);
  }

  private async assertWorkspace(organizationId: EntityId, workspaceId: EntityId): Promise<void> {
    const workspace = await this.database.first<{ id: string }>(
      `SELECT id FROM workspaces WHERE id = ? AND organization_id = ? AND status = 'active' LIMIT 1`,
      workspaceId, organizationId,
    );
    if (!workspace) throw new DatabaseError("Workspace is not active in the requested organization");
  }
}

function parseLocationRow(row: {
  id: EntityId; businessId: EntityId; name: string; locationType: BusinessLocationRecord["locationType"];
  timezone: string | null; addressJson: string | null; geoPointJson: string | null;
  status: BusinessLocationRecord["status"]; createdAt: string; updatedAt: string;
}): BusinessLocationRecord {
  let address: Readonly<Record<string, unknown>> | null = null;
  let geoPoint: BusinessLocationRecord["geoPoint"] = null;
  if (row.addressJson) { try { const value = JSON.parse(row.addressJson); if (value && typeof value === "object" && !Array.isArray(value)) address = value as Readonly<Record<string, unknown>>; } catch {} }
  if (row.geoPointJson) { try { const value = JSON.parse(row.geoPointJson) as Record<string, unknown>; if (typeof value.latitude === "number" && Number.isFinite(value.latitude) && typeof value.longitude === "number" && Number.isFinite(value.longitude) && value.latitude >= -90 && value.latitude <= 90 && value.longitude >= -180 && value.longitude <= 180) geoPoint = { latitude: value.latitude, longitude: value.longitude }; } catch {} }
  return { id: row.id, businessId: row.businessId, name: row.name, locationType: row.locationType, timezone: row.timezone, address, geoPoint, status: row.status, createdAt: row.createdAt, updatedAt: row.updatedAt };
}
