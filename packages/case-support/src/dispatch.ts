import { brandId, type EntityId } from "@qooqnos/core";
import { D1Database } from "@qooqnos/database";
import { CaseDispatchProviderRegistry, classifyCaseDispatchError } from "./dispatch-adapter";
import { CaseDispatchRepository } from "./dispatch-repository";

export interface CaseDispatchProcessResult {
  readonly processed: number;
  readonly accepted: number;
  readonly failed: number;
  readonly retried: number;
}

export async function processCaseDispatches(
  database: D1Database,
  registry: CaseDispatchProviderRegistry,
  now = new Date().toISOString(),
  limit = 50,
): Promise<CaseDispatchProcessResult> {
  const repository = new CaseDispatchRepository(database);
  const due = await repository.getDue(limit, now);
  let accepted = 0;
  let failed = 0;
  let retried = 0;

  for (const item of due) {
    const claimed = await repository.claim(item.dispatch.id, now);
    if (!claimed) continue;

    const adapter = registry.resolve(item.dispatch.providerId);
    if (!adapter) {
      await repository.recordFailure({
        id: item.dispatch.id,
        failureCode: "provider_adapter_unconfigured",
        failureClass: "permanent",
        nextAvailableAt: now,
        now,
        attemptId: brandId<"EntityId">(item.dispatch.id + ":attempt:" + item.dispatch.attempts),
      });
      failed += 1;
      continue;
    }

    try {
      const result = await adapter.dispatch({
        dispatchId: item.dispatch.id,
        caseId: item.dispatch.caseId,
        assignmentId: item.dispatch.assignmentId,
        queueId: item.dispatch.queueId,
        routeReference: item.dispatch.routeReference,
        idempotencyKey: item.dispatch.idempotencyKey,
        organizationId: item.organizationId,
        workspaceId: item.workspaceId,
        caseTypeId: item.caseTypeId,
        priority: item.priority,
        subjectType: item.subjectType,
        subjectId: item.subjectId,
        requesterType: item.requesterType,
        requesterId: item.requesterId,
        correlationId: item.dispatch.id,
      });
      await repository.recordAccepted({
        id: item.dispatch.id,
        ...(result.externalReference ? { externalReference: result.externalReference } : {}),
        now,
        attemptId: brandId<EntityId>(item.dispatch.id + ":attempt:" + item.dispatch.attempts),
      });
      accepted += 1;
    } catch (error) {
      const failureClass = classifyCaseDispatchError(error);
      const failureCode = error instanceof Error && "failureCode" in error
        ? String((error as { failureCode?: unknown }).failureCode ?? "provider_dispatch_failed")
        : "provider_dispatch_failed";
      const nextAvailableAt = failureClass === "transient"
        ? retryAt(item.dispatch.attempts, now)
        : now;
      await repository.recordFailure({
        id: item.dispatch.id,
        failureCode,
        failureClass,
        nextAvailableAt,
        now,
        attemptId: brandId<EntityId>(item.dispatch.id + ":attempt:" + item.dispatch.attempts),
      });
      failed += 1;
      if (failureClass === "transient") retried += 1;
    }
  }

  return { processed: due.length, accepted, failed, retried };
}

function retryAt(attempt: number, now: string): string {
  const bounded = Math.min(Math.max(attempt, 1), 10);
  return new Date(Date.parse(now) + Math.min(15 * 60_000, 1_000 * 2 ** bounded)).toISOString();
}
