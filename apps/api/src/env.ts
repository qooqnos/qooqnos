import type { D1DatabaseLike } from "@qooqnos/database";

export interface ApiEnv {
  readonly APP_VERSION?: string;
  readonly DB?: D1DatabaseLike;
}

export function requireDatabase(env: ApiEnv): D1DatabaseLike {
  if (!env.DB) throw new Error("D1 database binding is not configured");
  return env.DB;
}
