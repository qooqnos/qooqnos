import type { EntityId, RequestContext } from "@qooqnos/core";
import { CapabilityRegistry } from "@qooqnos/runtime";
import { AutomationRepository } from "./repository";

export interface AutomationExecutorOptions {
  readonly repository: AutomationRepository;
  readonly capabilities: CapabilityRegistry;
  readonly id: () => EntityId;
  readonly now: () => string;
}

export class AutomationExecutor {
  constructor(private readonly options: AutomationExecutorOptions) {}

  async execute(
    context: RequestContext,
    executionId: EntityId,
  ): Promise<"completed" | "failed" | "waiting"> {
    const execution = await this.options.repository.getExecution(context, executionId);
    if (["completed", "failed", "cancelled"].includes(execution.status)) {
      return execution.status as "completed" | "failed";
    }

    const actions = await this.options.repository.listActions(
      context,
      execution.workflowVersionId,
    );

    for (const action of actions) {
      const existing = await this.options.repository.getStepExecution(
        context,
        executionId,
        action.id,
      );
      if (existing?.status === "completed") continue;
      if (existing?.status === "failed") {
        await this.options.repository.setExecutionStatus(
          context,
          executionId,
          "failed",
          this.options.now(),
        );
        return "failed";
      }

      let input: unknown = {};
      try {
        input = JSON.parse(action.inputMappingJson) as unknown;
      } catch {
        await this.options.repository.recordExecutionError(context, {
          id: this.options.id(),
          executionId,
          stepExecutionId: existing?.id,
          errorClass: "INVALID_INPUT_MAPPING",
          retryable: false,
          safeMessage: "Automation action input mapping is not valid JSON.",
          now: this.options.now(),
        });
        await this.options.repository.setExecutionStatus(
          context,
          executionId,
          "failed",
          this.options.now(),
        );
        return "failed";
      }

      const stepId = existing?.id ?? this.options.id();
      if (!existing) {
        await this.options.repository.createStepExecution(context, {
          id: stepId,
          executionId,
          stepId: action.id,
          sequence: action.sequence,
          now: this.options.now(),
        });
      }

      const startedAt = this.options.now();
      await this.options.repository.updateStepExecution(context, {
        id: stepId,
        status: "running",
        inputReference: execution.inputReference ?? undefined,
        startedAt,
        now: startedAt,
      });

      const idempotencyKey = `${executionId}:${action.id}:1`;
      let attemptId: EntityId | undefined;
      try {
        attemptId = this.options.id();
        await this.options.repository.createExecutionAttempt(context, {
          id: attemptId,
          stepExecutionId: stepId,
          attemptNumber: 1,
          idempotencyKey,
          now: startedAt,
        });

        const output = await this.options.capabilities.invoke(
          context,
          action.capability,
          input,
          executionId,
        );

        const outputReference = JSON.stringify(output);
        const completedAt = this.options.now();
        await this.options.repository.completeExecutionAttempt(context, {
          idempotencyKey,
          status: "succeeded",
          completedAt,
        });
        await this.options.repository.updateStepExecution(context, {
          id: stepId,
          status: "completed",
          outputReference,
          completedAt,
          now: completedAt,
        });
      } catch (error) {
        const failedAt = this.options.now();
        await this.options.repository.completeExecutionAttempt(context, {
          idempotencyKey,
          status: "failed",
          completedAt: failedAt,
        }).catch(() => undefined);

        await this.options.repository.updateStepExecution(context, {
          id: stepId,
          status: "failed",
          completedAt: failedAt,
          now: failedAt,
        });

        await this.options.repository.recordExecutionError(context, {
          id: this.options.id(),
          executionId,
          stepExecutionId: stepId,
          attemptId,
          errorClass: error instanceof Error ? error.name : "AUTOMATION_ACTION_ERROR",
          retryable: false,
          safeMessage: error instanceof Error ? error.message.slice(0, 500) : "Automation action failed.",
          now: failedAt,
        });
        await this.options.repository.setExecutionStatus(
          context,
          executionId,
          "failed",
          failedAt,
        );
        return "failed";
      }
    }

    await this.options.repository.setExecutionStatus(
      context,
      executionId,
      "completed",
      this.options.now(),
    );
    return "completed";
  }
}
