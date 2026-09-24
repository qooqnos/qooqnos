import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";
import type {
  AttributeDataType,
  AttributeDefinitionRecord,
} from "./attribute-repository";

export type AttributeValueSource =
  | "seller_input"
  | "seller_confirmed"
  | "ai_extracted"
  | "ai_generated"
  | "system_derived"
  | "external_verified"
  | "policy_validated";

export type AttributeValueTargetType = "product" | "product_variant" | "service";

export type AttributeScalar =
  | { readonly dataType: "text"; readonly value: string }
  | { readonly dataType: "integer"; readonly value: number }
  | { readonly dataType: "number"; readonly value: number }
  | { readonly dataType: "boolean"; readonly value: boolean }
  | { readonly dataType: "date"; readonly value: string }
  | { readonly dataType: "datetime"; readonly value: string };

export interface AttributeValueRecord {
  readonly id: EntityId;
  readonly attributeDefinitionId: EntityId;
  readonly targetType: AttributeValueTargetType;
  readonly targetId: EntityId;
  readonly sourceType: AttributeValueSource;
  readonly sourceReference: string | null;
  readonly confidence: number | null;
  readonly optionId: EntityId | null;
  readonly scalar: AttributeScalar | null;
  readonly multiEnumOptionIds: readonly EntityId[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SetAttributeValueInput {
  readonly id: EntityId;
  readonly attributeDefinitionId: EntityId;
  readonly targetType: AttributeValueTargetType;
  readonly targetId: EntityId;
  readonly sourceType: AttributeValueSource;
  readonly sourceReference?: string | undefined;
  readonly confidence?: number | undefined;
  readonly scalar?: AttributeScalar | undefined;
  readonly enumOptionId?: EntityId | undefined;
  readonly multiEnumOptionIds?: readonly EntityId[] | undefined;
  readonly now: string;
}

interface AttributeValueRow {
  readonly id: EntityId;
  readonly attributeDefinitionId: EntityId;
  readonly targetType: AttributeValueTargetType;
  readonly targetId: EntityId;
  readonly sourceType: AttributeValueSource;
  readonly sourceReference: string | null;
  readonly confidence: number | null;
  readonly optionId: EntityId | null;
  readonly textValue: string | null;
  readonly integerValue: number | null;
  readonly numberValue: number | null;
  readonly booleanValue: number | null;
  readonly dateValue: string | null;
  readonly datetimeValue: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface AttributeDefinitionRow {
  readonly id: EntityId;
  readonly canonicalKey: string;
  readonly name: string;
  readonly description: string | null;
  readonly dataType: AttributeDataType;
  readonly status: string;
  readonly metadataJson: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class CatalogAttributeValueRepository extends Repository {
  constructor(database: D1Database) {
    super(database);
  }

  async get(
    context: RequestContext,
    attributeDefinitionId: EntityId,
    targetType: AttributeValueTargetType,
    targetId: EntityId,
  ): Promise<AttributeValueRecord | null> {
    await this.assertTargetScope(context, targetType, targetId);
    const row = await this.database.first<AttributeValueRow>(
      "SELECT id, attribute_definition_id AS attributeDefinitionId, target_type AS targetType, target_id AS targetId, source_type AS sourceType, source_reference AS sourceReference, confidence, option_id AS optionId, text_value AS textValue, integer_value AS integerValue, number_value AS numberValue, boolean_value AS booleanValue, date_value AS dateValue, datetime_value AS datetimeValue, created_at AS createdAt, updated_at AS updatedAt FROM attribute_values WHERE attribute_definition_id = ? AND target_type = ? AND target_id = ? LIMIT 1",
      attributeDefinitionId,
      targetType,
      targetId,
    );
    return row ? this.hydrate(row, await this.listMultiEnumOptionIds(row.id)) : null;
  }

  async setByCanonicalKey(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly attributeDefinitionCanonicalKey: string;
      readonly targetType: AttributeValueTargetType;
      readonly targetId: EntityId;
      readonly sourceType: AttributeValueSource;
      readonly value: unknown;
      readonly now: string;
    },
  ): Promise<AttributeValueRecord & { readonly normalizedValue: unknown }> {
    const definition = await this.database.first<AttributeDefinitionRow>(
      "SELECT id, canonical_key AS canonicalKey, name, description, data_type AS dataType, status, metadata_json AS metadataJson, created_at AS createdAt, updated_at AS updatedAt FROM attribute_definitions WHERE canonical_key = ? LIMIT 1",
      input.attributeDefinitionCanonicalKey,
    );
    if (!definition) throw new DatabaseError("Attribute definition not found for canonical key");
    if (definition.status === "archived") throw new DatabaseError("Archived AttributeDefinitions cannot receive new values");

    let setInput: SetAttributeValueInput;
    if (definition.dataType === "enum") {
      if (typeof input.value !== "string") throw new DatabaseError("Enum attribute values must be strings");
      const option = await this.database.first<{ id: EntityId }>(
        "SELECT id FROM attribute_options WHERE attribute_definition_id = ? AND canonical_value = ? AND status = 'active' LIMIT 1",
        definition.id,
        input.value,
      );
      if (!option) throw new DatabaseError("Enum attribute value does not match an active option");
      setInput = {
        id: input.id, attributeDefinitionId: definition.id, targetType: input.targetType,
        targetId: input.targetId, sourceType: input.sourceType, enumOptionId: option.id, now: input.now,
      };
    } else if (definition.dataType === "multi_enum") {
      if (!Array.isArray(input.value) || input.value.some((value) => typeof value !== "string") || input.value.length === 0) {
        throw new DatabaseError("Multi-enum attribute values must be non-empty string arrays");
      }
      const values = input.value as string[];
      const options = await this.database.all<{ id: EntityId; canonicalValue: string }>(
        "SELECT id, canonical_value AS canonicalValue FROM attribute_options WHERE attribute_definition_id = ? AND status = 'active'",
        definition.id,
      );
      const optionByValue = new Map(options.map((option) => [option.canonicalValue, option.id]));
      const optionIds = values.map((value) => optionByValue.get(value));
      if (optionIds.some((value) => !value) || new Set(values).size !== values.length) {
        throw new DatabaseError("Multi-enum attribute values do not match active options");
      }
      setInput = {
        id: input.id, attributeDefinitionId: definition.id, targetType: input.targetType,
        targetId: input.targetId, sourceType: input.sourceType,
        multiEnumOptionIds: optionIds as EntityId[], now: input.now,
      };
    } else {
      const scalarType = definition.dataType;
      const valid = scalarType === "text" || scalarType === "date" || scalarType === "datetime"
        ? typeof input.value === "string"
        : scalarType === "integer" ? Number.isInteger(input.value)
        : scalarType === "number" ? typeof input.value === "number" && Number.isFinite(input.value)
        : scalarType === "boolean" ? typeof input.value === "boolean"
        : false;
      if (!valid) throw new DatabaseError("Catalog Attribute value does not match its definition");
      setInput = {
        id: input.id, attributeDefinitionId: definition.id, targetType: input.targetType,
        targetId: input.targetId, sourceType: input.sourceType,
        scalar: { dataType: scalarType, value: input.value } as AttributeScalar, now: input.now,
      };
    }

    const record = await this.set(context, setInput);
    return { ...record, normalizedValue: input.value };
  }

  async set(
    context: RequestContext,
    input: SetAttributeValueInput,
  ): Promise<AttributeValueRecord> {
    await this.assertTargetScope(context, input.targetType, input.targetId);
    const definition = await this.requireDefinition(input.attributeDefinitionId);
    const optionIds = this.validateInput(definition, input);

    const existing = await this.database.first<{ id: EntityId }>(
      "SELECT id FROM attribute_values WHERE attribute_definition_id = ? AND target_type = ? AND target_id = ? LIMIT 1",
      input.attributeDefinitionId,
      input.targetType,
      input.targetId,
    );

    const columns = this.scalarColumns(definition.dataType, input);
    const valueId = existing?.id ?? input.id;
    const statements: Array<{ sql: string; params: readonly unknown[] }> = [{
      sql: "INSERT INTO attribute_values (id, attribute_definition_id, target_type, target_id, source_type, source_reference, confidence, option_id, text_value, integer_value, number_value, boolean_value, date_value, datetime_value, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(attribute_definition_id, target_type, target_id) DO UPDATE SET source_type = excluded.source_type, source_reference = excluded.source_reference, confidence = excluded.confidence, option_id = excluded.option_id, text_value = excluded.text_value, integer_value = excluded.integer_value, number_value = excluded.number_value, boolean_value = excluded.boolean_value, date_value = excluded.date_value, datetime_value = excluded.datetime_value, updated_at = excluded.updated_at",
      params: [
        valueId,
        input.attributeDefinitionId,
        input.targetType,
        input.targetId,
        input.sourceType,
        input.sourceReference ?? null,
        input.confidence ?? null,
        columns.optionId,
        columns.textValue,
        columns.integerValue,
        columns.numberValue,
        columns.booleanValue,
        columns.dateValue,
        columns.datetimeValue,
        input.now,
        input.now,
      ],
    }];

    if (definition.dataType === "multi_enum") {
      statements.push({
        sql: "DELETE FROM attribute_value_options WHERE attribute_value_id = ?",
        params: [valueId],
      });
      statements.push(
        ...optionIds.map((optionId) => ({
          sql: "INSERT INTO attribute_value_options (id, attribute_value_id, option_id, created_at) VALUES (?, ?, ?, ?)",
          params: [valueId + ":" + optionId, valueId, optionId, input.now],
        })),
      );
    }

    await this.database.transaction(statements);

    const result = await this.get(
      context,
      input.attributeDefinitionId,
      input.targetType,
      input.targetId,
    );
    if (!result) throw new DatabaseError("Attribute value not found after write");
    return result;
  }

  async listForTarget(
    context: RequestContext,
    targetType: AttributeValueTargetType,
    targetId: EntityId,
  ): Promise<readonly AttributeValueRecord[]> {
    await this.assertTargetScope(context, targetType, targetId);
    const rows = await this.database.all<AttributeValueRow>(
      "SELECT id, attribute_definition_id AS attributeDefinitionId, target_type AS targetType, target_id AS targetId, source_type AS sourceType, source_reference AS sourceReference, confidence, option_id AS optionId, text_value AS textValue, integer_value AS integerValue, number_value AS numberValue, boolean_value AS booleanValue, date_value AS dateValue, datetime_value AS datetimeValue, created_at AS createdAt, updated_at AS updatedAt FROM attribute_values WHERE target_type = ? AND target_id = ? ORDER BY attribute_definition_id ASC",
      targetType,
      targetId,
    );
    const optionIds = await this.listMultiEnumOptionIdsForValues(rows.map((row) => row.id));
    return rows.map((row) => this.hydrate(row, optionIds.get(row.id) ?? []));
  }

  private async requireDefinition(id: EntityId): Promise<AttributeDefinitionRecord> {
    const row = await this.database.first<AttributeDefinitionRow>(
      "SELECT id, canonical_key AS canonicalKey, name, description, data_type AS dataType, status, metadata_json AS metadataJson, created_at AS createdAt, updated_at AS updatedAt FROM attribute_definitions WHERE id = ? LIMIT 1",
      id,
    );
    if (!row) throw new DatabaseError("Attribute definition not found");
    if (row.status === "archived") throw new DatabaseError("Archived AttributeDefinitions cannot receive new values");
    return {
      id: row.id,
      canonicalKey: row.canonicalKey,
      name: row.name,
      description: row.description,
      dataType: row.dataType,
      status: row.status as AttributeDefinitionRecord["status"],
      metadata: this.parseMetadata(row.metadataJson),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private validateInput(
    definition: AttributeDefinitionRecord,
    input: SetAttributeValueInput,
  ): readonly EntityId[] {
    if (input.confidence !== undefined && (input.confidence < 0 || input.confidence > 1)) {
      throw new DatabaseError("Attribute value confidence must be between 0 and 1");
    }

    if (definition.dataType === "enum") {
      if (!input.enumOptionId || input.scalar || input.multiEnumOptionIds?.length) {
        throw new DatabaseError("Enum attributes require exactly one option");
      }
      return [];
    }

    if (definition.dataType === "multi_enum") {
      if (!input.multiEnumOptionIds?.length || input.scalar || input.enumOptionId) {
        throw new DatabaseError("Multi-enum attributes require one or more options");
      }
      const unique = new Set(input.multiEnumOptionIds);
      if (unique.size !== input.multiEnumOptionIds.length) {
        throw new DatabaseError("Multi-enum options cannot be duplicated");
      }
      return [...input.multiEnumOptionIds];
    }

    if (!input.scalar || input.enumOptionId || input.multiEnumOptionIds?.length) {
      throw new DatabaseError("Typed attributes require exactly one scalar value");
    }
    if (input.scalar.dataType !== definition.dataType) {
      throw new DatabaseError("Attribute value type does not match its definition");
    }
    return [];
  }

  private scalarColumns(
    dataType: AttributeDataType,
    input: SetAttributeValueInput,
  ): {
    readonly optionId: EntityId | null;
    readonly textValue: string | null;
    readonly integerValue: number | null;
    readonly numberValue: number | null;
    readonly booleanValue: number | null;
    readonly dateValue: string | null;
    readonly datetimeValue: string | null;
  } {
    if (dataType === "enum") {
      return { optionId: input.enumOptionId ?? null, textValue: null, integerValue: null, numberValue: null, booleanValue: null, dateValue: null, datetimeValue: null };
    }
    if (dataType === "multi_enum") {
      return { optionId: null, textValue: null, integerValue: null, numberValue: null, booleanValue: null, dateValue: null, datetimeValue: null };
    }
    const scalar = input.scalar;
    if (!scalar) throw new DatabaseError("Scalar attribute value is required");
    return {
      optionId: null,
      textValue: scalar.dataType === "text" ? scalar.value : null,
      integerValue: scalar.dataType === "integer" ? scalar.value : null,
      numberValue: scalar.dataType === "number" ? scalar.value : null,
      booleanValue: scalar.dataType === "boolean" ? (scalar.value ? 1 : 0) : null,
      dateValue: scalar.dataType === "date" ? scalar.value : null,
      datetimeValue: scalar.dataType === "datetime" ? scalar.value : null,
    };
  }

  private async assertTargetScope(
    context: RequestContext,
    targetType: AttributeValueTargetType,
    targetId: EntityId,
  ): Promise<void> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const sql = targetType === "product"
      ? "SELECT p.id FROM products p INNER JOIN businesses b ON b.id = p.business_id WHERE p.id = ? AND b.organization_id = ? AND b.workspace_id = ? LIMIT 1"
      : targetType === "product_variant"
        ? "SELECT pv.id FROM product_variants pv INNER JOIN products p ON p.id = pv.product_id INNER JOIN businesses b ON b.id = p.business_id WHERE pv.id = ? AND b.organization_id = ? AND b.workspace_id = ? LIMIT 1"
        : "SELECT s.id FROM services s WHERE s.id = ? AND (s.business_id IS NULL OR EXISTS (SELECT 1 FROM businesses b WHERE b.id = s.business_id AND b.organization_id = ? AND b.workspace_id = ?)) LIMIT 1";
    const row = await this.database.first<{ id: string }>(sql, targetId, organizationId, workspaceId);
    if (!row) throw new DatabaseError("Catalog Attribute target is not available in the current workspace");
  }

  private async listMultiEnumOptionIds(attributeValueId: EntityId): Promise<readonly EntityId[]> {
    const rows = await this.database.all<{ optionId: EntityId }>(
      "SELECT option_id AS optionId FROM attribute_value_options WHERE attribute_value_id = ? ORDER BY option_id ASC",
      attributeValueId,
    );
    return rows.map((row) => row.optionId);
  }

  private async listMultiEnumOptionIdsForValues(attributeValueIds: readonly EntityId[]): Promise<Map<EntityId, readonly EntityId[]>> {
    if (attributeValueIds.length === 0) return new Map();
    const placeholders = attributeValueIds.map(() => "?").join(", ");
    const rows = await this.database.all<{ attributeValueId: EntityId; optionId: EntityId }>(
      "SELECT attribute_value_id AS attributeValueId, option_id AS optionId FROM attribute_value_options WHERE attribute_value_id IN (" + placeholders + ") ORDER BY attribute_value_id ASC, option_id ASC",
      ...attributeValueIds,
    );
    const grouped = new Map<EntityId, EntityId[]>();
    for (const row of rows) {
      const values = grouped.get(row.attributeValueId) ?? [];
      values.push(row.optionId);
      grouped.set(row.attributeValueId, values);
    }
    return grouped;
  }

  private hydrate(row: AttributeValueRow, multiEnumOptionIds: readonly EntityId[]): AttributeValueRecord {
    let scalar: AttributeScalar | null = null;
    if (row.textValue !== null) scalar = { dataType: "text", value: row.textValue };
    else if (row.integerValue !== null) scalar = { dataType: "integer", value: row.integerValue };
    else if (row.numberValue !== null) scalar = { dataType: "number", value: row.numberValue };
    else if (row.booleanValue !== null) scalar = { dataType: "boolean", value: row.booleanValue === 1 };
    else if (row.dateValue !== null) scalar = { dataType: "date", value: row.dateValue };
    else if (row.datetimeValue !== null) scalar = { dataType: "datetime", value: row.datetimeValue };

    return {
      id: row.id,
      attributeDefinitionId: row.attributeDefinitionId,
      targetType: row.targetType,
      targetId: row.targetId,
      sourceType: row.sourceType,
      sourceReference: row.sourceReference,
      confidence: row.confidence,
      optionId: row.optionId,
      scalar,
      multiEnumOptionIds,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private parseMetadata(value: string | null): Readonly<Record<string, unknown>> | null {
    if (!value) return null;
    try {
      return JSON.parse(value) as Readonly<Record<string, unknown>>;
    } catch {
      throw new DatabaseError("Stored AttributeDefinition metadata is invalid");
    }
  }
}
