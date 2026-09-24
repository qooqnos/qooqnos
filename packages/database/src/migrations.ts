import type { D1Database } from "./client";

export interface MigrationDefinition {
  readonly id: string;
  readonly version: number;
  readonly moduleId: string;
  readonly sql: string;
  readonly checksum: string;
  readonly statements: readonly string[];
}

export type MigrationResultStatus = "applied" | "already_applied";

export interface MigrationResult {
  readonly version: number;
  readonly id: string;
  readonly status: MigrationResultStatus;
}

export class MigrationError extends Error {
  constructor(message: string, readonly id?: string) {
    super(message);
    this.name = "MigrationError";
  }
}

interface AppliedMigrationRow {
  readonly id: string;
  readonly version: number;
  readonly checksum: string;
  readonly module_id: string;
  readonly applied_at: string;
}

export class MigrationRunner {
  private readonly definitions: readonly MigrationDefinition[];

  constructor(
    private readonly database: D1Database,
    definitions: readonly MigrationDefinition[],
  ) {
    this.definitions = validateDefinitions(definitions);
  }

  async run(): Promise<MigrationResult[]> {
    const registryExists = await this.hasMigrationRegistry();
    const applied = registryExists ? await this.readAppliedMigrations() : new Map<string, AppliedMigrationRow>();

    this.validateAppliedHistory(applied);

    const results: MigrationResult[] = [];
    for (const definition of this.definitions) {
      const existing = applied.get(definition.id);

      if (existing) {
        validateAppliedMigration(definition, existing);
        results.push({
          version: definition.version,
          id: definition.id,
          status: "already_applied",
        });
        continue;
      }

      await this.apply(definition);
      results.push({
        version: definition.version,
        id: definition.id,
        status: "applied",
      });
      applied.set(definition.id, {
        id: definition.id,
        version: definition.version,
        checksum: definition.checksum,
        module_id: definition.moduleId,
        applied_at: new Date().toISOString(),
      });
    }

    return results;
  }

  private async hasMigrationRegistry(): Promise<boolean> {
    const row = await this.database.first<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
    );
    return row?.name === "schema_migrations";
  }

  private async readAppliedMigrations(): Promise<Map<string, AppliedMigrationRow>> {
    const rows = await this.database.all<AppliedMigrationRow>(
      "SELECT id, version, checksum, module_id, applied_at FROM schema_migrations ORDER BY version",
    );

    const applied = new Map<string, AppliedMigrationRow>();
    for (const row of rows) {
      if (applied.has(row.id)) {
        throw new MigrationError(`Duplicate applied migration id: ${row.id}`, row.id);
      }
      applied.set(row.id, row);
    }
    return applied;
  }

  private validateAppliedHistory(applied: ReadonlyMap<string, AppliedMigrationRow>): void {
    const byVersion = new Map<number, AppliedMigrationRow>();

    for (const row of applied.values()) {
      const definition = this.definitions.find((candidate) => candidate.id === row.id);
      if (!definition) {
        throw new MigrationError(
          `Applied migration ${row.id} is not present in the current migration catalog`,
          row.id,
        );
      }

      const sameVersion = byVersion.get(row.version);
      if (sameVersion && sameVersion.id !== row.id) {
        throw new MigrationError(
          `Migration version ${row.version} is recorded for both ${sameVersion.id} and ${row.id}`,
          row.id,
        );
      }
      byVersion.set(row.version, row);

      validateAppliedMigration(definition, row);
    }

    const versions = [...byVersion.keys()].sort((a, b) => a - b);
    for (let index = 0; index < versions.length; index += 1) {
      const version = versions[index];
      if (version === undefined) continue;
      const previous = index === 0 ? 0 : (versions[index - 1] ?? 0);
      if (version <= previous) {
        throw new MigrationError(
          `Applied migration history is not strictly increasing: previous version ${previous}, found ${version}`,
        );
      }
    }
  }

  private async apply(definition: MigrationDefinition): Promise<void> {
    if (definition.statements.length === 0) {
      throw new MigrationError(`Migration ${definition.id} contains no executable SQL statements`, definition.id);
    }

    const statements = definition.statements.map((sql) => ({
      sql,
      params: [] as readonly unknown[],
    }));

    statements.push({
      sql: "INSERT INTO schema_migrations (id, version, checksum, module_id, applied_at) VALUES (?, ?, ?, ?, ?)",
      params: [
        definition.id,
        definition.version,
        definition.checksum,
        definition.moduleId,
        new Date().toISOString(),
      ],
    });

    try {
      await this.database.transaction(statements);
    } catch (error) {
      throw new MigrationError(
        `Failed to apply migration ${definition.id}: ${error instanceof Error ? error.message : String(error)}`,
        definition.id,
      );
    }
  }
}

function validateDefinitions(definitions: readonly MigrationDefinition[]): readonly MigrationDefinition[] {
  const sorted = [...definitions].sort((a, b) => a.version - b.version);
  const ids = new Set<string>();
  const versions = new Set<number>();

  let previousVersion = 0;
  for (const definition of sorted) {
    if (ids.has(definition.id)) {
      throw new MigrationError(`Duplicate migration id: ${definition.id}`, definition.id);
    }
    if (versions.has(definition.version)) {
      throw new MigrationError(
        `Duplicate migration version: ${definition.version}`,
        definition.id,
      );
    }
    if (definition.version <= previousVersion) {
      throw new MigrationError(
        `Migration versions must be strictly increasing: previous ${previousVersion}, found ${definition.version}`,
        definition.id,
      );
    }
    if (!definition.id || !definition.moduleId || !definition.sql || !definition.checksum) {
      throw new MigrationError(`Migration definition is incomplete: ${definition.id || "<unknown>"}`, definition.id);
    }

    ids.add(definition.id);
    versions.add(definition.version);
    previousVersion = definition.version;
  }

  return sorted;
}

function validateAppliedMigration(
  definition: MigrationDefinition,
  applied: AppliedMigrationRow,
): void {
  if (applied.version !== definition.version) {
    throw new MigrationError(
      `Migration ${definition.id} version mismatch: database=${applied.version}, catalog=${definition.version}`,
      definition.id,
    );
  }

  if (applied.module_id !== definition.moduleId) {
    throw new MigrationError(
      `Migration ${definition.id} module mismatch: database=${applied.module_id}, catalog=${definition.moduleId}`,
      definition.id,
    );
  }

  if (applied.checksum !== definition.checksum) {
    throw new MigrationError(
      `Migration ${definition.id} checksum mismatch between applied history and current catalog`,
      definition.id,
    );
  }
}
