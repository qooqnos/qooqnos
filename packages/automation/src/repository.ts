import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";
import { nextAutomationOccurrence, parseAutomationRecurrenceMs } from "./scheduler";

export type AutomationExecutionStatus = "pending"|"running"|"waiting"|"completed"|"failed"|"cancelled";

export interface WorkflowRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId | null;
  readonly workspaceId: EntityId | null;
  readonly businessId: EntityId | null;
  readonly name: string;
  readonly scope: "platform"|"organization"|"workspace"|"business";
  readonly status: "draft"|"validating"|"active"|"paused"|"retired";
  readonly activeVersionId: EntityId | null;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AutomationScheduleRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId | null;
  readonly workspaceId: EntityId | null;
  readonly timezone: string;
  readonly recurrence: string;
  readonly startAt: string;
  readonly endAt: string | null;
  readonly misfirePolicy: "skip" | "catch_up_once" | "catch_up_all";
  readonly enabled: boolean;
  readonly nextRunAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AutomationScheduleTriggerRecord {
  readonly scheduleId: EntityId;
  readonly triggerId: EntityId;
  readonly workflowId: EntityId;
  readonly workflowVersionId: EntityId;
  readonly organizationId: EntityId | null;
  readonly workspaceId: EntityId | null;
  readonly businessId: EntityId | null;
  readonly workflowScope: "platform" | "organization" | "workspace" | "business";
}

export interface WorkflowExecutionRecord {
  readonly id: EntityId;
  readonly workflowId: EntityId;
  readonly workflowVersionId: EntityId;
  readonly triggerId: EntityId;
  readonly organizationId: EntityId | null;
  readonly workspaceId: EntityId | null;
  readonly businessId: EntityId | null;
  readonly status: AutomationExecutionStatus;
  readonly inputReference: string | null;
  readonly correlationId: string;
  readonly traceId: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class AutomationRepository extends Repository {
  constructor(database: D1Database) { super(database); }

  async createSchedule(context: RequestContext, input: {
    readonly id: EntityId;
    readonly timezone: string;
    readonly recurrence: string;
    readonly startAt: string;
    readonly endAt?: string | undefined;
    readonly misfirePolicy: AutomationScheduleRecord["misfirePolicy"];
    readonly now: string;
  }): Promise<AutomationScheduleRecord> {
    parseAutomationRecurrenceMs(input.recurrence);
    if (Number.isNaN(Date.parse(input.startAt))) throw new DatabaseError("Automation schedule startAt is invalid");
    if (input.endAt !== undefined && Number.isNaN(Date.parse(input.endAt))) {
      throw new DatabaseError("Automation schedule endAt is invalid");
    }
    if (input.endAt !== undefined && input.endAt <= input.startAt) {
      throw new DatabaseError("Automation schedule endAt must be after startAt");
    }
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = context.workspaceId ?? null;
    const nextRunAt = input.startAt > input.now ? input.startAt : nextAutomationOccurrence(input.recurrence, input.startAt);
    await this.database.run(
      "INSERT INTO automation_schedules (id, organization_id, workspace_id, timezone, recurrence, start_at, end_at, misfire_policy, enabled, next_run_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)",
      input.id,
      organizationId ?? null,
      workspaceId,
      input.timezone.trim(),
      input.recurrence.trim(),
      input.startAt,
      input.endAt ?? null,
      input.misfirePolicy,
      nextRunAt,
      input.now,
      input.now,
    );
    const schedule = await this.getSchedule(context, input.id);
    if (!schedule) throw new DatabaseError("Automation schedule not found after creation");
    return schedule;
  }

  async getSchedule(context: RequestContext, id: EntityId): Promise<AutomationScheduleRecord | null> {
    return this.database.first<AutomationScheduleRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, timezone, recurrence, start_at AS startAt, end_at AS endAt, misfire_policy AS misfirePolicy, enabled, next_run_at AS nextRunAt, created_at AS createdAt, updated_at AS updatedAt FROM automation_schedules WHERE id = ? AND (organization_id IS NULL OR organization_id = ?) AND (workspace_id IS NULL OR workspace_id = ?) LIMIT 1",
      id,
      context.tenantId ?? null,
      context.workspaceId ?? null,
    );
  }

