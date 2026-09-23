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
export interface PrivacyRequestWorkResult {
  readonly claimed: number;
  readonly skipped: number;
  readonly failed: number;
}

export async function processApprovedPrivacyRequests(
  env: ApiEnv,
  now = new Date().toISOString(),
  limit = 50,
): Promise<PrivacyRequestWorkResult> {
  const database = getDatabase(env);
  if (!database) return { claimed: 0, skipped: 0, failed: 0 };

  const repository = new PrivacyRepository(database);
  const items = await repository.listClaimableRequests(limit);
  let claimed = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const result = await repository.claimOrResumeRequest({
        requestId: item.id,
        now,
      });
      if (result) claimed += 1;
      else skipped += 1;
    } catch {
      failed += 1;
    }
  }

  return { claimed, skipped, failed };
}
