import { brandId, type EntityId, type RequestContext } from "@qooqnos/core";
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

export interface BusinessProductVariantRecord {
  readonly id: EntityId;
  readonly productId: EntityId;
  readonly productName: string;
  readonly sku: string | null;
  readonly attributes: Readonly<Record<string, unknown>> | null;
  readonly status: CatalogStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BusinessInventoryRecord {
  readonly id: EntityId;
  readonly businessId: EntityId;
  readonly productId: EntityId;
  readonly productName: string;
  readonly variantId: EntityId;
  readonly sku: string | null;
  readonly attributesJson: string | null;
  readonly variantStatus: CatalogStatus;
  readonly locationId: EntityId;
  readonly locationName: string;
  readonly quantityOnHand: number;
  readonly quantityReserved: number;
  readonly availableQuantity: number;
  readonly version: number;
  readonly updatedAt: string;
}

export interface PublicBusinessOfferingRecord {
  readonly id: EntityId;
  readonly businessId: EntityId;
  readonly offeringType: OfferingType;
  readonly title: string;
  readonly description: string | null;
  readonly productId: EntityId | null;
  readonly serviceId: EntityId | null;
  readonly priceAmountMinor: number | null;
  readonly currency: string | null;
  readonly pricingType: string | null;
}
export interface PublicOfferingVariantAttribute {
  readonly key: string;
  readonly label: string;
  readonly value: string | number | boolean;
}

export interface PublicOfferingVariantRecord {
  readonly id: EntityId;
  readonly attributes: readonly PublicOfferingVariantAttribute[];
  readonly priceAmountMinor: number | null;
  readonly currency: string | null;
  readonly pricingType: "fixed" | "starting_at" | "from" | "custom" | "free" | null;
  readonly priceSource: "variant" | "offering" | null;
  readonly availability: "in_stock" | "out_of_stock" | "unknown";
}

export interface AdjustBusinessInventoryInput {
  readonly id: EntityId;
  readonly inventoryItemId: EntityId;
  readonly businessId: EntityId;
  readonly expectedVersion: number;
  readonly quantityOnHand: number;
  readonly reason: string;
  readonly now: string;
}

export interface InventoryAdjustmentRecord {
  readonly id: EntityId;
  readonly inventoryItemId: EntityId;
  readonly businessId: EntityId;
  readonly productId: EntityId;
  readonly variantId: EntityId;
  readonly locationId: EntityId;
  readonly quantityBefore: number;
  readonly quantityAfter: number;
  readonly quantityReserved: number;
  readonly availableQuantity: number;
  readonly versionBefore: number;
  readonly versionAfter: number;
  readonly reason: string;
  readonly actorId: EntityId | null;
  readonly createdAt: string;
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

export type OfferingPricingType = "fixed" | "starting_at" | "from" | "custom" | "free";
export interface OfferingPriceRecord {
  readonly id: EntityId;
  readonly offeringId: EntityId;
  readonly productVariantId: EntityId | null;
  readonly amountMinor: number;
  readonly currency: string;
  readonly pricingType: OfferingPricingType;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly status: "active" | "inactive" | "archived";
  readonly createdAt: string;
  readonly updatedAt: string;
}
export interface SetOfferingPriceInput {
  readonly id: EntityId;
  readonly offeringId: EntityId;
  readonly productVariantId?: EntityId | undefined;
  readonly amountMinor: number;
  readonly currency: string;
  readonly pricingType: OfferingPricingType;
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

