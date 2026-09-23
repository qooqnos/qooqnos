import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type CustomerStatus = "active" | "suspended" | "deactivated";

export interface CustomerRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly userId: EntityId | null;
  readonly status: CustomerStatus;
  readonly locale: string | null;
  readonly timezone: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CustomerPreferenceRecord {
  readonly id: EntityId;
  readonly customerId: EntityId;
  readonly attribute: string;
  readonly valueReference: string;
  readonly source: string;
  readonly confidence: number | null;
  readonly persistence: string;
  readonly consentScope: string | null;
  readonly createdAt: string;
  readonly expiresAt: string | null;
}

export interface CreateCustomerInput {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly userId?: EntityId | undefined;
  readonly locale?: string | undefined;
  readonly timezone?: string | undefined;
  readonly now: string;
}

export interface SetCustomerPreferenceInput {
  readonly id: EntityId;
  readonly customerId: EntityId;
  readonly attribute: string;
  readonly valueReference: string;
  readonly source: string;
  readonly confidence?: number | undefined;
  readonly persistence: string;
  readonly consentScope?: string | undefined;
  readonly expiresAt?: string | undefined;
  readonly now: string;
}

export class CustomerRepository extends Repository {
  constructor(database: D1Database) {
    super(database);
  }

  async get(context: RequestContext, id: EntityId): Promise<CustomerRecord | null> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    return this.database.first<CustomerRecord>(
      "SELECT id, organization_id AS organizationId, user_id AS userId, status, locale, timezone, created_at AS createdAt, updated_at AS updatedAt FROM customers WHERE id = ? AND organization_id = ? LIMIT 1",
      id,
      organizationId,
    );
  }

  async create(context: RequestContext, input: CreateCustomerInput): Promise<CustomerRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    if (input.organizationId !== organizationId) {
      throw new DatabaseError("Customer creation scope does not match request context");
    }
    await this.database.transaction([
      {
        sql: "INSERT INTO customers (id, organization_id, user_id, status, locale, timezone, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?, ?, ?)",
        params: [
          input.id,
          input.organizationId,
          input.userId ?? null,
          input.locale ?? null,
          input.timezone ?? null,
          input.now,
          input.now,
        ],
      },
      {
        sql: "INSERT INTO outbox_events (id, event_type, event_version, aggregate_type, aggregate_id, organization_id, workspace_id, payload_json, status, attempts, available_at, occurred_at, published_at) VALUES (?, 'customer.created', 1, 'Customer', ?, ?, ?, ?, 'pending', 0, ?, ?, NULL)",
        params: [
          input.id + ":created",
          input.id,
          input.organizationId,
          context.workspaceId ?? null,
          JSON.stringify({ customerId: input.id }),
          input.now,
          input.now,
        ],
      },
    ]);

    const record = await this.get(context, input.id);
    if (!record) throw new DatabaseError("Customer not found after creation");
    return record;
  }

  async updateProfile(
    context: RequestContext,
    id: EntityId,
    input: {
      readonly locale?: string | null;
      readonly timezone?: string | null;
      readonly status?: CustomerStatus;
      readonly now: string;
    },
  ): Promise<CustomerRecord> {
    const current = await this.get(context, id);
    if (!current) throw new DatabaseError("Customer not found");

    await this.database.transaction([
      {
        sql: "UPDATE customers SET locale = ?, timezone = ?, status = ?, updated_at = ? WHERE id = ? AND organization_id = ?",
        params: [
          input.locale === undefined ? current.locale : input.locale,
          input.timezone === undefined ? current.timezone : input.timezone,
          input.status ?? current.status,
          input.now,
          id,
          current.organizationId,
        ],
      },
      {
        sql: "INSERT OR IGNORE INTO outbox_events (id, event_type, event_version, aggregate_type, aggregate_id, organization_id, workspace_id, payload_json, status, attempts, available_at, occurred_at, published_at) VALUES (?, 'customer.updated', 1, 'Customer', ?, ?, ?, ?, 'pending', 0, ?, ?, NULL)",
        params: [
          id + ":updated:" + input.now,
          id,
          current.organizationId,
          context.workspaceId ?? null,
          JSON.stringify({ customerId: id, change: "profile" }),
          input.now,
          input.now,
        ],
      },
    ]);

    const updated = await this.get(context, id);
    if (!updated) throw new DatabaseError("Customer not found after profile update");
    return updated;
  }

  async setStatus(
    context: RequestContext,
    id: EntityId,
    status: CustomerStatus,
    now: string,
  ): Promise<CustomerRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const result = await this.database.transaction([
      {
        sql: "UPDATE customers SET status = ?, updated_at = ? WHERE id = ? AND organization_id = ?",
        params: [status, now, id, organizationId],
      },
      {
        sql: "INSERT OR IGNORE INTO outbox_events (id, event_type, event_version, aggregate_type, aggregate_id, organization_id, workspace_id, payload_json, status, attempts, available_at, occurred_at, published_at) VALUES (?, 'customer.updated', 1, 'Customer', ?, ?, ?, ?, 'pending', 0, ?, ?, NULL)",
        params: [
          id + ":updated:" + now,
          id,
          organizationId,
          context.workspaceId ?? null,
          JSON.stringify({ customerId: id, change: "status", status }),
          now,
          now,
        ],
      },
    ]);
    if ((result[0]?.meta?.changes ?? 0) !== 1) throw new DatabaseError("Customer status update was rejected");

    const updated = await this.get(context, id);
    if (!updated) throw new DatabaseError("Customer not found after status update");
    return updated;
  }

  async setPreference(
    context: RequestContext,
    input: SetCustomerPreferenceInput,
  ): Promise<CustomerPreferenceRecord> {
    await this.requireCustomer(context, input.customerId);
    if (input.confidence !== undefined && (input.confidence < 0 || input.confidence > 1)) {
      throw new DatabaseError("Customer preference confidence must be between 0 and 1");
    }
    if (!input.attribute.trim()) throw new DatabaseError("Customer preference attribute is required");
    if (!input.valueReference.trim()) throw new DatabaseError("Customer preference value reference is required");

    await this.database.transaction([
      {
        sql: "INSERT INTO customer_preferences (id, customer_id, attribute, value_reference, source, confidence, persistence, consent_scope, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params: [
          input.id,
          input.customerId,
          input.attribute.trim(),
          input.valueReference,
          input.source,
          input.confidence ?? null,
          input.persistence,
          input.consentScope ?? null,
          input.now,
          input.expiresAt ?? null,
        ],
      },
      {
        sql: "INSERT OR IGNORE INTO outbox_events (id, event_type, event_version, aggregate_type, aggregate_id, organization_id, workspace_id, payload_json, status, attempts, available_at, occurred_at, published_at) VALUES (?, 'customer.preference.changed', 1, 'Customer', ?, ?, ?, ?, 'pending', 0, ?, ?, NULL)",
        params: [
          input.id + ":changed",
          input.customerId,
          context.tenantId ?? null,
          context.workspaceId ?? null,
          JSON.stringify({ customerId: input.customerId, preferenceId: input.id, attribute: input.attribute.trim() }),
          input.now,
          input.now,
        ],
      },
    ]);

    const preference = await this.database.first<CustomerPreferenceRecord>(
      "SELECT id, customer_id AS customerId, attribute, value_reference AS valueReference, source, confidence, persistence, consent_scope AS consentScope, created_at AS createdAt, expires_at AS expiresAt FROM customer_preferences WHERE id = ? LIMIT 1",
      input.id,
    );
    if (!preference) throw new DatabaseError("Customer preference not found after creation");
    return preference;
  }

  async listPreferences(
    context: RequestContext,
    customerId: EntityId,
  ): Promise<readonly CustomerPreferenceRecord[]> {
    await this.requireCustomer(context, customerId);
    return this.database.all<CustomerPreferenceRecord>(
      "SELECT id, customer_id AS customerId, attribute, value_reference AS valueReference, source, confidence, persistence, consent_scope AS consentScope, created_at AS createdAt, expires_at AS expiresAt FROM customer_preferences WHERE customer_id = ? ORDER BY created_at DESC, id DESC",
      customerId,
    );
  }

  private async requireCustomer(context: RequestContext, customerId: EntityId): Promise<CustomerRecord> {
    const customer = await this.get(context, customerId);
    if (!customer) throw new DatabaseError("Customer is not available in the current organization");
    return customer;
  }
}
