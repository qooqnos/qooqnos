import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

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
    await this.getWorkflow(context, workflowId);
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
    readonly correlationId: string; readonly traceId: string; readonly inputReference?: string; readonly now: string;
  }): Promise<WorkflowExecutionRecord> {
    await this.getWorkflow(context, input.workflowId);
    const existing = await this.database.first<WorkflowExecutionRecord>(
      "SELECT id, workflow_id AS workflowId, workflow_version_id AS workflowVersionId, trigger_id AS triggerId, organization_id AS organizationId, workspace_id AS workspaceId, business_id AS businessId, status, input_reference AS inputReference, correlation_id AS correlationId, trace_id AS traceId, started_at AS startedAt, completed_at AS completedAt, created_at AS createdAt, updated_at AS updatedAt FROM automation_executions WHERE workflow_id = ? AND correlation_id = ? ORDER BY created_at DESC LIMIT 1",
      input.workflowId, input.correlationId,
    );
    if (existing && (existing.status === "running" || existing.status === "waiting" || existing.status === "completed")) return existing;

    const workflow = await this.getWorkflow(context, input.workflowId);
    await this.database.run(
      "INSERT INTO automation_executions (id, workflow_id, workflow_version_id, trigger_id, organization_id, workspace_id, business_id, status, input_reference, correlation_id, trace_id, started_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?, ?, ?, ?, ?, ?)",
      input.id, input.workflowId, input.workflowVersionId, input.triggerId, workflow.organizationId, workflow.workspaceId, workflow.businessId,
      input.inputReference ?? null, input.correlationId, input.traceId, input.now, input.now, input.now,
    );
    return this.getExecution(context, input.id);
  }

  async getExecution(context: RequestContext, id: EntityId): Promise<WorkflowExecutionRecord> {
    const row = await this.database.first<WorkflowExecutionRecord>(
      "SELECT id, workflow_id AS workflowId, workflow_version_id AS workflowVersionId, trigger_id AS triggerId, organization_id AS organizationId, workspace_id AS workspaceId, business_id AS businessId, status, input_reference AS inputReference, correlation_id AS correlationId, trace_id AS traceId, started_at AS startedAt, completed_at AS completedAt, created_at AS createdAt, updated_at AS updatedAt FROM automation_executions WHERE id = ? AND (organization_id IS NULL OR organization_id = ?) AND (workspace_id IS NULL OR workspace_id = ?) LIMIT 1",
      id, context.tenantId, context.workspaceId ?? null,
    );
    if (!row) throw new DatabaseError("Automation execution not found");
    return row;
  }

  async setExecutionStatus(context: RequestContext, id: EntityId, status: AutomationExecutionStatus, now: string): Promise<WorkflowExecutionRecord> {
    const current = await this.getExecution(context, id);
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