  async getProductCommerceFacts(context: RequestContext, productId: EntityId, now: string): Promise<{
    readonly price?: number;
    readonly currency?: string;
    readonly availability?: "in_stock" | "out_of_stock";
  }> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const price = await this.database.first<{
      amountMinor: number;
      currency: string;
      pricingType: "fixed" | "starting_at" | "from" | "custom" | "free";
    }>(
      `SELECT pr.amount_minor AS amountMinor, pr.currency,
              pr.pricing_type AS pricingType
         FROM prices pr
         INNER JOIN offerings o ON o.id = pr.offering_id
         INNER JOIN products p ON p.id = o.product_id
         INNER JOIN businesses b ON b.id = p.business_id
        WHERE p.id = ?
          AND b.organization_id = ?
          AND b.workspace_id = ?
          AND pr.product_variant_id IS NULL
          AND p.status = 'active'
          AND o.status = 'active'
          AND o.publication_status = 'published'
          AND pr.product_variant_id IS NULL
          AND pr.status = 'active'
          AND pr.product_variant_id IS NULL
          AND pr.effective_from <= ?
          AND (pr.effective_to IS NULL OR pr.effective_to > ?)
        ORDER BY pr.effective_from DESC, pr.updated_at DESC
        LIMIT 1`,
      productId, organizationId, workspaceId, now, now,
    );
    const stock = await this.database.first<{ availableQuantity: number }>(
      `SELECT COALESCE(SUM(ii.quantity_on_hand - ii.quantity_reserved), 0) AS availableQuantity
         FROM inventory_items ii
         INNER JOIN product_variants pv ON pv.id = ii.product_variant_id
         INNER JOIN products p ON p.id = pv.product_id
         INNER JOIN businesses b ON b.id = p.business_id
        WHERE p.id = ?
          AND b.organization_id = ?
          AND b.workspace_id = ?
          AND pv.status = 'active'`,
      productId, organizationId, workspaceId,
    );
    const result: { price?: number; currency?: string; availability?: "in_stock" | "out_of_stock" } = {};
    if (price && price.pricingType !== "custom") {
      const fractionDigits = new Intl.NumberFormat("en", { style: "currency", currency: price.currency }).resolvedOptions().maximumFractionDigits;
      result.price = price.amountMinor / 10 ** fractionDigits;
      result.currency = price.currency;
    }
    if (stock) result.availability = stock.availableQuantity > 0 ? "in_stock" : "out_of_stock";
    return result;
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

  async listBusinessOfferings(context: RequestContext, businessId: EntityId, limit = 50): Promise<readonly OfferingRecord[]> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    return this.database.all<OfferingRecord>(
      `SELECT o.id, o.business_id AS businessId, o.offering_type AS offeringType,
              o.title, o.description, o.service_id AS serviceId, o.product_id AS productId,
              o.status, o.publication_status AS publicationStatus,
              o.created_at AS createdAt, o.updated_at AS updatedAt
         FROM offerings o
         INNER JOIN businesses b ON b.id = o.business_id
        WHERE o.business_id = ?
          AND b.organization_id = ?
          AND b.workspace_id = ?
        ORDER BY o.updated_at DESC, o.id DESC
        LIMIT ?`,
      businessId, organizationId, workspaceId, safeLimit,
    );
  }

  async listBusinessProductVariants(
    context: RequestContext,
    businessId: EntityId,
    limit = 100,
  ): Promise<readonly BusinessProductVariantRecord[]> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);
    const rows = await this.database.all<{
      id: EntityId;
      productId: EntityId;
      productName: string;
      sku: string | null;
      status: CatalogStatus;
      createdAt: string;
      updatedAt: string;
    }>(
      `SELECT pv.id, pv.product_id AS productId, p.name AS productName, pv.sku,
              pv.status, pv.created_at AS createdAt, pv.updated_at AS updatedAt
       FROM product_variants pv
       INNER JOIN products p ON p.id = pv.product_id
       INNER JOIN businesses b ON b.id = p.business_id
       WHERE p.business_id = ?
         AND b.organization_id = ?
         AND b.workspace_id = ?
         AND p.status != 'archived'
         AND pv.status != 'archived'
       ORDER BY pv.updated_at DESC, pv.id DESC
       LIMIT ?`,
      businessId,
      organizationId,
      workspaceId,
      safeLimit,
    );