  async createScheduleTrigger(context: RequestContext, input: {
    readonly id: EntityId;
    readonly workflowId: EntityId;
    readonly workflowVersionId: EntityId;
    readonly scheduleId: EntityId;
    readonly enabled?: boolean;
    readonly now: string;
  }): Promise<void> {
    const workflow = await this.getWorkflow(context, input.workflowId);
    const version = await this.database.first<{ id: EntityId; workflowId: EntityId; status: string }>(
      "SELECT id, workflow_id AS workflowId, status FROM automation_workflow_versions WHERE id = ? AND workflow_id = ? LIMIT 1",
      input.workflowVersionId,
      input.workflowId,
    );
    if (!version) throw new DatabaseError("Automation workflow version not found");
    const schedule = await this.getSchedule(context, input.scheduleId);
    if (!schedule) throw new DatabaseError("Automation schedule not found");
    if (workflow.workspaceId !== schedule.workspaceId) {
      throw new DatabaseError("Automation schedule workspace does not match workflow workspace");
    }
    if (workflow.organizationId !== schedule.organizationId) {
      throw new DatabaseError("Automation schedule organization does not match workflow organization");
    }
    await this.database.run(
      "INSERT INTO automation_triggers (id, workflow_version_id, type, schedule_id, enabled, created_at) VALUES (?, ?, 'schedule', ?, ?, ?)",
      input.id,
      input.workflowVersionId,
      input.scheduleId,
      input.enabled === false ? 0 : 1,
      input.now,
    );
  }

  async listDueScheduleTriggers(now: string, limit = 100): Promise<readonly (AutomationScheduleTriggerRecord & { readonly nextRunAt: string; readonly recurrence: string; readonly misfirePolicy: AutomationScheduleRecord["misfirePolicy"]; readonly endAt: string | null; })[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
    return this.database.all(
      "SELECT s.id AS scheduleId, t.id AS triggerId, w.id AS workflowId, v.id AS workflowVersionId, s.organization_id AS organizationId, s.workspace_id AS workspaceId, w.business_id AS businessId, w.scope AS workflowScope, s.next_run_at AS nextRunAt, s.recurrence, s.misfire_policy AS misfirePolicy, s.end_at AS endAt FROM automation_schedules s INNER JOIN automation_triggers t ON t.schedule_id = s.id AND t.type = 'schedule' AND t.enabled = 1 INNER JOIN automation_workflow_versions v ON v.id = t.workflow_version_id AND v.status = 'active' INNER JOIN automation_workflows w ON w.id = v.workflow_id AND w.status = 'active' WHERE s.enabled = 1 AND s.next_run_at IS NOT NULL AND s.next_run_at <= ? AND s.start_at <= ? AND (s.end_at IS NULL OR s.end_at > ?) ORDER BY s.next_run_at ASC, s.id ASC, t.id ASC LIMIT ?",
      now,
      now,
      now,
      safeLimit,
    );
  }

  async claimScheduleOccurrence(
    scheduleId: EntityId,
    expectedNextRunAt: string,
    nextRunAt: string | null,
    now: string,
  ): Promise<boolean> {
    const result = await this.database.run(
      "UPDATE automation_schedules SET next_run_at = ?, enabled = CASE WHEN ? IS NULL THEN 0 ELSE enabled END, updated_at = ? WHERE id = ? AND enabled = 1 AND next_run_at = ?",
      nextRunAt,
      nextRunAt,
      now,
      scheduleId,
      expectedNextRunAt,
    );
    return (result.meta?.changes ?? 0) === 1;
  }

  async createWorkflow(context: RequestContext, input: {
    readonly id: EntityId; readonly name: string; readonly scope: WorkflowRecord["scope"];
    readonly businessId?: EntityId; readonly now: string;
  }): Promise<WorkflowRecord> {
    const organizationId = input.scope === "platform" ? null : this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = input.scope === "workspace" || input.scope === "business" ? this.requireWorkspace({ workspaceId: context.workspaceId }) : null;
    await this.database.run(
      "INSERT INTO automation_workflows (id, organization_id, workspace_id, business_id, name, scope, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)",
      input.id, organizationId, workspaceId, input.businessId ?? null, input.name.trim(), input.scope, context.actorId ?? "system", input.now, input.now,
    );
    return this.getWorkflow(context, input.id);
  }

