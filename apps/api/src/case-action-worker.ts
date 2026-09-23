import { brandId } from "@qooqnos/core";
import { CaseSupportRepository } from "@qooqnos/case-support";
import { createApiCapabilityRegistry } from "./capabilities";
import { createRequestContext } from "./context";
import { getDatabase } from "./database";
import { createApiAuthorizationRegistry } from "./runtime";
import type { ApiEnv } from "./env";

export interface CaseActionProcessResult {
  readonly actionsSeen: number;
  readonly actionsClaimed: number;
  readonly completed: number;
  readonly failed: number;
}

export async function processCaseActions(
  env: ApiEnv,
  now = new Date().toISOString(),
  limit = 50,
): Promise<CaseActionProcessResult> {
  const database = getDatabase(env);
  if (!database) return { actionsSeen: 0, actionsClaimed: 0, completed: 0, failed: 0 };

  const repository = new CaseSupportRepository(database);
  const discoveryContext = createRequestContext({
    module: "case-support",
    operation: "case.action.poll",
    requestId: brandId<"RequestId">("case-action-poll:" + now),
    correlationId: brandId<"CorrelationId">("case-action-poll:" + now),
    actorId: "system",
    authenticated: true,
    locale: "en",
    timezone: "UTC",
  });

  const actions = await repository.listApprovedActions(discoveryContext, limit);
  if (actions.length === 0) {
    return { actionsSeen: 0, actionsClaimed: 0, completed: 0, failed: 0 };
  }

  const capabilities = createApiCapabilityRegistry({
    database,
    authorization: createApiAuthorizationRegistry(),
  });

  let claimed = 0;
  let completed = 0;
  let failed = 0;

  for (const action of actions) {
    const claimedAction = await repository.claimApprovedAction(
      discoveryContext,
      action.caseId,
      action.id,
      now,
    );
    if (!claimedAction) continue;
    claimed += 1;

    const context = createRequestContext({
      module: "case-support",
      operation: "case.action.execute",
      requestId: brandId<"RequestId">("case-action:" + action.id),
      correlationId: brandId<"CorrelationId">("case-action:" + action.id),
      actorId: action.requestedBy,
      tenantId: action.organizationId,
      ...(action.workspaceId ? { workspaceId: action.workspaceId } : {}),
      locale: "en",
      timezone: "UTC",
      authenticated: true,
    });

    try {
      const result = await capabilities.invoke(
        context,
        action.capability,
        {
          targetReference: action.targetReference,
          authorizationReference: action.authorizationReference,
          caseId: action.caseId,
        },
      );
      await repository.completeAction(context, {
        caseId: action.caseId,
        actionId: action.id,
        status: "succeeded",
        resultReference: JSON.stringify(result),
        now: new Date().toISOString(),
      });
      completed += 1;
    } catch (error) {
      await repository.completeAction(context, {
        caseId: action.caseId,
        actionId: action.id,
        status: "failed",
        resultReference: error instanceof Error ? error.message.slice(0, 500) : "Capability execution failed",
        now: new Date().toISOString(),
      }).catch(() => undefined);
      failed += 1;
    }
  }

  return {
    actionsSeen: actions.length,
    actionsClaimed: claimed,
    completed,
    failed,
  };
}
