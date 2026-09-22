import type { EntityId } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type AttributeDataType =
  | "text"
  | "integer"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "enum"
  | "multi_enum";

export type AttributeStatus = "active" | "inactive" | "archived";

export interface AttributeDefinitionRecord {
  readonly id: EntityId;
  readonly canonicalKey: string;
  readonly name: string;
  readonly description: string | null;
  readonly dataType: AttributeDataType;
  readonly status: AttributeStatus;
  readonly metadata: Readonly<Record<string, unknown>> | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AttributeOptionRecord {
  readonly id: EntityId;
  readonly attributeDefinitionId: EntityId;
  readonly canonicalValue: string;
  readonly displayLabel: string;
  readonly sortOrder: number;
  readonly status: AttributeStatus;
  readonly metadata: Readonly<Record<string, unknown>> | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CategoryAttributeRecord {
  readonly id: EntityId;
  readonly categoryId: EntityId;
  readonly attributeDefinitionId: EntityId;
  readonly isRequired: boolean;
  readonly isFilterable: boolean;
  readonly isSearchable: boolean;
  readonly isVariantDimension: boolean;
  readonly sortOrder: number;
  readonly constraints: Readonly<Record<string, unknown>> | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateAttributeDefinitionInput {
  readonly id: EntityId;
  readonly canonicalKey: string;
  readonly name: string;
  readonly description?: string | undefined;
  readonly dataType: AttributeDataType;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
  readonly now: string;
}

export interface CreateAttributeOptionInput {
  readonly id: EntityId;
  readonly attributeDefinitionId: EntityId;
  readonly canonicalValue: string;
  readonly displayLabel: string;
  readonly sortOrder?: number | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
  readonly now: string;
}

export interface AttachCategoryAttributeInput {
  readonly id: EntityId;
  readonly categoryId: EntityId;
  readonly attributeDefinitionId: EntityId;
  readonly isRequired?: boolean | undefined;
  readonly isFilterable?: boolean | undefined;
  readonly isSearchable?: boolean | undefined;
  readonly isVariantDimension?: boolean | undefined;
  readonly sortOrder?: number | undefined;
  readonly constraints?: Readonly<Record<string, unknown>> | undefined;
  readonly now: string;
}

interface AttributeDefinitionRow {
  readonly id: EntityId;
  readonly canonicalKey: string;
  readonly name: string;
  readonly description: string | null;
  readonly dataType: AttributeDataType;
  readonly status: AttributeStatus;
  readonly metadataJson: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface AttributeOptionRow {
  readonly id: EntityId;
  readonly attributeDefinitionId: EntityId;
  readonly canonicalValue: string;
  readonly displayLabel: string;
  readonly sortOrder: number;
  readonly status: AttributeStatus;
  readonly metadataJson: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface CategoryAttributeRow {
  readonly id: EntityId;
  readonly categoryId: EntityId;
  readonly attributeDefinitionId: EntityId;
  readonly isRequired: number;
  readonly isFilterable: number;
  readonly isSearchable: number;
  readonly isVariantDimension: number;
  readonly sortOrder: number;
  readonly constraintsJson: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class CatalogAttributeRepository extends Repository {
  constructor(database: D1Database) {
    super(database);
  }

  async getDefinition(id: EntityId): Promise<AttributeDefinitionRecord | null> {
    const row = await this.database.first<AttributeDefinitionRow>(
      "SELECT id, canonical_key AS canonicalKey, name, description, data_type AS dataType, status, metadata_json AS metadataJson, created_at AS createdAt, updated_at AS updatedAt FROM attribute_definitions WHERE id = ? LIMIT 1",
      id,
    );
    return row ? this.toDefinition(row) : null;
  }

  async listDefinitions(status: AttributeStatus = "active"): Promise<readonly AttributeDefinitionRecord[]> {
    const rows = await this.database.all<AttributeDefinitionRow>(
      "SELECT id, canonical_key AS canonicalKey, name, description, data_type AS dataType, status, metadata_json AS metadataJson, created_at AS createdAt, updated_at AS updatedAt FROM attribute_definitions WHERE status = ? ORDER BY canonical_key ASC",
      status,
    );
    return rows.results.map((row) => this.toDefinition(row));
  }

  async createDefinition(input: CreateAttributeDefinitionInput): Promise<AttributeDefinitionRecord> {
    const canonicalKey = input.canonicalKey.trim();
    const name = input.name.trim();
    if (!canonicalKey) throw new DatabaseError("Attribute canonical key is required");
    if (!name) throw new DatabaseError("Attribute name is required");

    await this.database.run(
      "INSERT INTO attribute_definitions (id, canonical_key, name, description, data_type, status, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)",
      input.id,
      canonicalKey,
      name,
      input.description?.trim() || null,
      input.dataType,
      input.metadata ? JSON.stringify(input.metadata) : null,
      input.now,
      input.now,
    );

    const record = await this.getDefinition(input.id);
    if (!record) throw new DatabaseError("Attribute definition not found after creation");
    return record;
  }

  async listOptions(attributeDefinitionId: EntityId, status: AttributeStatus = "active"): Promise<readonly AttributeOptionRecord[]> {
    const rows = await this.database.all<AttributeOptionRow>(
      "SELECT id, attribute_definition_id AS attributeDefinitionId, canonical_value AS canonicalValue, display_label AS displayLabel, sort_order AS sortOrder, status, metadata_json AS metadataJson, created_at AS createdAt, updated_at AS updatedAt FROM attribute_options WHERE attribute_definition_id = ? AND status = ? ORDER BY sort_order ASC, canonical_value ASC",
      attributeDefinitionId,
      status,
    );
    return rows.results.map((row) => this.toOption(row));
  }

  async createOption(input: CreateAttributeOptionInput): Promise<AttributeOptionRecord> {
    const definition = await this.getDefinition(input.attributeDefinitionId);
    if (!definition) throw new DatabaseError("Attribute definition not found");
    if (definition.dataType !== "enum" && definition.dataType !== "multi_enum") {
      throw new DatabaseError("Attribute options require enum or multi_enum data type");
    }

    const canonicalValue = input.canonicalValue.trim();
    const displayLabel = input.displayLabel.trim();
    if (!canonicalValue) throw new DatabaseError("Attribute option canonical value is required");
    if (!displayLabel) throw new DatabaseError("Attribute option display label is required");

    await this.database.run(
      "INSERT INTO attribute_options (id, attribute_definition_id, canonical_value, display_label, sort_order, status, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)",
      input.id,
      input.attributeDefinitionId,
      canonicalValue,
      displayLabel,
      input.sortOrder ?? 0,
      input.metadata ? JSON.stringify(input.metadata) : null,
      input.now,
      input.now,
    );

    const row = await this.database.first<AttributeOptionRow>(
      "SELECT id, attribute_definition_id AS attributeDefinitionId, canonical_value AS canonicalValue, display_label AS displayLabel, sort_order AS sortOrder, status, metadata_json AS metadataJson, created_at AS createdAt, updated_at AS updatedAt FROM attribute_options WHERE id = ? LIMIT 1",
      input.id,
    );
    if (!row) throw new DatabaseError("Attribute option not found after creation");
    return this.toOption(row);
  }

  async attachToCategory(input: AttachCategoryAttributeInput): Promise<CategoryAttributeRecord> {
    const category = await this.database.first<{ id: EntityId }>(
      "SELECT id FROM categories WHERE id = ? LIMIT 1",
      input.categoryId,
    );
    if (!category) throw new DatabaseError("Category not found");

    const definition = await this.getDefinition(input.attributeDefinitionId);
    if (!definition) throw new DatabaseError("Attribute definition not found");

    await this.database.run(
      "INSERT INTO category_attributes (id, category_id, attribute_definition_id, is_required, is_filterable, is_searchable, is_variant_dimension, sort_order, constraints_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id,
      input.categoryId,
      input.attributeDefinitionId,
      input.isRequired ? 1 : 0,
      input.isFilterable ? 1 : 0,
      input.isSearchable ? 1 : 0,
      input.isVariantDimension ? 1 : 0,
      input.sortOrder ?? 0,
      input.constraints ? JSON.stringify(input.constraints) : null,
      input.now,
      input.now,
    );

    return this.requireCategoryAttribute(input.id);
  }

  async listCategoryAttributes(categoryId: EntityId): Promise<readonly CategoryAttributeRecord[]> {
    const rows = await this.database.all<CategoryAttributeRow>(
      "SELECT id, category_id AS categoryId, attribute_definition_id AS attributeDefinitionId, is_required AS isRequired, is_filterable AS isFilterable, is_searchable AS isSearchable, is_variant_dimension AS isVariantDimension, sort_order AS sortOrder, constraints_json AS constraintsJson, created_at AS createdAt, updated_at AS updatedAt FROM category_attributes WHERE category_id = ? ORDER BY sort_order ASC, id ASC",
      categoryId,
    );
    return rows.results.map((row) => this.toCategoryAttribute(row));
  }

  private async requireCategoryAttribute(id: EntityId): Promise<CategoryAttributeRecord> {
    const row = await this.database.first<CategoryAttributeRow>(
      "SELECT id, category_id AS categoryId, attribute_definition_id AS attributeDefinitionId, is_required AS isRequired, is_filterable AS isFilterable, is_searchable AS isSearchable, is_variant_dimension AS isVariantDimension, sort_order AS sortOrder, constraints_json AS constraintsJson, created_at AS createdAt, updated_at AS updatedAt FROM category_attributes WHERE id = ? LIMIT 1",
      id,
    );
    if (!row) throw new DatabaseError("Category attribute not found after creation");
    return this.toCategoryAttribute(row);
  }

  private toDefinition(row: AttributeDefinitionRow): AttributeDefinitionRecord {
    return {
      id: row.id,
      canonicalKey: row.canonicalKey,
      name: row.name,
      description: row.description,
      dataType: row.dataType,
      status: row.status,
      metadata: this.parseJson(row.metadataJson),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toOption(row: AttributeOptionRow): AttributeOptionRecord {
    return {
      id: row.id,
      attributeDefinitionId: row.attributeDefinitionId,
      canonicalValue: row.canonicalValue,
      displayLabel: row.displayLabel,
      sortOrder: row.sortOrder,
      status: row.status,
      metadata: this.parseJson(row.metadataJson),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toCategoryAttribute(row: CategoryAttributeRow): CategoryAttributeRecord {
    return {
      id: row.id,
      categoryId: row.categoryId,
      attributeDefinitionId: row.attributeDefinitionId,
      isRequired: row.isRequired === 1,
      isFilterable: row.isFilterable === 1,
      isSearchable: row.isSearchable === 1,
      isVariantDimension: row.isVariantDimension === 1,
      sortOrder: row.sortOrder,
      constraints: this.parseJson(row.constraintsJson),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private parseJson(value: string | null): Readonly<Record<string, unknown>> | null {
    if (!value) return null;
    try {
      return JSON.parse(value) as Readonly<Record<string, unknown>>;
    } catch {
      throw new DatabaseError("Stored Catalog Attribute JSON is invalid");
    }
  }
}
