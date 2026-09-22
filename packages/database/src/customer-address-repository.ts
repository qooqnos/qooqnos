import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export interface CustomerAddressRecord {
  readonly id: EntityId;
  readonly customerId: EntityId;
  readonly countryCode: string;
  readonly administrativeArea: string | null;
  readonly locality: string | null;
  readonly district: string | null;
  readonly postalCode: string | null;
  readonly streetLine1: string | null;
  readonly streetLine2: string | null;
  readonly buildingNumber: string | null;
  readonly unit: string | null;
  readonly formatted: string | null;
  readonly locale: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateCustomerAddressInput {
  readonly id: EntityId;
  readonly customerId: EntityId;
  readonly countryCode: string;
  readonly administrativeArea?: string | undefined;
  readonly locality?: string | undefined;
  readonly district?: string | undefined;
  readonly postalCode?: string | undefined;
  readonly streetLine1?: string | undefined;
  readonly streetLine2?: string | undefined;
  readonly buildingNumber?: string | undefined;
  readonly unit?: string | undefined;
  readonly formatted?: string | undefined;
  readonly locale?: string | undefined;
  readonly now: string;
}

export class CustomerAddressRepository extends Repository {
  constructor(database: D1Database) {
    super(database);
  }

  async create(
    context: RequestContext,
    input: CreateCustomerAddressInput,
  ): Promise<CustomerAddressRecord> {
    const customer = await this.database.first<{ id: EntityId }>(
      "SELECT id FROM customers WHERE id = ? AND organization_id = ? LIMIT 1",
      input.customerId,
      this.requireOrganization({ organizationId: context.tenantId }),
    );
    if (!customer) throw new DatabaseError("Customer is not available in the current organization");
    if (!input.countryCode.trim()) throw new DatabaseError("Customer address country code is required");

    await this.database.run(
      "INSERT INTO customer_addresses (id, customer_id, country_code, administrative_area, locality, district, postal_code, street_line_1, street_line_2, building_number, unit, formatted, locale, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id,
      input.customerId,
      input.countryCode.trim().toUpperCase(),
      input.administrativeArea ?? null,
      input.locality ?? null,
      input.district ?? null,
      input.postalCode ?? null,
      input.streetLine1 ?? null,
      input.streetLine2 ?? null,
      input.buildingNumber ?? null,
      input.unit ?? null,
      input.formatted ?? null,
      input.locale ?? null,
      input.now,
      input.now,
    );

    const record = await this.get(context, input.id);
    if (!record) throw new DatabaseError("Customer address not found after creation");
    return record;
  }

  async get(context: RequestContext, id: EntityId): Promise<CustomerAddressRecord | null> {
    return this.database.first<CustomerAddressRecord>(
      "SELECT ca.id, ca.customer_id AS customerId, ca.country_code AS countryCode, ca.administrative_area AS administrativeArea, ca.locality, ca.district, ca.postal_code AS postalCode, ca.street_line_1 AS streetLine1, ca.street_line_2 AS streetLine2, ca.building_number AS buildingNumber, ca.unit, ca.formatted, ca.locale, ca.created_at AS createdAt, ca.updated_at AS updatedAt FROM customer_addresses ca INNER JOIN customers c ON c.id = ca.customer_id WHERE ca.id = ? AND c.organization_id = ? LIMIT 1",
      id,
      this.requireOrganization({ organizationId: context.tenantId }),
    );
  }

  async update(
    context: RequestContext,
    id: EntityId,
    input: Omit<CreateCustomerAddressInput, "id" | "customerId" | "now"> & { now: string },
  ): Promise<CustomerAddressRecord> {
    const current = await this.get(context, id);
    if (!current) throw new DatabaseError("Customer address not found");
    if (!input.countryCode.trim()) throw new DatabaseError("Customer address country code is required");

    await this.database.run(
      "UPDATE customer_addresses SET country_code = ?, administrative_area = ?, locality = ?, district = ?, postal_code = ?, street_line_1 = ?, street_line_2 = ?, building_number = ?, unit = ?, formatted = ?, locale = ?, updated_at = ? WHERE id = ?",
      input.countryCode.trim().toUpperCase(),
      input.administrativeArea ?? null,
      input.locality ?? null,
      input.district ?? null,
      input.postalCode ?? null,
      input.streetLine1 ?? null,
      input.streetLine2 ?? null,
      input.buildingNumber ?? null,
      input.unit ?? null,
      input.formatted ?? null,
      input.locale ?? null,
      input.now,
      id,
    );
    const updated = await this.get(context, id);
    if (!updated) throw new DatabaseError("Customer address not found after update");
    return updated;
  }

  async list(
    context: RequestContext,
    customerId: EntityId,
  ): Promise<readonly CustomerAddressRecord[]> {
    const customer = await this.database.first<{ id: EntityId }>(
      "SELECT id FROM customers WHERE id = ? AND organization_id = ? LIMIT 1",
      customerId,
      this.requireOrganization({ organizationId: context.tenantId }),
    );
    if (!customer) throw new DatabaseError("Customer is not available in the current organization");

    return this.database.all<CustomerAddressRecord>(
      "SELECT ca.id, ca.customer_id AS customerId, ca.country_code AS countryCode, ca.administrative_area AS administrativeArea, ca.locality, ca.district, ca.postal_code AS postalCode, ca.street_line_1 AS streetLine1, ca.street_line_2 AS streetLine2, ca.building_number AS buildingNumber, ca.unit, ca.formatted, ca.locale, ca.created_at AS createdAt, ca.updated_at AS updatedAt FROM customer_addresses ca WHERE ca.customer_id = ? ORDER BY ca.created_at DESC, ca.id DESC",
      customerId,
    );
  }
}