  async getWorkflow(context: RequestContext, id: EntityId): Promise<WorkflowRecord> {
    const row = await this.database.first<WorkflowRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, business_id AS businessId, name, scope, status, active_version_id AS activeVersionId, created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt FROM automation_workflows WHERE id = ? AND (organization_id IS NULL OR organization_id = ?) AND (workspace_id IS NULL OR workspace_id = ?) LIMIT 1",
      id, context.tenantId, context.workspaceId ?? null,
    );
    if (!row) throw new DatabaseError("Automation workflow not found");
    return row;
  }

  async createVersion(context: RequestContext, input: {
    readonly id: EntityId; readonly workflowId: EntityId; readonly version: number;
    readonly definition: Readonly<Record<string, unknown>>; readonly now: string;
  }) {
    const workflow = await this.getWorkflow(context, input.workflowId);
    if (workflow.status === "retired") throw new DatabaseError("Retired automation workflow cannot receive versions");
    const definitionJson = JSON.stringify(input.definition);
    await this.database.run(
      "INSERT INTO automation_workflow_versions (id, workflow_id, version, definition_json, definition_hash, status, created_at) VALUES (?, ?, ?, ?, ?, 'draft', ?)",
      input.id, input.workflowId, input.version, definitionJson, hashText(definitionJson), input.now,
    );
    return this.database.first(
      "SELECT id, workflow_id AS workflowId, version, status, definition_hash AS definitionHash, created_at AS createdAt FROM automation_workflow_versions WHERE id = ? LIMIT 1",
      input.id,
    );
  }

  async activateVersion(
    context: RequestContext,
    workflowId: EntityId,
    versionId: EntityId,
    now: string,
  ): Promise<WorkflowRecord> {
    const workflow = await this.getWorkflow(context, workflowId);
    const version = await this.database.first<{ id: EntityId; version: number; status: string }>(
      "SELECT id, version, status FROM automation_workflow_versions WHERE id = ? AND workflow_id = ? LIMIT 1",
      versionId,
      workflowId,
    );
    if (!version) throw new DatabaseError("Automation workflow version not found");
    if (!["draft", "validating"].includes(version.status)) {
      throw new DatabaseError("Only draft or validating workflow versions can be activated");
    }

    await this.database.transaction([
      {
        sql: "UPDATE automation_workflow_versions SET status = 'retired', activated_at = NULL WHERE workflow_id = ? AND status = 'active' AND id <> ?",
        params: [workflowId, versionId],
      },
      {
        sql: "UPDATE automation_workflow_versions SET status = 'active', activated_at = ? WHERE id = ? AND workflow_id = ?",
        params: [now, versionId, workflowId],
      },
      {
        sql: "UPDATE automation_workflows SET active_version_id = ?, status = 'active', updated_at = ? WHERE id = ?",
        params: [versionId, now, workflowId],
      },
      {
        sql: "INSERT INTO outbox_events (id, event_type, event_version, aggregate_type, aggregate_id, organization_id, workspace_id, payload_json, status, attempts, available_at, occurred_at) VALUES (?, 'automation.workflow.activated', 1, 'automation_workflow', ?, ?, ?, ?, 'pending', 0, ?, ?)",
        params: [
          workflowId + ':automation.workflow.activated:' + versionId,
          workflowId,
          workflow.organizationId ?? context.tenantId,
          workflow.workspaceId ?? context.workspaceId ?? null,
          JSON.stringify({ workflowId, versionId }),
          now,
          now,
        ],
      },
    ]);
    return this.getWorkflow(context, workflowId);
  }

  async setWorkflowStatus(
    context: RequestContext,
    workflowId: EntityId,
    status: "paused" | "retired",
    now: string,
  ): Promise<WorkflowRecord> {
    const workflow = await this.getWorkflow(context, workflowId);
    if (workflow.status === "retired" && status !== "retired") {
      throw new DatabaseError("Retired workflow cannot be reopened");
    }
    if (workflow.status === status) return workflow;

    const eventType = status === "retired"
      ? "automation.workflow.retired"
      : "automation.workflow.paused";

    await this.database.transaction([
      {
        sql: "UPDATE automation_workflow_versions SET status = CASE WHEN ? = 'retired' AND status = 'active' THEN 'retired' ELSE status END WHERE workflow_id = ?",
        params: [status, workflowId],
      },
      {
        sql: "UPDATE automation_workflows SET status = ?, active_version_id = CASE WHEN ? = 'retired' THEN NULL ELSE active_version_id END, updated_at = ? WHERE id = ? AND (organization_id IS NULL OR organization_id = ?) AND (workspace_id IS NULL OR workspace_id = ?)",
        params: [status, status, now, workflowId, context.tenantId, context.workspaceId ?? null],
      },
      {
        sql: "INSERT INTO outbox_events (id, event_type, event_version, aggregate_type, aggregate_id, organization_id, workspace_id, payload_json, status, attempts, available_at, occurred_at) VALUES (?, ?, 1, 'automation_workflow', ?, ?, ?, ?, 'pending', 0, ?, ?)",
        params: [
          workflowId + ':' + eventType + ':' + now,
          eventType,
          workflowId,
          workflow.organizationId ?? context.tenantId,
          workflow.workspaceId ?? context.workspaceId ?? null,
          JSON.stringify({ workflowId, status }),
          now,
          now,
        ],
      },
    ]);
    return this.getWorkflow(context, workflowId);
  }

  async startExecution(context: RequestContext, input: {
    readonly id: EntityId; readonly workflowId: EntityId; readonly workflowVersionId: EntityId; readonly triggerId: EntityId;
    readonly correlationId: string; readonly traceId: string; readonly inputReference?: string; readonly initialStatus?: AutomationExecutionStatus; readonly now: string;
  }): Promise<WorkflowExecutionRecord> {
    await this.getWorkflow(context, input.workflowId);
    const existing = await this.database.first<WorkflowExecutionRecord>(
      "SELECT id, workflow_id AS workflowId, workflow_version_id AS workflowVersionId, trigger_id AS triggerId, organization_id AS organizationId, workspace_id AS workspaceId, business_id AS businessId, status, input_reference AS inputReference, correlation_id AS correlationId, trace_id AS traceId, started_at AS startedAt, completed_at AS completedAt, created_at AS createdAt, updated_at AS updatedAt FROM automation_executions WHERE workflow_id = ? AND correlation_id = ? ORDER BY created_at DESC LIMIT 1",
      input.workflowId, input.correlationId,
    );
    if (existing && (existing.status === "pending" || existing.status === "running" || existing.status === "waiting" || existing.status === "completed")) return existing;

    const workflow = await this.getWorkflow(context, input.workflowId);
    await this.database.run(
      "INSERT INTO automation_executions (id, workflow_id, workflow_version_id, trigger_id, organization_id, workspace_id, business_id, status, input_reference, correlation_id, trace_id, started_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id, input.workflowId, input.workflowVersionId, input.triggerId, workflow.organizationId, workflow.workspaceId, workflow.businessId,
      input.initialStatus ?? 'running', input.inputReference ?? null, input.correlationId, input.traceId, input.now, input.now, input.now,
    );
    return this.getExecution(context, input.id);
  }

  async listPendingExecutions(now: string, limit = 50): Promise<readonly WorkflowExecutionRecord[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);
    return this.database.all<WorkflowExecutionRecord>(
      "SELECT id, workflow_id AS workflowId, workflow_version_id AS workflowVersionId, trigger_id AS triggerId, organization_id AS organizationId, workspace_id AS workspaceId, business_id AS businessId, status, input_reference AS inputReference, correlation_id AS correlationId, trace_id AS traceId, started_at AS startedAt, completed_at AS completedAt, created_at AS createdAt, updated_at AS updatedAt FROM automation_executions WHERE status = 'pending' AND created_at <= ? ORDER BY created_at ASC, id ASC LIMIT ?",
      now,
      safeLimit,
    );
  }

  async claimPendingExecution(id: EntityId, now: string): Promise<boolean> {
    const result = await this.database.run(
      "UPDATE automation_executions SET status = 'running', started_at = COALESCE(started_at, ?), updated_at = ? WHERE id = ? AND status = 'pending'",
      now,
      now,
      id,
    );
    return (result.meta?.changes ?? 0) === 1;
  }

  async getExecution(context: RequestContext, id: EntityId): Promise<WorkflowExecutionRecord> {
    const row = await this.database.first<WorkflowExecutionRecord>(
      "SELECT id, workflow_id AS workflowId, workflow_version_id AS workflowVersionId, trigger_id AS triggerId, organization_id AS organizationId, workspace_id AS workspaceId, business_id AS businessId, status, input_reference AS inputReference, correlation_id AS correlationId, trace_id AS traceId, started_at AS startedAt, completed_at AS completedAt, created_at AS createdAt, updated_at AS updatedAt FROM automation_executions WHERE id = ? AND (organization_id IS NULL OR organization_id = ?) AND (workspace_id IS NULL OR workspace_id = ?) LIMIT 1",
      id, context.tenantId, context.workspaceId ?? null,
    );
    if (!row) throw new DatabaseError("Automation execution not found");
    return row;
  }


  async listActions(context: RequestContext, workflowVersionId: EntityId): Promise<readonly {
    readonly id: EntityId;
    readonly capability: string;
    readonly inputMappingJson: string;
    readonly sequence: number;
  }[]> {
    const version = await this.database.first<{ workflowId: EntityId }>(
      "SELECT workflow_id AS workflowId FROM automation_workflow_versions WHERE id = ? LIMIT 1",
      workflowVersionId,
    );
    if (!version) throw new DatabaseError("Automation workflow version not found");
    await this.getWorkflow(context, version.workflowId);
    return this.database.all(
      "SELECT id, capability, input_mapping_json AS inputMappingJson, sequence FROM automation_actions WHERE workflow_version_id = ? ORDER BY sequence ASC, id ASC",
      workflowVersionId,
    );
  }


  async getStepExecution(
    context: RequestContext,
    executionId: EntityId,
    stepId: EntityId,
  ): Promise<{
    readonly id: EntityId;
    readonly executionId: EntityId;
    readonly stepId: EntityId;
    readonly status: "pending" | "running" | "waiting" | "completed" | "failed" | "skipped";
    readonly sequence: number;
    readonly outputReference: string | null;
  } | null> {
    await this.getExecution(context, executionId);
    return this.database.first(
      "SELECT id, execution_id AS executionId, step_id AS stepId, status, sequence, output_reference AS outputReference FROM automation_step_executions WHERE execution_id = ? AND step_id = ? LIMIT 1",
      executionId,
      stepId,
    );
  }

  async createStepExecution(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly executionId: EntityId;
      readonly stepId: EntityId;
      readonly sequence: number;
      readonly now: string;
    },
  ) {
    await this.getExecution(context, input.executionId);
    await this.database.run(
      "INSERT INTO automation_step_executions (id, execution_id, step_id, status, sequence, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?, ?)",
      input.id,
      input.executionId,
      input.stepId,
      input.sequence,
      input.now,
      input.now,
    );
    return this.database.first(
      "SELECT id, execution_id AS executionId, step_id AS stepId, status, sequence, input_reference AS inputReference, output_reference AS outputReference, started_at AS startedAt, completed_at AS completedAt, created_at AS createdAt, updated_at AS updatedAt FROM automation_step_executions WHERE id = ? LIMIT 1",
      input.id,
    );
  }

  async updateStepExecution(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly status: "pending" | "running" | "waiting" | "completed" | "failed" | "skipped";
      readonly inputReference?: string | undefined;
      readonly outputReference?: string | undefined;
      readonly startedAt?: string | undefined;
      readonly completedAt?: string | undefined;
      readonly now: string;
    },
  ) {
    const execution = await this.database.first<{ executionId: EntityId }>(
      "SELECT execution_id AS executionId FROM automation_step_executions WHERE id = ? LIMIT 1",
      input.id,
    );
    if (!execution) throw new DatabaseError("Automation step execution not found");
    await this.getExecution(context, execution.executionId);
    await this.database.run(
      "UPDATE automation_step_executions SET status = ?, input_reference = COALESCE(?, input_reference), output_reference = COALESCE(?, output_reference), started_at = COALESCE(started_at, ?), completed_at = COALESCE(?, completed_at), updated_at = ? WHERE id = ?",
      input.status,
      input.inputReference ?? null,
      input.outputReference ?? null,
      input.startedAt ?? null,
      input.completedAt ?? null,
      input.now,
      input.id,
    );
  }

  async createExecutionAttempt(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly stepExecutionId: EntityId;
      readonly attemptNumber: number;
      readonly idempotencyKey: string;
      readonly now: string;
    },
  ) {
    const step = await this.database.first<{ executionId: EntityId }>(
      "SELECT execution_id AS executionId FROM automation_step_executions WHERE id = ? LIMIT 1",
      input.stepExecutionId,
    );
    if (!step) throw new DatabaseError("Automation step execution not found");
    await this.getExecution(context, step.executionId);
    await this.database.run(
      "INSERT INTO automation_execution_attempts (id, step_execution_id, attempt_number, idempotency_key, status, started_at) VALUES (?, ?, ?, ?, 'running', ?)",
      input.id,
      input.stepExecutionId,
      input.attemptNumber,
      input.idempotencyKey,
      input.now,
    );
  }

  async completeExecutionAttempt(
    context: RequestContext,
    input: {
      readonly idempotencyKey: string;
      readonly status: "succeeded" | "failed" | "cancelled";
      readonly completedAt: string;
    },
  ): Promise<void> {
    const attempt = await this.database.first<{ id: EntityId; executionId: EntityId }>(
      "SELECT a.id, se.execution_id AS executionId FROM automation_execution_attempts a INNER JOIN automation_step_executions se ON se.id = a.step_execution_id WHERE a.idempotency_key = ? LIMIT 1",
      input.idempotencyKey,
    );
    if (!attempt) throw new DatabaseError("Automation execution attempt not found");
    await this.getExecution(context, attempt.executionId);
    await this.database.run(
      "UPDATE automation_execution_attempts SET status = ?, completed_at = ? WHERE id = ?",
      input.status,
      input.completedAt,
      attempt.id,
    );
  }

  async recordExecutionError(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly executionId: EntityId;
      readonly stepExecutionId?: EntityId | undefined;
      readonly attemptId?: EntityId | undefined;
      readonly errorClass: string;
      readonly retryable: boolean;
      readonly safeMessage: string;
      readonly providerReference?: string | undefined;
      readonly now: string;
    },
  ): Promise<void> {
    await this.getExecution(context, input.executionId);
    await this.database.run(
      "INSERT INTO automation_execution_errors (id, execution_id, step_execution_id, attempt_id, error_class, retryable, safe_message, provider_reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id,
      input.executionId,
      input.stepExecutionId ?? null,
      input.attemptId ?? null,
      input.errorClass,
      input.retryable ? 1 : 0,
      input.safeMessage,
      input.providerReference ?? null,
      input.now,
    );
  }

  async setExecutionStatus(context: RequestContext, id: EntityId, status: AutomationExecutionStatus, now: string): Promise<WorkflowExecutionRecord> {
    const current = await this.getExecution(context, id);
    if (current.status === status) return current;
    if (["completed", "failed", "cancelled"].includes(current.status)) {
      throw new DatabaseError("Terminal automation execution cannot be reopened");
    }
    const completedAt = ["completed","failed","cancelled"].includes(status) ? now : current.completedAt;
    await this.database.run(
      "UPDATE automation_executions SET status = ?, completed_at = ?, started_at = COALESCE(started_at, ?), updated_at = ? WHERE id = ?",
      status, completedAt, now, now, id,
    );
    return this.getExecution(context, id);
  }
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index=0; index<value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16).padStart(8,"0");
}
