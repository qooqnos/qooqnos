import { PrivacyRepository, createPrivacyProcessorRegistry, type PrivacyProcessorRegistry } from "@qooqnos/privacy";
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
  readonly processed: number;
  readonly gated: number;
  readonly skipped: number;
  readonly failed: number;
}

export async function processApprovedPrivacyRequests(
  env: ApiEnv,
  now = new Date().toISOString(),
  limit = 50,
  registry: PrivacyProcessorRegistry = createPrivacyProcessorRegistry(),
): Promise<PrivacyRequestWorkResult> {
  const database = getDatabase(env);
  if (!database) return { claimed: 0, processed: 0, gated: 0, skipped: 0, failed: 0 };

  const repository = new PrivacyRepository(database);
  const items = await repository.listClaimableRequests(limit);
  let claimed = 0;
  let processed = 0;
  let gated = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const result = await repository.claimOrResumeRequest({
        requestId: item.id,
        now,
      });
      if (!result) {
        skipped += 1;
        continue;
      }
      claimed += 1;

      const processors = registry.resolve(item.requestType, item.subjectType);
      if (processors.length === 0) {
        gated += 1;
        continue;
      }

      let allCompleted = true;
      const resultReferences: string[] = [];
      for (const processor of processors) {
        try {
          const processorResult = await processor.process({
            request: result,
            context: {
              requestId: item.id,
              organizationId: item.organizationId,
              workspaceId: item.workspaceId,
              now,
              correlationId: "privacy:" + item.id,
            },
          });

          await repository.recordProcessingSystem({
            requestId: item.id,
            moduleId: processor.moduleId,
            action: processorResult.action,
            resourceReference: processorResult.resourceReferences?.join(",") || undefined,
            status: processorResult.status === "completed" ? "completed" : "skipped",
            processedAt: now,
            now,
            id: processor.id + ":" + item.id,
          } as never);

          if (processorResult.status !== "completed") {
            allCompleted = false;
          }
          if (processorResult.resultReference) {
            resultReferences.push(processorResult.resultReference);
          }
        } catch {
          allCompleted = false;
          failed += 1;
          await repository.recordProcessing({
            requestId: item.id,
            moduleId: processor.moduleId,
            action: "process",
            status: "failed",
            errorReference: processor.id,
            now,
            id: processor.id + ":" + item.id + ":failed",
          } as never);
        }
      }

      if (allCompleted) {
        const completed = await repository.completeClaimedRequest({
          requestId: item.id,
          resultReference: resultReferences.join(",") || undefined,
          now,
        });
        if (completed) processed += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return { claimed, processed, gated, skipped, failed };
}
