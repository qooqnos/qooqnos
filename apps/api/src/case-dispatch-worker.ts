import { processCaseDispatches, createCaseDispatchProviderRegistry, createHttpCaseDispatchProviderAdapter } from "@qooqnos/case-support";
import type { D1Database } from "@qooqnos/database";
import type { ApiEnv } from "./env";
import { getDatabase } from "./database";

export function createCaseDispatchRegistry(env: ApiEnv) {
  const providerId = env.CASE_DISPATCH_PROVIDER_ID?.trim();
  const endpoint = env.CASE_DISPATCH_PROVIDER_ENDPOINT?.trim();
  const path = env.CASE_DISPATCH_PROVIDER_PATH?.trim() || "/cases";
  const token = env.CASE_DISPATCH_PROVIDER_TOKEN?.trim();
  if (!providerId || !endpoint || !token) return createCaseDispatchProviderRegistry();

  return createCaseDispatchProviderRegistry([
    createHttpCaseDispatchProviderAdapter({
      providerId,
      baseUrl: endpoint,
      dispatchPath: path,
      credentialReference: "env://CASE_DISPATCH_PROVIDER_TOKEN",
      credentialResolver: { async resolve() { return { secret: token }; } },
    }),
  ]);
}

export async function processCaseDispatch(env: ApiEnv, now = new Date().toISOString()): Promise<void> {
  const database = getDatabase(env) as D1Database | undefined;
  if (!database) return;
  await processCaseDispatches(database, createCaseDispatchRegistry(env), now);
}