    const attributes = new CatalogAttributeValueRepository(this.database);
    const result: BusinessProductVariantRecord[] = [];
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
        id: row.id,
        productId: row.productId,
        productName: row.productName,
        sku: row.sku,
        attributes: Object.keys(mapped).length ? mapped : null,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });
    }
    return result;
  }

  async listBusinessInventory(
    context: RequestContext,
    businessId: EntityId,
    limit = 100,
  ): Promise<readonly BusinessInventoryRecord[]> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);
    return this.database.all<BusinessInventoryRecord>(
      `SELECT ii.id,
              p.business_id AS businessId,
              p.id AS productId,
              p.name AS productName,
              pv.id AS variantId,
              pv.sku,
              pv.attributes_json AS attributesJson,
              pv.status AS variantStatus,
              l.id AS locationId,
              l.name AS locationName,
              ii.quantity_on_hand AS quantityOnHand,
              ii.quantity_reserved AS quantityReserved,
              (ii.quantity_on_hand - ii.quantity_reserved) AS availableQuantity,
              ii.version,
              ii.updated_at AS updatedAt
         FROM inventory_items ii
         INNER JOIN product_variants pv ON pv.id = ii.product_variant_id
         INNER JOIN products p ON p.id = pv.product_id
         INNER JOIN locations l ON l.id = ii.location_id
         INNER JOIN businesses b ON b.id = p.business_id
        WHERE p.business_id = ?
          AND b.organization_id = ?
          AND b.workspace_id = ?
          AND p.status != 'archived'
          AND pv.status != 'archived'
          AND l.status != 'archived'
        ORDER BY ii.updated_at DESC, ii.id DESC
        LIMIT ?`,
      businessId,
      organizationId,
      workspaceId,
      safeLimit,
    );
  }

  async adjustBusinessInventory(context: RequestContext, input: AdjustBusinessInventoryInput): Promise<InventoryAdjustmentRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const reason = input.reason.trim();
    if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1) throw new DatabaseError("Inventory version is invalid");
    if (!Number.isSafeInteger(input.quantityOnHand) || input.quantityOnHand < 0 || input.quantityOnHand > 2_147_483_647) throw new DatabaseError("On-hand quantity must be a non-negative supported integer");
    if (reason.length < 3 || reason.length > 250) throw new DatabaseError("Inventory adjustment reason must be between 3 and 250 characters");

    const current = await this.database.first<BusinessInventoryRecord>(
      `SELECT ii.id, p.business_id AS businessId, p.id AS productId, p.name AS productName,
              pv.id AS variantId, pv.sku, pv.attributes_json AS attributesJson, pv.status AS variantStatus,
              l.id AS locationId, l.name AS locationName, ii.quantity_on_hand AS quantityOnHand,
              ii.quantity_reserved AS quantityReserved, (ii.quantity_on_hand - ii.quantity_reserved) AS availableQuantity,
              ii.version, ii.updated_at AS updatedAt
         FROM inventory_items ii
         INNER JOIN product_variants pv ON pv.id = ii.product_variant_id
         INNER JOIN products p ON p.id = pv.product_id
         INNER JOIN locations l ON l.id = ii.location_id
         INNER JOIN businesses b ON b.id = p.business_id
        WHERE ii.id = ? AND p.business_id = ? AND b.organization_id = ? AND b.workspace_id = ?
          AND p.status != 'archived' AND pv.status != 'archived' AND l.status != 'archived'
        LIMIT 1`,
      input.inventoryItemId, input.businessId, organizationId, workspaceId,
    );
    if (!current) throw new DatabaseError("Inventory item is not available in this business");
    if (current.version !== input.expectedVersion) throw new DatabaseError("Inventory changed since it was loaded; refresh and retry");
    if (input.quantityOnHand < current.quantityReserved) throw new DatabaseError("On-hand quantity cannot be less than reserved quantity");
    if (input.quantityOnHand === current.quantityOnHand) throw new DatabaseError("New quantity must differ from current inventory");

    const nextVersion = input.expectedVersion + 1;
    const actorId = context.actorId ?? null;
    let results;
    try {
      results = await this.database.transaction([
        {
          sql: `UPDATE inventory_items
                   SET quantity_on_hand = ?, version = version + 1, updated_at = ?
                 WHERE id = ? AND version = ? AND quantity_reserved <= ?
                   AND EXISTS (
                     SELECT 1 FROM product_variants pv
                     INNER JOIN products p ON p.id = pv.product_id
                     INNER JOIN businesses b ON b.id = p.business_id
                      WHERE pv.id = inventory_items.product_variant_id
                        AND p.business_id = ? AND b.organization_id = ? AND b.workspace_id = ?
                   )`,
          params: [input.quantityOnHand,input.now,input.inventoryItemId,input.expectedVersion,input.quantityOnHand,input.businessId,organizationId,workspaceId],
        },
        {
          sql: `INSERT INTO inventory_adjustments
                 (id,organization_id,workspace_id,business_id,inventory_item_id,product_variant_id,location_id,
                  version_before,version_after,quantity_before,quantity_after,quantity_reserved,reason,actor_id,created_at)
                SELECT ?,b.organization_id,b.workspace_id,b.id,ii.id,ii.product_variant_id,ii.location_id,
                       ?,ii.version,?,ii.quantity_on_hand,ii.quantity_reserved,?,?,?
                  FROM inventory_items ii
                  INNER JOIN product_variants pv ON pv.id=ii.product_variant_id
                  INNER JOIN products p ON p.id=pv.product_id
                  INNER JOIN businesses b ON b.id=p.business_id
                 WHERE ii.id=? AND ii.version=? AND ii.quantity_on_hand=? AND ii.updated_at=?
                   AND p.business_id=? AND b.organization_id=? AND b.workspace_id=?`,
          params: [input.id,input.expectedVersion,current.quantityOnHand,reason,actorId,input.now,input.inventoryItemId,nextVersion,input.quantityOnHand,input.now,input.businessId,organizationId,workspaceId],
        },
      ]);
    } catch (error) {
      const latest = await this.database.first<{version:number}>(
        `SELECT ii.version FROM inventory_items ii
          INNER JOIN product_variants pv ON pv.id=ii.product_variant_id
          INNER JOIN products p ON p.id=pv.product_id
          INNER JOIN businesses b ON b.id=p.business_id
         WHERE ii.id=? AND p.business_id=? AND b.organization_id=? AND b.workspace_id=? LIMIT 1`,
        input.inventoryItemId,input.businessId,organizationId,workspaceId,
      );
      if (!latest) throw new DatabaseError("Inventory item is not available in this business");
      if (latest.version !== input.expectedVersion) throw new DatabaseError("Inventory changed since it was loaded; refresh and retry");
      throw error;
    }
    if (results[0]?.meta?.changes !== 1 || results[1]?.meta?.changes !== 1) throw new DatabaseError("Inventory changed since it was loaded; refresh and retry");
    return {
      id:input.id,inventoryItemId:current.id,businessId:current.businessId,productId:current.productId,
      variantId:current.variantId,locationId:current.locationId,quantityBefore:current.quantityOnHand,
      quantityAfter:input.quantityOnHand,quantityReserved:current.quantityReserved,
      availableQuantity:input.quantityOnHand-current.quantityReserved,versionBefore:current.version,
      versionAfter:nextVersion,reason,actorId,createdAt:input.now,
    };
  }

  async listPublishedBusinessOfferings(businessId: EntityId, now: string, limit = 50): Promise<readonly PublicBusinessOfferingRecord[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    return this.database.all<PublicBusinessOfferingRecord>(
      `SELECT o.id, o.business_id AS businessId, o.offering_type AS offeringType,
              o.title, o.description, o.product_id AS productId, o.service_id AS serviceId,
              pr.amount_minor AS priceAmountMinor, pr.currency, pr.pricing_type AS pricingType
         FROM offerings o
         INNER JOIN businesses b ON b.id = o.business_id
         LEFT JOIN prices pr
           ON pr.offering_id = o.id
          AND pr.status = 'active'
          AND pr.product_variant_id IS NULL
          AND pr.effective_from <= ?
          AND (pr.effective_to IS NULL OR pr.effective_to > ?)
        WHERE o.business_id = ?
          AND b.status = 'active'
          AND b.publication_status = 'published'
          AND o.status = 'active'
          AND o.publication_status = 'published'
        ORDER BY o.updated_at DESC, o.id DESC
        LIMIT ?`,
      now, now, businessId, safeLimit,
    );
  }
  async listPublishedOfferingVariants(
    context: RequestContext,
    offeringId: EntityId,
    limit = 100,
    now = new Date().toISOString(),
  ): Promise<readonly PublicOfferingVariantRecord[]> {
    const scope = await this.database.first<{
      readonly productId: EntityId;
      readonly organizationId: EntityId;
      readonly workspaceId: EntityId;
    }>(
      `SELECT o.product_id AS productId,
              b.organization_id AS organizationId,
              b.workspace_id AS workspaceId
         FROM offerings o
         INNER JOIN businesses b ON b.id = o.business_id
         INNER JOIN products p ON p.id = o.product_id
        WHERE o.id = ?
          AND o.offering_type = 'product'
          AND o.status = 'active'
          AND o.publication_status = 'published'
          AND b.status = 'active'
          AND b.publication_status = 'published'
          AND p.status != 'archived'
        LIMIT 1`,
      offeringId,
    );
    if (!scope) return [];

    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);
    const variants = await this.database.all<{
      readonly id: EntityId;
      readonly priceAmountMinor: number | null;
      readonly currency: string | null;
      readonly pricingType: PublicOfferingVariantRecord["pricingType"];
      readonly priceSource: PublicOfferingVariantRecord["priceSource"];
      readonly availability: PublicOfferingVariantRecord["availability"];
    }>(
      `SELECT pv.id,
              COALESCE(variant_price.amount_minor, offer_price.amount_minor) AS priceAmountMinor,
              COALESCE(variant_price.currency, offer_price.currency) AS currency,
              COALESCE(variant_price.pricing_type, offer_price.pricing_type) AS pricingType,
              CASE
                WHEN variant_price.id IS NOT NULL THEN 'variant'
                WHEN offer_price.id IS NOT NULL THEN 'offering'
                ELSE NULL
              END AS priceSource,
              CASE
                WHEN EXISTS (
                  SELECT 1
                    FROM inventory_items ii
                    INNER JOIN locations l ON l.id = ii.location_id
                   WHERE ii.product_variant_id = pv.id
                     AND l.business_id = o.business_id
                     AND l.status = 'active'
                ) THEN
                  CASE WHEN COALESCE((
                    SELECT SUM(ii.quantity_on_hand - ii.quantity_reserved)
                      FROM inventory_items ii
                      INNER JOIN locations l ON l.id = ii.location_id
                     WHERE ii.product_variant_id = pv.id
                       AND l.business_id = o.business_id
                       AND l.status = 'active'
                  ), 0) > 0 THEN 'in_stock' ELSE 'out_of_stock' END
                ELSE 'unknown'
              END AS availability
         FROM product_variants pv
         INNER JOIN products p ON p.id = pv.product_id
         INNER JOIN offerings o ON o.id = ?
                                AND o.product_id = p.id
         INNER JOIN businesses b ON b.id = o.business_id
         LEFT JOIN prices variant_price
           ON variant_price.id = (
             SELECT pr.id
               FROM prices pr
              WHERE pr.offering_id = o.id
                AND pr.product_variant_id = pv.id
                AND pr.status = 'active'
                AND pr.effective_from <= ?
                AND (pr.effective_to IS NULL OR pr.effective_to > ?)
              ORDER BY pr.effective_from DESC, pr.updated_at DESC, pr.id DESC
              LIMIT 1
           )
         LEFT JOIN prices offer_price
           ON offer_price.id = (
             SELECT pr.id
               FROM prices pr
              WHERE pr.offering_id = o.id
                AND pr.product_variant_id IS NULL
                AND pr.status = 'active'
                AND pr.effective_from <= ?
                AND (pr.effective_to IS NULL OR pr.effective_to > ?)
              ORDER BY pr.effective_from DESC, pr.updated_at DESC, pr.id DESC
              LIMIT 1
           )
        WHERE pv.product_id = ?
          AND pv.status = 'active'
          AND p.status != 'archived'
          AND b.status = 'active'
          AND b.publication_status = 'published'
          AND o.status = 'active'
          AND o.publication_status = 'published'
        ORDER BY pv.updated_at DESC, pv.id ASC
        LIMIT ?`,
      offeringId,
      now,
      now,
      now,
      now,
      scope.productId,
      safeLimit,
    );
    if (!variants.length) return [];

    // The public request is intentionally unauthenticated, so scope attribute reads
    // through the owning published business rather than any client-supplied tenant.
    const scopedContext: RequestContext = {
      ...context,
      tenantId: brandId<"EntityId">(scope.organizationId),
      workspaceId: brandId<"EntityId">(scope.workspaceId),
    };
    const attributesRepository = new CatalogAttributeValueRepository(this.database);
    const result: PublicOfferingVariantRecord[] = [];

    for (const variant of variants) {
      const values = await attributesRepository.listForTarget(scopedContext, "product_variant", variant.id);
      const attributes: PublicOfferingVariantAttribute[] = [];
      for (const value of values) {
        const definition = await this.database.first<{
          readonly canonicalKey: string;
          readonly name: string;
          readonly dataType: string;
          readonly status: string;
        }>(
          `SELECT canonical_key AS canonicalKey, name, data_type AS dataType, status
             FROM attribute_definitions
            WHERE id = ?
            LIMIT 1`,
          value.attributeDefinitionId,
        );
        if (!definition || definition.status !== "active" || definition.dataType === "multi_enum") continue;

        let publicValue: string | number | boolean | null = null;
        if (value.scalar) {
          publicValue = value.scalar.value;
        } else if (value.optionId) {
          const option = await this.database.first<{ readonly displayLabel: string }>(
            `SELECT display_label AS displayLabel
               FROM attribute_options
              WHERE id = ?
                AND attribute_definition_id = ?
                AND status = 'active'
              LIMIT 1`,
            value.optionId,
            value.attributeDefinitionId,
          );
          if (option) publicValue = option.displayLabel;
        }
        if (publicValue === null) continue;
        attributes.push({
          key: definition.canonicalKey,
          label: definition.name,
          value: publicValue,
        });
      }
      result.push({
        id: variant.id,
        attributes,
        priceAmountMinor: variant.priceAmountMinor ?? null,
        currency: variant.currency ?? null,
        pricingType: variant.pricingType ?? null,
        priceSource: variant.priceSource ?? null,
        availability: variant.availability ?? "unknown",
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

  async setOfferingPrice(context: RequestContext, input: SetOfferingPriceInput): Promise<OfferingPriceRecord> {
    const offering = await this.getOffering(context, input.offeringId);
    if (!offering) throw new DatabaseError("Offering is not available in the current workspace");
    const currency = input.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new DatabaseError("Currency must be a three-letter code");
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 0) throw new DatabaseError("Offering price must be a non-negative integer in minor units");
    if (input.pricingType === "free" && input.amountMinor !== 0) throw new DatabaseError("Free pricing must have a zero amount");
    if (input.pricingType === "fixed" && input.amountMinor === 0) throw new DatabaseError("A zero amount must use the free pricing type");
    const nowMillis = Date.parse(input.now);
    if (!Number.isFinite(nowMillis)) throw new DatabaseError("Price timestamp is invalid");
    const productVariantId = input.productVariantId ?? null;
    if (productVariantId) {
      if (offering.offeringType !== "product" || !offering.productId) throw new DatabaseError("Only product offerings can have variant-specific prices");
      const variant = await this.database.first<{ id: EntityId }>(
        `SELECT pv.id FROM product_variants pv
           INNER JOIN products p ON p.id = pv.product_id
           INNER JOIN offerings o ON o.id = ?
           INNER JOIN businesses b ON b.id = o.business_id
          WHERE pv.id = ? AND o.product_id = p.id AND o.offering_type = 'product'
            AND p.business_id = o.business_id AND b.organization_id = ? AND b.workspace_id = ? LIMIT 1`,
        input.offeringId, productVariantId,
        this.requireOrganization({ organizationId: context.tenantId }),
        this.requireWorkspace({ workspaceId: context.workspaceId }),
      );
      if (!variant) throw new DatabaseError("Product variant is not available for this offering");
    }
    const previous = await this.database.first<{ effectiveFrom: string }>(
      `SELECT effective_from AS effectiveFrom FROM prices
        WHERE offering_id = ? AND product_variant_id IS ? AND status = 'active'
        ORDER BY effective_from DESC, updated_at DESC, id DESC LIMIT 1`,
      input.offeringId, productVariantId,
    );
    const previousMillis = previous ? Date.parse(previous.effectiveFrom) : Number.NaN;
    const effectiveFrom = Number.isFinite(previousMillis) && previousMillis >= nowMillis
      ? new Date(previousMillis + 1).toISOString() : input.now;
    await this.database.run(
      `UPDATE prices SET effective_to = ?, status = 'inactive', updated_at = ?
        WHERE offering_id = ? AND product_variant_id IS ? AND status = 'active'
          AND effective_from < ? AND (effective_to IS NULL OR effective_to > ?)`,
      effectiveFrom, input.now, input.offeringId, productVariantId, effectiveFrom, effectiveFrom,
    );
    await this.database.run(
      `INSERT INTO prices
       (id, offering_id, product_variant_id, amount_minor, currency, pricing_type, effective_from, effective_to, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'active', ?, ?)`,
      input.id, input.offeringId, productVariantId, input.amountMinor, currency, input.pricingType, effectiveFrom, input.now, input.now,
    );
    return { id: input.id, offeringId: input.offeringId, productVariantId, amountMinor: input.amountMinor, currency,
      pricingType: input.pricingType, effectiveFrom, effectiveTo: null, status: "active", createdAt: input.now, updatedAt: input.now };
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