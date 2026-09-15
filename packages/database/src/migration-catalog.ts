import { MigrationDefinition } from "./migrations";
import { sha256Hex } from "./hash";

export interface MigrationSource {
  readonly path: string;
  readonly sql: string;
}

export interface MigrationCatalogOptions {
  /** Maps a migration id to its owning module. Defaults to the filename module segment. */
  readonly moduleIdFor?: (migrationId: string) => string;
}

/**
 * Builds runtime migration definitions from the canonical SQL migration sources.
 *
 * The SQL itself is supplied by the build system; this package deliberately does
 * not duplicate migration contents in TypeScript. The resulting checksum is
 * calculated from the exact SQL string that will be executed.
 */
export async function loadMigrationCatalog(
  sources: readonly MigrationSource[],
  options: MigrationCatalogOptions = {},
): Promise<MigrationDefinition[]> {
  const definitions = await Promise.all(
    sources.map(async (source) => {
      const { id, version, moduleId: filenameModuleId } = parseMigrationPath(source.path);
      const moduleId = options.moduleIdFor?.(id) ?? filenameModuleId;

      return {
        id,
        version,
        moduleId,
        sql: source.sql,
        checksum: await sha256Hex(source.sql),
        statements: splitSqlStatements(source.sql),
      } satisfies MigrationDefinition;
    }),
  );

  definitions.sort((a, b) => a.version - b.version);
  return definitions;
}

export interface ParsedMigrationPath {
  readonly id: string;
  readonly version: number;
  readonly moduleId: string;
}

/** Filename convention: NNNN_module[_description].sql */
export function parseMigrationPath(path: string): ParsedMigrationPath {
  const filename = path.split("/").pop() ?? path;
  const match = /^(\d+)_([a-z0-9-]+)(?:_[a-z0-9-]+)*\.sql$/i.exec(filename);

  if (!match) {
    throw new Error(`Invalid migration filename: ${path}`);
  }

  const versionSegment = match[1];
  const moduleId = match[2];
  if (versionSegment === undefined || moduleId === undefined) {
    throw new Error(`Invalid migration filename: ${path}`);
  }

  const version = Number(versionSegment);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error(`Invalid migration version in filename: ${path}`);
  }

  const id = filename.slice(0, -4);
  return { id, version, moduleId };
}

/**
 * Splits SQLite SQL for D1 batch execution while respecting quoted strings and
 * identifiers. Comments are retained as part of the statement they precede.
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let start = 0;
  let quote: "'" | '"' | "`" | "[" | null = null;

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];

    if (quote) {
      if (quote === "[" && character === "]") {
        quote = null;
        continue;
      }
      if (character === quote) {
        if (sql[index + 1] === quote && quote !== "[") {
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if (character === "[") {
      quote = "[";
      continue;
    }
    if (character === ";") {
      const statement = sql.slice(start, index).trim();
      if (statement) statements.push(statement);
      start = index + 1;
    }
  }

  const tail = sql.slice(start).trim();
  if (tail) statements.push(tail);
  return statements;
}
