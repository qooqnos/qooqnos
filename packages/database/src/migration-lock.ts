import { DatabaseError } from "./client";
import type { MigrationDefinition } from "./migrations";

/**
 * Implements docs/MIGRATION_LOCK_STRATEGY.md.
 *
 * Runtime checksum validation (see migrations.ts) proves an applied migration
 * matches the definition currently loaded by the runtime. It cannot prove the
 * first deployed definition was the originally reviewed SQL, because SQL and
 * its declared checksum can be changed together. The lock manifest is a
 * separately committed, reviewed artifact that closes that gap: it is
 * generated once when a migration is authored and never silently regenerated.
 */

export interface MigrationLockEntry {
  readonly id: string;
  readonly version: number;
  readonly moduleId: string;
  readonly checksum: string;
  /** Immutable migration filename, derived from `id` (`${id}.sql`) at generation time. */
  readonly filename: string;
}

export interface MigrationLockManifest {
  readonly generatedAt: string;
  readonly migrations: readonly MigrationLockEntry[];
}

export class MigrationLockError extends DatabaseError {
  constructor(message: string) {
    super(message);
    this.name = "MigrationLockError";
  }
}

/**
 * Builds a lock manifest from the current migration definitions. Intended to
 * be run deliberately by a maintainer when a migration is added, then
 * committed and reviewed alongside it -- never regenerated automatically as
 * part of a normal build (rule 8: lock changes require a corresponding
 * migration change).
 */
export function generateMigrationLock(
  definitions: readonly MigrationDefinition[],
  now: () => string = () => new Date().toISOString(),
): MigrationLockManifest {
  const migrations = [...definitions]
    .sort((a, b) => a.version - b.version)
    .map(
      (definition): MigrationLockEntry => ({
        id: definition.id,
        version: definition.version,
        moduleId: definition.moduleId,
        checksum: definition.checksum,
        filename: `${definition.id}.sql`,
      }),
    );
  return { generatedAt: now(), migrations };
}

/**
 * Verifies migration definitions against a committed lock manifest.
 *
 * Covers verification rules 1-4 from docs/MIGRATION_LOCK_STRATEGY.md:
 *   1. filenames/versions are contiguous;
 *   2. every source migration appears exactly once in the lock manifest;
 *   3. every lock entry maps to exactly one migration definition;
 *   4. the runtime/source checksum equals the lock checksum.
 * Rule 5 (applied D1 checksum) remains MigrationRunner's responsibility --
 * this function only validates the definitions the runner is about to use,
 * not what is already recorded in `schema_migrations`. Rule 8 (a lock change
 * without a corresponding migration change) is a git/CI-history concern and
 * is out of scope for a pure in-process check.
 *
 * Throws MigrationLockError and does not return a result object, matching
 * rule 6: a checksum mismatch is release-blocking, not a warning to inspect.
 */
export function verifyMigrationLock(
  definitions: readonly MigrationDefinition[],
  manifest: MigrationLockManifest,
): void {
  const sorted = [...definitions].sort((a, b) => a.version - b.version);

  const definitionIds = new Set(sorted.map((definition) => definition.id));
  if (definitionIds.size !== sorted.length) {
    throw new MigrationLockError("Migration definitions contain a duplicate migration id");
  }

  let previousVersion = 0;
  for (const definition of sorted) {
    if (definition.version !== previousVersion + 1) {
      throw new MigrationLockError(
        `Migration definitions are not contiguous: expected version ${previousVersion + 1}, found ${definition.version} (${definition.id})`,
      );
    }
    previousVersion = definition.version;
  }

  const lockById = new Map(manifest.migrations.map((entry) => [entry.id, entry]));
  if (lockById.size !== manifest.migrations.length) {
    throw new MigrationLockError("Migration lock manifest contains a duplicate migration id");
  }

  for (const definition of sorted) {
    const lockEntry = lockById.get(definition.id);
    if (!lockEntry) {
      throw new MigrationLockError(
        `Migration ${definition.id} has no entry in the migration lock manifest. Run the lock generator and commit the result alongside this migration.`,
      );
    }
    if (lockEntry.version !== definition.version || lockEntry.moduleId !== definition.moduleId) {
      throw new MigrationLockError(`Migration ${definition.id} identity mismatch between source and lock manifest`);
    }
    if (lockEntry.checksum !== definition.checksum) {
      throw new MigrationLockError(
        `Migration ${definition.id} checksum does not match the committed lock manifest. ` +
          "The migration SQL changed without a reviewed lock-manifest update, or the lock manifest was tampered with.",
      );
    }
  }

  for (const lockEntry of manifest.migrations) {
    if (!definitionIds.has(lockEntry.id)) {
      throw new MigrationLockError(
        `Migration lock manifest references ${lockEntry.id}, which has no matching migration definition`,
      );
    }
  }
}
