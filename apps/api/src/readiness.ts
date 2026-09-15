import type { D1DatabaseLike } from "./env";

export interface ReadinessResult {
  readonly database: "ok" | "unavailable";
}

export async function checkDatabase(database: D1DatabaseLike | undefined): Promise<ReadinessResult> {
  if (!database) return { database: "unavailable" };

  try {
    const result = await database.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    return result?.ok === 1 ? { database: "ok" } : { database: "unavailable" };
  } catch {
    return { database: "unavailable" };
  }
}
