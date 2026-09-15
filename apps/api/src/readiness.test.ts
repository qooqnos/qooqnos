import { describe, expect, it } from "vitest";
import { checkDatabase } from "./readiness";

function database(tableName: string | null) {
  return {
    prepare(sql: string) {
      return {
        bind() {
          return this;
        },
        async first<T>() {
          if (sql.includes("SELECT 1")) return { ok: 1 } as T;
          return (tableName ? { name: tableName } : null) as T | null;
        },
        async all<T>() {
          return { results: [] as T[] };
        },
        async run() {
          return { success: true };
        },
      };
    },
    async batch() {
      return [];
    },
  };
}

describe("database readiness", () => {
  it("fails closed when no database binding exists", async () => {
    await expect(checkDatabase(undefined)).resolves.toEqual({
      database: "unavailable",
      migrationRegistry: "unavailable",
    });
  });

  it("requires the schema migration registry", async () => {
    await expect(checkDatabase(database(null))).resolves.toEqual({
      database: "ok",
      migrationRegistry: "unavailable",
    });

    await expect(checkDatabase(database("schema_migrations"))).resolves.toEqual({
      database: "ok",
      migrationRegistry: "ok",
    });
  });
});
