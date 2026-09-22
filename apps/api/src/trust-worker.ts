import { brandId } from "@qooqnos/core";
import { VerificationRepository } from "@qooqnos/database";
import { getDatabase } from "./database";
import { createRequestContext } from "./context";
import type { ApiEnv } from "./env";

export interface TrustExpiryWorkResult {
  readonly evaluated: number;
  readonly skipped: number;
  readonly failed: number;
}

export async function processPendingTrustExpiries(
  env: ApiEnv,
  now = new Date().toISOString(),
  limit = 50,
): Promise<TrustExpiryWorkResult> {
  const database = getDatabase(env);
  if (!database) return { evaluated: 0, skipped: 0, failed: 0 };

  const repository = new VerificationRepository(database);
  const items = await repository.listPendingExpiryWorkItems(limit);

  let evaluated = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const context = createRequestContext({
        module: "trust",
        operation: "verification.expiry.process",
        actorId: brandId<"EntityId">("system"),
        tenantId: item.organizationId,
        ...(item.workspaceId ? { workspaceId: item.workspaceId } : {}),
        authenticated: true,
        locale: "en",
        timezone: "UTC",
      });

      const applied = await repository.resolveExpiryAsExpired({
        expiryId: item.id,
        decisionId: brandId<"EntityId">(item.id + ":expired"),
        detectedAt: now,
        rationaleReference: "trust.expiry.worker.v1",
        now,
        correlationId: context.correlationId,
        actorReference: "system",
      });

      if (applied) evaluated += 1;
      else skipped += 1;
    } catch {
      failed += 1;
    }
  }

  return { evaluated, skipped, failed };
}
