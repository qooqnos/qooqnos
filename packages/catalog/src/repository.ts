import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type CatalogStatus = "draft" | "active" | "inactive" | "archived";
export type OfferingType = "service" | "product";
export type PublicationStatus = "unpublished" | "pending" | "published" | "blocked";

export interface ProductRecord {
  readonly id: EntityId;
  readonly businessId: EntityId;
  readonly name: string;
  readonly description: string | null;
  readonly status: CatalogStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProductVariantRecord {
  readonly id: EntityId;
  readonly productId: EntityId;
  readonly sku: string | null;
  readonly attributes: Readonly<Record<string, unknown>> | null;
  readonly status: CatalogStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface OfferingRecord {
  readonly id: EntityId;
  readonly businessId: EntityId;
  readonly offeringType: OfferingType;
  readonly title: string;
  readonly description: string | null;
  readonly serviceId: EntityId | null;
  readonly productId: EntityId | null;
  readonly status: CatalogStatus;
  readonly publicationStatus: PublicationStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateProductInput {
  readonly id: EntityId;
  readonly businessId: EntityId;
  readonly name: string;
  readonly description?: string;
  readonly now: string;
}

export interface CreateProductVariantInput {
  readonly id: EntityId;
  readonly productId: EntityId;
  readonly sku?: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
  readonly now: string;
}

export interface CreateOfferingInput {
  readonly id: EntityId;
  readonly businessId: EntityId;
  readonly offeringType: OfferingType;
  readonly title: string;
  readonly description?: string;
  readonly serviceId?: EntityId;
  readonly productId?: EntityId;
  readonly now: string;
}

interface ProductVariantRow {
  readonly id: EntityId;
  readonly productId: EntityId;
  readonly sku: string | null;
  readonly attributesJson: string | null;
  readonly status: CatalogStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class CatalogRepository extends Repository {
  constructor(database: D1Database) { super(database); }

  async getProduct(context: RequestContext, id: EntityId): Promise<ProductRecord | null> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    return this.database.first<ProductRecord>(
      `SELECT p.id, p.business_id AS businessId, p.name, p.description, p.status,
              p.created_at AS createdAt, p.updated_at AS updatedAt
       FROM products p
       INNER JOIN businesses b ON b.id = p.business_id
       WHERE p.id = ? AND b.organization_id = ? AND b.workspace_id = ?
       LIMIT 1`,
      id, organizationId, workspaceId,
    );
  }

  async getOffering(context: RequestContext, id: EntityId): Promise<OfferingRecord | null> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    return this.database.first<OfferingRecord>(
      `SELECT o.id, o.business_id AS businessId, o.offering_type AS offeringType,
              o.title, o.description, o.service_id AS serviceId, o.product_id AS productId,
              o.status, o.publication_status AS publicationStatus,
              o.created_at AS createdAt, o.updated_at AS updatedAt
       FROM offerings o
       INNER JOIN businesses b ON b.id = o.business_id
       WHERE o.id = ? AND b.organization_id = ? AND b.workspace_id = ?
       LIMIT 1`,
      id, organizationId, workspaceId,
    );
  }

  async createProduct(input: CreateProductInput): Promise<ProductRecord> {
    await this.assertBusiness(input.businessId);
    await this.database.run(
      `INSERT INTO products (id, business_id, name, description, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
      input.id, input.businessId, input.name, input.description ?? null, input.now, input.now,
    );
    return this.requireProduct(input.id, input.businessId);
  }

  async createProductVariant(input: CreateProductVariantInput): Promise<ProductVariantRecord> {
    const product = await this.database.first<{ businessId: EntityId }>(
      `SELECT business_id AS businessId FROM products WHERE id = ? LIMIT 1`, input.productId,
    );
    if (!product) throw new DatabaseError("Product not found");
    const sku = input.sku?.trim() || null;
    if (sku) {
      const duplicate = await this.database.first<{ id: string }>(
        `SELECT pv.id FROM product_variants pv
         INNER JOIN products p ON p.id = pv.product_id
         WHERE p.business_id = ? AND pv.sku = ? LIMIT 1`,
        product.businessId, sku,
      );
      if (duplicate) throw new DatabaseError("SKU already exists in this business");
    }
    await this.database.run(
      `INSERT INTO product_variants
       (id, product_id, sku, attributes_json, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
      input.id, input.productId, sku, input.attributes ? JSON.stringify(input.attributes) : null, input.now, input.now,
    );
    const record = await this.database.first<ProductVariantRow>(
      `SELECT id, product_id AS productId, sku, attributes_json AS attributesJson,
              status, created_at AS createdAt, updated_at AS updatedAt
       FROM product_variants WHERE id = ? LIMIT 1`,
      input.id,
    );
    if (!record) throw new DatabaseError("Product variant not found after creation");
    return {
      id: record.id,
      productId: record.productId,
      sku: record.sku,
      attributes: record.attributesJson ? JSON.parse(record.attributesJson) as Readonly<Record<string, unknown>> : null,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async createOffering(input: CreateOfferingInput): Promise<OfferingRecord> {
    await this.assertBusiness(input.businessId);
    if (input.offeringType === "service" && (!input.serviceId || input.productId)) throw new DatabaseError("Service offering requires only serviceId");
    if (input.offeringType === "product" && (!input.productId || input.serviceId)) throw new DatabaseError("Product offering requires only productId");
    if (input.productId) await this.assertProductBelongsToBusiness(input.productId, input.businessId);
    if (input.serviceId) await this.assertServiceBelongsToBusiness(input.serviceId, input.businessId);
    await this.database.run(
      `INSERT INTO offerings
       (id, business_id, offering_type, title, description, service_id, product_id,
        status, publication_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 'unpublished', ?, ?)`,
      input.id, input.businessId, input.offeringType, input.title, input.description ?? null,
      input.serviceId ?? null, input.productId ?? null, input.now, input.now,
    );
    return this.requireOffering(input.id, input.businessId);
  }

  async setOfferingPublicationStatus(context: RequestContext, id: EntityId, status: PublicationStatus, now: string): Promise<OfferingRecord> {
    const current = await this.getOffering(context, id);
    if (!current) throw new DatabaseError("Offering not found");
    if (status === "published") throw new DatabaseError("Offering publication requires the canonical publication policy");
    await this.database.run(
      `UPDATE offerings SET publication_status = ?, updated_at = ? WHERE id = ? AND business_id = ?`,
      status, now, id, current.businessId,
    );
    return this.requireOffering(id, current.businessId);
  }

  private async assertBusiness(businessId: EntityId): Promise<void> {
    const business = await this.database.first<{ id: string }>(
      `SELECT id FROM businesses WHERE id = ? AND status IN ('draft','active') LIMIT 1`, businessId,
    );
    if (!business) throw new DatabaseError("Business is not available for catalog changes");
  }

  private async assertProductBelongsToBusiness(productId: EntityId, businessId: EntityId): Promise<void> {
    const row = await this.database.first<{ id: string }>(`SELECT id FROM products WHERE id = ? AND business_id = ? LIMIT 1`, productId, businessId);
    if (!row) throw new DatabaseError("Product does not belong to the offering business");
  }

  private async assertServiceBelongsToBusiness(serviceId: EntityId, businessId: EntityId): Promise<void> {
    const row = await this.database.first<{ id: string }>(`SELECT id FROM services WHERE id = ? AND (business_id IS NULL OR business_id = ?) LIMIT 1`, serviceId, businessId);
    if (!row) throw new DatabaseError("Service does not belong to the offering business");
  }

  private async requireProduct(id: EntityId, businessId: EntityId): Promise<ProductRecord> {
    const record = await this.database.first<ProductRecord>(
      `SELECT id, business_id AS businessId, name, description, status, created_at AS createdAt, updated_at AS updatedAt
       FROM products WHERE id = ? AND business_id = ? LIMIT 1`, id, businessId,
    );
    if (!record) throw new DatabaseError("Product not found after creation");
    return record;
  }

  private async requireOffering(id: EntityId, businessId: EntityId): Promise<OfferingRecord> {
    const record = await this.database.first<OfferingRecord>(
      `SELECT id, business_id AS businessId, offering_type AS offeringType, title, description,
              service_id AS serviceId, product_id AS productId, status,
              publication_status AS publicationStatus, created_at AS createdAt, updated_at AS updatedAt
       FROM offerings WHERE id = ? AND business_id = ? LIMIT 1`, id, businessId,
    );
    if (!record) throw new DatabaseError("Offering not found after creation");
    return record;
  }
}
