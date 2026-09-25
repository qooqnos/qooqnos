import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";
import { CatalogAttributeValueRepository } from "./attribute-value-repository";

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

export interface ServiceRecord {
  readonly id: EntityId;
  readonly businessId: EntityId | null;
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
  readonly description?: string | undefined;
  readonly now: string;
}

export interface CreateProductVariantInput {
  readonly id: EntityId;
  readonly productId: EntityId;
  readonly sku?: string | undefined;
  readonly attributes?: Readonly<Record<string, unknown>> | undefined;
  readonly now: string;
}

export interface CreateOfferingInput {
  readonly id: EntityId;
  readonly businessId: EntityId;
  readonly offeringType: OfferingType;
  readonly title: string;
  readonly description?: string | undefined;
  readonly serviceId?: EntityId | undefined;
  readonly productId?: EntityId | undefined;
  readonly now: string;
}

interface ProductVariantRow {
  readonly id: EntityId;
  readonly productId: EntityId;
  readonly sku: string | null;
  readonly status: CatalogStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class CatalogRepository extends Repository {
  constructor(database: D1Database) { super(database); }

  async getService(context: RequestContext, id: EntityId): Promise<ServiceRecord | null> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    return this.database.first<ServiceRecord>(
      `SELECT s.id, s.business_id AS businessId, s.name, s.description, s.status,
              s.created_at AS createdAt, s.updated_at AS updatedAt
       FROM services s
       LEFT JOIN businesses b ON b.id = s.business_id
       WHERE s.id = ? AND (s.business_id IS NULL OR (b.organization_id = ? AND b.workspace_id = ?))
       LIMIT 1`,
      id, organizationId, workspaceId,
    );
  }

