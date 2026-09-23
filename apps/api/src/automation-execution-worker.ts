import { brandId } from "@qooqnos/core";
import { AutomationExecutor, AutomationRepository } from "@qooqnos/automation";
import { createRequestContext } from "./context";
import { getDatabase } from "./database";
import { createApiAuthorizationRegistry } from "./runtime";
import { createApiCapabilityRegistry } from "./capabilities";
import type { ApiEnv } from "./env";

export interface AutomationExecutionProcessResult {
  readonly executionsSeen: number;
  readonly executionsClaimed: number;
  readonly completed: number;
  readonly failed: number;
}

export async function processAutomationExecutions(
  env: ApiEnv,
  now = new Date().toISOString(),
  limit = 50,
): Promise<AutomationExecutionProcessResult> {
  const database = getDatabase(env);
  if (!database) return { executionsSeen: 0, executionsClaimed: 0, completed: 0, failed: 0 };

  const repository = new AutomationRepository(database);
  const executions = await repository.listPendingExecutions(now, limit);
  if (executions.length === 0) {
    return { executionsSeen: 0, executionsClaimed: 0, completed: 0, failed: 0 };
  }

  const capabilities = createApiCapabilityRegistry({
    database,
    authorization: createApiAuthorizationRegistry(),
  });

  const executor = new AutomationExecutor({
    repository,
    capabilities,
    id: () => brandId<"EntityId">(crypto.randomUUID()),
    now: () => new Date().toISOString(),
  });

  let claimedCount = 0;
  let completed = 0;
  let failed = 0;

  for (const execution of executions) {
    if (!(await repository.claimPendingExecution(execution.id, now))) continue;
    claimedCount += 1;

    const baseContext = createRequestContext({
      module: "automation",
      operation: "automation.execution.run",
      requestId: execution.id,
      correlationId: execution.correlationId,
      ...(execution.organizationId ? { tenantId: execution.organizationId } : {}),
      ...(execution.workspaceId ? { workspaceId: execution.workspaceId } : {}),
      actorId: "system",
      locale: "en",
      timezone: "UTC",
      authenticated: true,
    });

    let actorId = baseContext.actorId;
    try {
      const workflow = await repository.getWorkflow(baseContext, execution.workflowId);
      actorId = workflow.createdBy;
    } catch {
      await repository.setExecutionStatus(
        baseContext,
        execution.id,
        "failed",
        new Date().toISOString(),
      );
      failed += 1;
      continue;
    }

    const context = createRequestContext({
      ...baseContext,
      ...(actorId ? { actorId } : {}),
    });

    try {
      const result = await executor.execute(context, execution.id);
      if (result === "completed") completed += 1;
      if (result === "failed") failed += 1;
    } catch {
      await repository.setExecutionStatus(
        context,
        execution.id,
        "failed",
        new Date().toISOString(),
      ).catch(() => undefined);
      failed += 1;
    }
  }

  return {
    executionsSeen: executions.length,
    executionsClaimed: claimedCount,
    completed,
    failed,
  };
}
