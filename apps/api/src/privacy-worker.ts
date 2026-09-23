import { PrivacyRepository } from "@qooqnos/privacy";
import { getDatabase } from "./database";
import type { ApiEnv } from "./env";

export interface PrivacyExpiryProcessResult {
  readonly expired: number;
}

export async function processPrivacyConsentExpiry(
  env: ApiEnv,
  now = new Date().toISOString(),
  limit = 500,
): Promise<PrivacyExpiryProcessResult> {
  const database = getDatabase(env);
  if (!database) return { expired: 0 };
  const repository = new PrivacyRepository(database);
  return { expired: await repository.expireConsents(now, limit) };
}
