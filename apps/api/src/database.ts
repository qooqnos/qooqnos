import { D1Database, type D1DatabaseLike } from "@qooqnos/database";
import type { ApiEnv } from "./env";

export function getDatabase(env: ApiEnv): D1Database | null {
  return env.DB ? new D1Database(env.DB as D1DatabaseLike) : null;
}
