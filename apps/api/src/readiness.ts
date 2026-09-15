import type { D1DatabaseLike } from "@qooqnos/database";

export interface ReadinessResult {
  readonly database: "ok" | "unavailable";
  readonly migrationRegistry: "ok" | "unavailable";
}

export async function checkDatabase(database: D1DatabaseLike | undefined): Promise<ReadinessResult> {
  if (!database) return { database: "unavailable", migrationRegistry: "unavailable" };

  try {
    const databaseCheck = await database.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    if (databaseCheck?.ok !== 1) return { database: "unavailable", migrationRegistry: "unavailable" };

    const migrationCheck = await database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
      .first<{ name: string }>();

    return {
      database: "ok",
      migrationRegistry: migrationCheck?.name === "schema_migrations" ? "ok" : "unavailable",
    };
  } catch {
    return { database: "unavailable", migrationRegistry: "unavailable" };
  }
}
