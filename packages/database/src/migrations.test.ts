import { describe, expect, it } from "vitest";
import { D1Database } from "./client";
import { sha256Hex } from "./hash";
import { MigrationRunner, type MigrationDefinition } from "./migrations";

function fakeDatabase(options: { hasRegistry: boolean; applied?: readonly Record<string, unknown>[] }) {
  let registryExists = options.hasRegistry;
  const batches: Array<readonly { sql: string; params?: readonly unknown[] }[]> = [];

  const db = new D1Database({
    prepare(sql: string) {
      return {
        bind() {
          return this;
        },
        async first<T>() {
          if (sql.includes("sqlite_master")) {
            return (registryExists ? { name: "schema_migrations" } : null) as T | null;
          }
          return null;
        },
        async all<T>() {
          return { results: (options.applied ?? []) as T[] };
        },
        async run() {
          registryExists = true;
          return { success: true };
        },
      };
    },
    async batch(statements) {
      batches.push(
        statements.map((statement) => ({
          sql: statement.sql,
          params: [],
        })),
      );
      registryExists = true;
      return statements.map(() => ({ success: true }));
    },
  });

  return { db, batches };
}

async function migration(id: string, version: number, moduleId: string, sql: string): Promise<MigrationDefinition> {
  return {
    id,
    version,
    moduleId,
    sql,
    checksum: await sha256Hex(sql),
    statements: [sql],
  };
}

describe("MigrationRunner", () => {
  it("lets the first migration create schema_migrations", async () => {
    const first = await migration("0001_test", 1, "test", "CREATE TABLE example (id TEXT PRIMARY KEY)");
    const second = await migration("0002_test", 2, "test", "CREATE INDEX idx_example_id ON example(id)");
    const { db, batches } = fakeDatabase({ hasRegistry: false });

    const results = await new MigrationRunner(db, [first, second]).run();

    expect(results).toEqual([
      { version: 1, id: "0001_test", status: "applied" },
      { version: 2, id: "0002_test", status: "applied" },
    ]);
    expect(batches[0]?.[0]?.sql).toBe("CREATE TABLE example (id TEXT PRIMARY KEY)");
    expect(batches[0]?.[batches[0].length - 1]?.sql).toContain("INSERT INTO schema_migrations");
  });

  it("does not reapply recorded migrations", async () => {
    const first = await migration("0001_test", 1, "test", "SELECT 1");
    const appliedAt = "2026-09-15T00:00:00.000Z";
    const { db, batches } = fakeDatabase({
      hasRegistry: true,
      applied: [
        {
          id: first.id,
          version: first.version,
          checksum: first.checksum,
          moduleId: first.moduleId,
          appliedAt,
        },
      ],
    });

    await expect(new MigrationRunner(db, [first]).run()).resolves.toEqual([
      { version: 1, id: first.id, status: "already_applied" },
    ]);
    expect(batches).toHaveLength(0);
  });
});
