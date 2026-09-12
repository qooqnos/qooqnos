import { D1Database, DatabaseError } from "./index";

export interface MigrationDefinition {
  readonly id: string;
  readonly version: number;
  readonly moduleId: string;
  readonly checksum: string;
  /** SQL statements are kept separate so D1 batch can apply them transactionally. */
  readonly statements: readonly string[];
}

export interface AppliedMigration {
  readonly id: string;
  readonly version: number;
  readonly checksum: string;
  readonly moduleId: string;
  readonly appliedAt: string;
}

export interface MigrationResult {
  readonly version: number;
  readonly id: string;
  readonly status: "applied" | "already_applied";
}

export interface MigrationClock {
  now(): string;
}

const utcClock: MigrationClock = {
  now: () => new Date().toISOString(),
};

export class MigrationIntegrityError extends DatabaseError {
  constructor(message: string) {
    super(message);
    this.name = "MigrationIntegrityError";
  }
}

export class MigrationRunner {
  constructor(
    private readonly database: D1Database,
    private readonly migrations: readonly MigrationDefinition[],
    private readonly clock: MigrationClock = utcClock,
  ) {
    validateMigrationDefinitions(migrations);
  }

  async run(): Promise<MigrationResult[]> {
    const applied = await this.database.all<AppliedMigration>(
      "SELECT id, version, checksum, module_id AS moduleId, applied_at AS appliedAt FROM schema_migrations ORDER BY version ASC",
    );

    validateAppliedMigrations(applied, this.migrations);

    const appliedByVersion = new Map(applied.map((migration) => [migration.version, migration]));
    const results: MigrationResult[] = [];
    let expectedVersion = applied.length === 0 ? 1 : applied[applied.length - 1].version + 1;

    for (const migration of this.migrations) {
      const existing = appliedByVersion.get(migration.version);
      if (existing) {
        results.push({ version: migration.version, id: migration.id, status: "already_applied" });
        continue;
      }

      if (migration.version !== expectedVersion) {
        throw new MigrationIntegrityError(
          `Migration sequence is not contiguous: expected ${expectedVersion}, received ${migration.version}`,
        );
      }

      if (migration.statements.length === 0) {
        throw new MigrationIntegrityError(`Migration ${migration.id} contains no SQL statements`);
      }

      const statements = migration.statements.map((sql) => ({ sql }));
      statements.push({
        sql: "INSERT INTO schema_migrations (id, version, checksum, module_id, applied_at) VALUES (?, ?, ?, ?, ?)",
        // @ts-expect-error params are attached below to keep statement typing explicit.
      });
      const last = statements[statements.length - 1] as { sql: string; params?: unknown[] };
      last.params = [migration.id, migration.version, migration.checksum, migration.moduleId, this.clock.now()];

      await this.database.transaction(statements);
      results.push({ version: migration.version, id: migration.id, status: "applied" });
      expectedVersion += 1;
    }

    return results;
  }
}

export function validateMigrationDefinitions(migrations: readonly MigrationDefinition[]): void {
  const ids = new Set<string>();
  const versions = new Set<number>();
  let previous = 0;

  for (const migration of [...migrations].sort((a, b) => a.version - b.version)) {
    if (!migration.id || !migration.moduleId || !migration.checksum) {
      throw new MigrationIntegrityError("Migration id, moduleId and checksum are required");
    }
    if (!Number.isInteger(migration.version) || migration.version < 1) {
      throw new MigrationIntegrityError(`Invalid migration version: ${migration.version}`);
    }
    if (ids.has(migration.id)) {
      throw new MigrationIntegrityError(`Duplicate migration id: ${migration.id}`);
    }
    if (versions.has(migration.version)) {
      throw new MigrationIntegrityError(`Duplicate migration version: ${migration.version}`);
    }
    if (migration.version !== previous + 1) {
      throw new MigrationIntegrityError(
        `Migration definitions must be contiguous: expected ${previous + 1}, received ${migration.version}`,
      );
    }
    ids.add(migration.id);
    versions.add(migration.version);
    previous = migration.version;
  }
}

function validateAppliedMigrations(
  applied: readonly AppliedMigration[],
  definitions: readonly MigrationDefinition[],
): void {
  const definitionsByVersion = new Map(definitions.map((migration) => [migration.version, migration]));

  let previous = 0;
  for (const migration of applied) {
    if (migration.version !== previous + 1) {
      throw new MigrationIntegrityError(
        `Applied migration history is not contiguous at version ${migration.version}`,
      );
    }

    const definition = definitionsByVersion.get(migration.version);
    if (!definition) {
      throw new MigrationIntegrityError(
        `Database contains migration ${migration.version}, but this runtime has no matching definition`,
      );
    }
    if (definition.id !== migration.id || definition.checksum !== migration.checksum || definition.moduleId !== migration.moduleId) {
      throw new MigrationIntegrityError(`Migration checksum or identity mismatch at version ${migration.version}`);
    }
    previous = migration.version;
  }
}