  async listBusinessEntityIds(context: RequestContext, businessId: EntityId): Promise<{
    readonly productIds: readonly EntityId[];
    readonly serviceIds: readonly EntityId[];
  }> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const products = await this.database.all<{ id: EntityId }>(
      `SELECT p.id FROM products p
       INNER JOIN businesses b ON b.id = p.business_id
       WHERE p.business_id = ? AND p.status = 'active'
         AND b.organization_id = ? AND b.workspace_id = ?
       ORDER BY p.id ASC`,
      businessId, organizationId, workspaceId,
    );
    const services = await this.database.all<{ id: EntityId }>(
      `SELECT s.id FROM services s
       INNER JOIN businesses b ON b.id = s.business_id
       WHERE s.business_id = ? AND s.status = 'active'
         AND b.organization_id = ? AND b.workspace_id = ?
       ORDER BY s.id ASC`,
      businessId, organizationId, workspaceId,
    );
    return {
      productIds: products.map((row) => row.id),
      serviceIds: services.map((row) => row.id),
    };
  }

  async getProduct(context: RequestContext, id: EntityId): Promise<ProductRecord | null> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    return this.database.first<ProductRecord>(
      `SELECT p.id, p.business_id AS businessId, p.name, p.description, p.status,
              p.created_at AS createdAt, p.updated_at AS updatedAt
       FROM products p
       INNER JOIN businesses b ON b.id = p.business_id
       WHERE p.id = ? AND b.organization_id = ? AND b.workspace_id = ? LIMIT 1`,
      id, organizationId, workspaceId,
    );
  }

  async getProductVariant(context: RequestContext, id: EntityId): Promise<ProductVariantRecord | null> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const row = await this.database.first<ProductVariantRecord & { attributesJson: string | null }>(
      "SELECT v.id,v.product_id AS productId,v.sku,v.attributes_json AS attributesJson,v.status,v.created_at AS createdAt,v.updated_at AS updatedAt FROM product_variants v INNER JOIN products p ON p.id=v.product_id WHERE v.id=? AND p.organization_id=? AND p.workspace_id=? LIMIT 1",
      id, organizationId, workspaceId,
    );
    if (!row) return null;
    return { ...row, attributes: row.attributesJson ? parseObject(row.attributesJson) : null };
  }

  async listProductVariants(context: RequestContext, productId: EntityId): Promise<readonly ProductVariantRecord[]> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const rows = await this.database.all<{
      id: EntityId; productId: EntityId; sku: string | null; status: CatalogStatus; createdAt: string; updatedAt: string;
    }>(
      `SELECT pv.id, pv.product_id AS productId, pv.sku, pv.status,
              pv.created_at AS createdAt, pv.updated_at AS updatedAt
       FROM product_variants pv
       INNER JOIN products p ON p.id = pv.product_id
       INNER JOIN businesses b ON b.id = p.business_id
       WHERE pv.product_id = ? AND b.organization_id = ? AND b.workspace_id = ?
       ORDER BY pv.id ASC`,
      productId, organizationId, workspaceId,
    );
    const attributes = new CatalogAttributeValueRepository(this.database);
    const result: ProductVariantRecord[] = [];
    for (const row of rows) {
      const values = await attributes.listForTarget(context, "product_variant", row.id);
      const mapped: Record<string, unknown> = {};
      for (const value of values) {
        const definition = await this.database.first<{ canonicalKey: string }>(
          "SELECT canonical_key AS canonicalKey FROM attribute_definitions WHERE id = ? LIMIT 1",
          value.attributeDefinitionId,
        );
        if (!definition) continue;
        if (value.scalar) mapped[definition.canonicalKey] = value.scalar.value;
        else if (value.optionId) {
          const option = await this.database.first<{ canonicalValue: string }>(
            "SELECT canonical_value AS canonicalValue FROM attribute_options WHERE id = ? LIMIT 1",
            value.optionId,
          );
          if (option) mapped[definition.canonicalKey] = option.canonicalValue;
        } else if (value.multiEnumOptionIds.length) {
          const placeholders = value.multiEnumOptionIds.map(() => "?").join(", ");
          const options = await this.database.all<{ canonicalValue: string }>(
            "SELECT canonical_value AS canonicalValue FROM attribute_options WHERE id IN (" + placeholders + ") ORDER BY canonical_value ASC",
            ...value.multiEnumOptionIds,
          );
          mapped[definition.canonicalKey] = options.map((option) => option.canonicalValue);
        }
      }
      result.push({
        id: row.id, productId: row.productId, sku: row.sku,
        attributes: Object.keys(mapped).length ? mapped : null,
        status: row.status, createdAt: row.createdAt, updatedAt: row.updatedAt,
      });
    }
    return result;
  }

  async getOffering(context: RequestContext, id: EntityId): Promise<OfferingRecord | null> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    return this.database.first<OfferingRecord>(
      `SELECT o.id, o.business_id AS businessId, o.offering_type AS offeringType,
              o.title, o.description, o.service_id AS serviceId, o.product_id AS productId,
              o.status, o.publication_status AS publicationStatus,
              o.created_at AS createdAt, o.updated_at AS updatedAt
       FROM offerings o INNER JOIN businesses b ON b.id = o.business_id
       WHERE o.id = ? AND b.organization_id = ? AND b.workspace_id = ? LIMIT 1`,
      id, organizationId, workspaceId,
    );
  }

  async createProduct(context: RequestContext, input: CreateProductInput): Promise<ProductRecord> {
    await this.assertBusiness(context, input.businessId);
    await this.database.run(
      `INSERT INTO products (id, business_id, name, description, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
      input.id, input.businessId, input.name, input.description ?? null, input.now, input.now,
    );
    return this.requireProduct(context, input.id, input.businessId);
  }

  async createProductVariant(context: RequestContext, input: CreateProductVariantInput): Promise<ProductVariantRecord> {
    const product = await this.database.first<{ businessId: EntityId }>(
      `SELECT p.business_id AS businessId
       FROM products p INNER JOIN businesses b ON b.id = p.business_id
       WHERE p.id = ? AND b.organization_id = ? AND b.workspace_id = ? LIMIT 1`,
      input.productId,
      this.requireOrganization({ organizationId: context.tenantId }),
      this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
    if (!product) throw new DatabaseError("Product is not available in the current workspace");
    const sku = input.sku?.trim() || null;
    if (sku) {
      const duplicate = await this.database.first<{ id: string }>(
        `SELECT pv.id FROM product_variants pv INNER JOIN products p ON p.id = pv.product_id
         WHERE p.business_id = ? AND pv.sku = ? LIMIT 1`, product.businessId, sku,
      );
      if (duplicate) throw new DatabaseError("SKU already exists in this business");
    }
    await this.database.run(
      `INSERT INTO product_variants (id, product_id, sku, attributes_json, status, created_at, updated_at)
       VALUES (?, ?, ?, NULL, 'draft', ?, ?)`,
      input.id, input.productId, sku, input.now, input.now,
    );
    try {
      const attributeValues = new CatalogAttributeValueRepository(this.database);
      const normalized: Record<string, unknown> = {};
      for (const [canonicalKey, value] of Object.entries(input.attributes ?? {})) {
        const record = await attributeValues.setByCanonicalKey(context, {
          id: input.id + ":attribute:" + canonicalKey,
          attributeDefinitionCanonicalKey: canonicalKey,
          targetType: "product_variant",
          targetId: input.id,
          sourceType: "seller_input",
          value,
          now: input.now,
        });
        normalized[canonicalKey] = record.normalizedValue;
      }
      const record = await this.database.first<ProductVariantRow>(
        `SELECT id, product_id AS productId, sku, status,
                created_at AS createdAt, updated_at AS updatedAt FROM product_variants WHERE id = ? LIMIT 1`,
        input.id,
      );
      if (!record) throw new DatabaseError("Product variant not found after creation");
      return {
        id: record.id, productId: record.productId, sku: record.sku,
        attributes: Object.keys(normalized).length ? normalized : null,
        status: record.status, createdAt: record.createdAt, updatedAt: record.updatedAt,
      };
    } catch (error) {
      await this.database.run("DELETE FROM product_variants WHERE id = ?", input.id);
      throw error;
    }
  }

  async createOffering(context: RequestContext, input: CreateOfferingInput): Promise<OfferingRecord> {
    await this.assertBusiness(context, input.businessId);
    if (input.offeringType === "service" && (!input.serviceId || input.productId)) throw new DatabaseError("Service offering requires only serviceId");
    if (input.offeringType === "product" && (!input.productId || input.serviceId)) throw new DatabaseError("Product offering requires only productId");
    if (input.productId) await this.assertProductBelongsToBusiness(context, input.productId, input.businessId);
    if (input.serviceId) await this.assertServiceBelongsToBusiness(context, input.serviceId, input.businessId);
    await this.database.run(
      `INSERT INTO offerings (id, business_id, offering_type, title, description, service_id, product_id,
       status, publication_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 'unpublished', ?, ?)`,
      input.id, input.businessId, input.offeringType, input.title, input.description ?? null,
      input.serviceId ?? null, input.productId ?? null, input.now, input.now,
    );
    return this.requireOffering(context, input.id, input.businessId);
  }

  async setOfferingPublicationStatus(context: RequestContext, id: EntityId, status: PublicationStatus, now: string): Promise<OfferingRecord> {
    const current = await this.getOffering(context, id);
    if (!current) throw new DatabaseError("Offering not found");
    if (status === "published") throw new DatabaseError("Offering publication requires the canonical publication policy");
    await this.database.run(`UPDATE offerings SET publication_status = ?, updated_at = ? WHERE id = ? AND business_id = ?`, status, now, id, current.businessId);
    return this.requireOffering(context, id, current.businessId);
  }

  private async assertBusiness(context: RequestContext, businessId: EntityId): Promise<void> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const business = await this.database.first<{ id: string }>(
      `SELECT id FROM businesses
       WHERE id = ? AND organization_id = ? AND workspace_id = ? AND status IN ('draft','active') LIMIT 1`,
      businessId, organizationId, workspaceId,
    );
    if (!business) throw new DatabaseError("Business is not available in the current workspace");
  }

  private async assertProductBelongsToBusiness(context: RequestContext, productId: EntityId, businessId: EntityId): Promise<void> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const row = await this.database.first<{ id: string }>(
      `SELECT p.id FROM products p
       INNER JOIN businesses b ON b.id = p.business_id
       WHERE p.id = ? AND p.business_id = ? AND b.organization_id = ? AND b.workspace_id = ? LIMIT 1`,
      productId, businessId, organizationId, workspaceId,
    );
    if (!row) throw new DatabaseError("Product does not belong to the offering business");
  }

  private async assertServiceBelongsToBusiness(context: RequestContext, serviceId: EntityId, businessId: EntityId): Promise<void> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const row = await this.database.first<{ id: string }>(
      `SELECT s.id FROM services s
       WHERE s.id = ? AND (s.business_id IS NULL OR s.business_id = ?)
         AND (s.business_id IS NULL OR EXISTS (
           SELECT 1 FROM businesses b WHERE b.id = s.business_id AND b.organization_id = ? AND b.workspace_id = ?
         )) LIMIT 1`,
      serviceId, businessId, organizationId, workspaceId,
    );
    if (!row) throw new DatabaseError("Service does not belong to the offering business");
  }

  private async requireProduct(context: RequestContext, id: EntityId, businessId: EntityId): Promise<ProductRecord> {
    const record = await this.getProduct(context, id);
    if (!record || record.businessId !== businessId) throw new DatabaseError("Product not found after creation");
    return record;
  }

  private async requireOffering(context: RequestContext, id: EntityId, businessId: EntityId): Promise<OfferingRecord> {
    const record = await this.getOffering(context, id);
    if (!record || record.businessId !== businessId) throw new DatabaseError("Offering not found after creation");
    return record;
  }
}