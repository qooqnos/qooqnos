import type { EntityId, RequestContext } from "@qooqnos/core";
import { CapabilityRegistry } from "@qooqnos/runtime";
import { AutomationRepository } from "./repository";

type CompensationPolicy = {
  readonly version?: number;
  readonly mode: "automatic" | "manual" | "none";
  readonly capability?: string;
};

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

    for (let actionIndex = 0; actionIndex < actions.length; actionIndex += 1) {
      const action = actions[actionIndex];
      const existing = await this.options.repository.getStepExecution(
        context,
        executionId,
        action.id,
      );
      if (existing?.status === "completed") continue;
      if (existing?.status === "failed") {
        await this.compensate(context, executionId, actions, actionIndex, action.id);
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
        await this.compensate(context, executionId, actions, actionIndex, action.id, stepId, attemptId);
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
  private async compensate(
    context: RequestContext,
    executionId: EntityId,
    actions: readonly {
      readonly id: EntityId;
      readonly capability: string;
      readonly inputMappingJson: string;
      readonly compensationPolicyJson: string | null;
      readonly sequence: number;
    }[],
    failedIndex: number,
    failedActionId: EntityId,
    failedStepExecutionId?: EntityId,
    failedAttemptId?: EntityId,
  ): Promise<void> {
    for (let index = failedIndex - 1; index >= 0; index -= 1) {
      const action = actions[index];
      const step = await this.options.repository.getStepExecution(context, executionId, action.id);
      if (!step || step.status !== "completed") continue;

      let policy: CompensationPolicy | null = null;
      try {
        policy = parseCompensationPolicy(action.compensationPolicyJson);
      } catch (error) {
        await this.options.repository.recordExecutionError(context, {
          id: this.options.id(),
          executionId,
          stepExecutionId: step.id,
          errorClass: "INVALID_COMPENSATION_POLICY",
          retryable: false,
          safeMessage: error instanceof Error ? error.message.slice(0, 500) : "Automation compensation policy is invalid.",
          now: this.options.now(),
        }).catch(() => undefined);
        continue;
      }

      if (!policy || policy.mode === "none") continue;
      if (!policy.capability) {
        await this.options.repository.recordExecutionError(context, {
          id: this.options.id(),
          executionId,
          stepExecutionId: step.id,
          errorClass: "MISSING_COMPENSATION_CAPABILITY",
          retryable: false,
          safeMessage: "Automatic or manual compensation requires an approved capability.",
          now: this.options.now(),
        }).catch(() => undefined);
        continue;
      }

      const existing = await this.options.repository.getCompensationReference(context, executionId, action.id);
      if (existing?.status === "completed") continue;

      const idempotencyKey = existing?.idempotencyKey ?? `${executionId}:compensation:${action.id}`;
      if (!existing) {
        await this.options.repository.createCompensationReference(context, {
          id: this.options.id(),
          executionId,
          failedActionId: action.id,
          failedStepExecutionId: failedStepExecutionId ?? step.id,
          failedAttemptId,
          compensationCapability: policy.capability,
          inputReference: step.outputReference ?? step.id,
          idempotencyKey,
          now: this.options.now(),
        });
      }

      if (policy.mode === "manual") continue;

      try {
        const originalOutput = parseReference(step.outputReference);
        const originalInput = parseReference(step.outputReference);
        const output = await this.options.capabilities.invoke(
          context,
          policy.capability,
          {
            executionId,
            originalActionId: action.id,
            failedActionId,
            originalOutput,
            originalInput,
            compensationReferenceId: (await this.options.repository.getCompensationReference(context, executionId, action.id))?.id ?? null,
          },
          executionId,
        );
        const completedAt = this.options.now();
        const evidence = JSON.stringify({
          kind: "automation.compensation",
          executionId,
          failedActionId,
          compensatedActionId: action.id,
          capability: policy.capability,
          idempotencyKey,
          output,
          completedAt,
        });
        await this.options.repository.updateCompensationReference(context, {
          executionId,
          failedActionId: action.id,
          status: "completed",
          outputReference: JSON.stringify(output),
          evidenceReference: evidence,
          completedAt,
          now: completedAt,
        });
      } catch (error) {
        const failedAt = this.options.now();
        const safeMessage = error instanceof Error ? error.message.slice(0, 500) : "Automation compensation failed.";
        const evidence = JSON.stringify({
          kind: "automation.compensation",
          executionId,
          failedActionId,
          compensatedActionId: action.id,
          capability: policy.capability,
          idempotencyKey,
          status: "failed",
          error: safeMessage,
          failedAt,
        });
        await this.options.repository.updateCompensationReference(context, {
          executionId,
          failedActionId: action.id,
          status: "failed",
          evidenceReference: evidence,
          errorReference: safeMessage,
          completedAt: failedAt,
          now: failedAt,
        }).catch(() => undefined);
        await this.options.repository.recordExecutionError(context, {
          id: this.options.id(),
          executionId,
          stepExecutionId: step.id,
          errorClass: "AUTOMATION_COMPENSATION_ERROR",
          retryable: true,
          safeMessage,
          now: failedAt,
        }).catch(() => undefined);
      }
    }
  }
}

function parseCompensationPolicy(value: string | null): CompensationPolicy | null {
  if (!value) return null;
  const parsed = JSON.parse(value) as Partial<CompensationPolicy>;
  if (parsed.mode !== "automatic" && parsed.mode !== "manual" && parsed.mode !== "none") {
    throw new Error("Compensation policy mode must be automatic, manual, or none.");
  }
  if (parsed.mode !== "none" && (typeof parsed.capability !== "string" || !parsed.capability.trim())) {
    throw new Error("Compensation policy capability is required for automatic or manual compensation.");
  }
  return {
    ...(typeof parsed.version === "number" ? { version: parsed.version } : {}),
    mode: parsed.mode,
    ...(typeof parsed.capability === "string" ? { capability: parsed.capability.trim() } : {}),
  };
}

function parseReference(value: string | null): unknown {
  if (!value) return null;
  try { return JSON.parse(value) as unknown; } catch { return value; }
}
