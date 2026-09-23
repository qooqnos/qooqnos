import { brandId } from "@qooqnos/core";
import { AutomationRepository, planAutomationSchedule } from "@qooqnos/automation";
import { getDatabase } from "./database";
import { createRequestContext } from "./context";
import type { ApiEnv } from "./env";

export interface AutomationScheduleProcessResult {
  readonly schedulesSeen: number;
  readonly schedulesClaimed: number;
  readonly executionsCreated: number;
  readonly skippedOccurrences: number;
}

export async function processAutomationSchedules(
  env: ApiEnv,
  now = new Date().toISOString(),
  limit = 100,
): Promise<AutomationScheduleProcessResult> {
  const database = getDatabase(env);
  if (!database) return { schedulesSeen: 0, schedulesClaimed: 0, executionsCreated: 0, skippedOccurrences: 0 };

  const repository = new AutomationRepository(database);
  const due = await repository.listDueScheduleTriggers(now, limit);

  const groups = new Map<string, typeof due[number][]>();
  for (const trigger of due) {
    const group = groups.get(trigger.scheduleId) ?? [];
    group.push(trigger);
    groups.set(trigger.scheduleId, group);
  }

  let schedulesClaimed = 0;
  let executionsCreated = 0;
  let skippedOccurrences = 0;

  for (const [scheduleId, triggers] of groups) {
    const first = triggers[0];
    if (!first) continue;

    const plan = planAutomationSchedule(
      first.recurrence,
      first.nextRunAt,
      now,
      first.misfirePolicy,
      first.endAt,
    );

    const currentOccurrence = first.nextRunAt;
    if (plan.dueOccurrences.length === 0) {
      if (plan.nextRunAt === currentOccurrence) continue;
      const claimed = await repository.claimScheduleOccurrence(
        brandId<"EntityId">(scheduleId),
        currentOccurrence,
        plan.nextRunAt,
        now,
      );
      if (claimed) {
        schedulesClaimed += 1;
        skippedOccurrences += 1;
      }
      continue;
    }

    if (first.misfirePolicy !== "catch_up_all") {
      const claimed = await repository.claimScheduleOccurrence(
        brandId<"EntityId">(scheduleId),
        currentOccurrence,
        plan.nextRunAt,
        now,
      );
      if (!claimed) continue;

      schedulesClaimed += 1;

      for (const occurrence of plan.dueOccurrences) {
        for (const trigger of triggers) {
          const context = createRequestContext({
            module: "automation",
            operation: "automation.schedule.poll",
            requestId: `automation:${scheduleId}:${trigger.triggerId}:${occurrence}`,
            correlationId: `automation:${scheduleId}:${trigger.triggerId}:${occurrence}`,
            ...(trigger.organizationId ? { tenantId: trigger.organizationId } : {}),
            ...(trigger.workspaceId ? { workspaceId: trigger.workspaceId } : {}),
            locale: "en",
            timezone: "UTC",
            authenticated: true,
          });

          const execution = await repository.startExecution(context, {
            id: brandId<"EntityId">(crypto.randomUUID()),
            workflowId: trigger.workflowId,
            workflowVersionId: trigger.workflowVersionId,
            triggerId: trigger.triggerId,
            correlationId: `schedule:${scheduleId}:${trigger.triggerId}:${occurrence}`,
            traceId: `schedule:${scheduleId}:${occurrence}`,
            inputReference: `schedule:${scheduleId}:${occurrence}`,
            initialStatus: "pending",
            now,
          });
          if (execution.status === "pending") executionsCreated += 1;
        }
      }
      continue;
    }

    let expected = currentOccurrence;
    for (const occurrence of plan.dueOccurrences) {
      const nextIndex = plan.dueOccurrences.indexOf(occurrence) + 1;
      const nextRunAt = nextIndex < plan.dueOccurrences.length
        ? plan.dueOccurrences[nextIndex]
        : plan.nextRunAt;
      const claimed = await repository.claimScheduleOccurrence(
        brandId<"EntityId">(scheduleId),
        expected,
        nextRunAt,
        now,
      );
      if (!claimed) break;

      schedulesClaimed += 1;
      for (const trigger of triggers) {
        const context = createRequestContext({
          module: "automation",
          operation: "automation.schedule.poll",
          requestId: `automation:${scheduleId}:${trigger.triggerId}:${occurrence}`,
          correlationId: `automation:${scheduleId}:${trigger.triggerId}:${occurrence}`,
          ...(trigger.organizationId ? { tenantId: trigger.organizationId } : {}),
          ...(trigger.workspaceId ? { workspaceId: trigger.workspaceId } : {}),
          locale: "en",
          timezone: "UTC",
          authenticated: true,
        });
        const execution = await repository.startExecution(context, {
          id: brandId<"EntityId">(crypto.randomUUID()),
          workflowId: trigger.workflowId,
          workflowVersionId: trigger.workflowVersionId,
          triggerId: trigger.triggerId,
          correlationId: `schedule:${scheduleId}:${trigger.triggerId}:${occurrence}`,
          traceId: `schedule:${scheduleId}:${occurrence}`,
          inputReference: `schedule:${scheduleId}:${occurrence}`,
          initialStatus: "pending",
          now,
        });
        if (execution.status === "pending") executionsCreated += 1;
      }
      expected = nextRunAt ?? occurrence;
    }
  }

  return { schedulesSeen: groups.size, schedulesClaimed, executionsCreated, skippedOccurrences };
}
