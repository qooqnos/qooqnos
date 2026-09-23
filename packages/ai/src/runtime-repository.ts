import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export interface AiOperationRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId | null;
  readonly actorId: EntityId | null;
  readonly sessionId: EntityId | null;
  readonly operationType: string;
  readonly operationVersion: number;
  readonly requestId: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly status: string;
  readonly inputReference: string | null;
  readonly outputReference: string | null;
  readonly workerLeaseUntil: string | null;
  readonly workerClaimedBy: string | null;
  readonly workerAttempts: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AiProviderAttemptRecord {
  readonly id: EntityId;
  readonly operationId: EntityId;
  readonly attemptNumber: number;
  readonly providerId: EntityId;
  readonly modelId: EntityId | null;
  readonly status: string;
  readonly providerRequestId: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly latencyMs: number | null;
  readonly inputUnits: number | null;
  readonly outputUnits: number | null;
}

export interface CreateAiOperationInput {
  readonly id: EntityId;
  readonly operationTypeId: EntityId;
  readonly operationType: string;
  readonly operationVersion: number;
  readonly requestId: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly inputReference?: string;
  readonly inputHash?: string;
  readonly promptReference?: string;
  readonly schemaReference?: string;
  readonly policyReference?: string;
  readonly modelSelectionReference?: string;
  readonly now: string;
}

export class AiRuntimeRepository extends Repository {
  constructor(database: D1Database) { super(database); }

  async ensureOperationType(
    context: RequestContext,
    input: { readonly operationType: string; readonly version: number; readonly description?: string; readonly now: string },
    id: EntityId,
  ): Promise<EntityId> {
    const existing = await this.database.first<{ id: EntityId }>(
      "SELECT id FROM ai_operation_types WHERE operation_type = ? LIMIT 1",
      input.operationType,
    );
    if (existing) return existing.id;

    await this.database.run(
      "INSERT OR IGNORE INTO ai_operation_types (id, operation_type, description, active_version, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?)",
      id,
      input.operationType,
      input.description ?? null,
      input.version,
      input.now,
      input.now,
    );
    const created = await this.database.first<{ id: EntityId }>(
      "SELECT id FROM ai_operation_types WHERE operation_type = ? LIMIT 1",
      input.operationType,
    );
    if (!created) throw new DatabaseError("AI operation type not found after registration");
    return created.id;
  }

  async createOperation(context: RequestContext, input: CreateAiOperationInput): Promise<AiOperationRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const existing = await this.database.first<AiOperationRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, actor_id AS actorId, session_id AS sessionId, operation_type AS operationType, operation_version AS operationVersion, request_id AS requestId, correlation_id AS correlationId, idempotency_key AS idempotencyKey, status, input_reference AS inputReference, output_reference AS outputReference, worker_lease_until AS workerLeaseUntil, worker_claimed_by AS workerClaimedBy, worker_attempts AS workerAttempts, created_at AS createdAt, updated_at AS updatedAt FROM ai_operations WHERE organization_id = ? AND idempotency_key = ? LIMIT 1",
      organizationId,
      input.idempotencyKey,
    );
    if (existing) return existing;
    await this.database.run(
      "INSERT INTO ai_operations (id, operation_type_id, operation_type, operation_version, organization_id, workspace_id, actor_id, request_id, correlation_id, idempotency_key, status, input_reference, input_hash, prompt_reference, schema_reference, policy_reference, model_selection_reference, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'created', ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id, input.operationTypeId, input.operationType, input.operationVersion, organizationId, context.workspaceId ?? null, context.actorId ?? null,
      input.requestId, input.correlationId, input.idempotencyKey, input.inputReference ?? null, input.inputHash ?? null,
      input.promptReference ?? null, input.schemaReference ?? null, input.policyReference ?? null, input.modelSelectionReference ?? null,
      input.now, input.now,
    );
    return this.getOperation(context, input.id);
  }

  async getOperation(context: RequestContext, id: EntityId): Promise<AiOperationRecord> {
    const row = await this.database.first<AiOperationRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, actor_id AS actorId, session_id AS sessionId, operation_type AS operationType, operation_version AS operationVersion, request_id AS requestId, correlation_id AS correlationId, idempotency_key AS idempotencyKey, status, input_reference AS inputReference, output_reference AS outputReference, worker_lease_until AS workerLeaseUntil, worker_claimed_by AS workerClaimedBy, worker_attempts AS workerAttempts, created_at AS createdAt, updated_at AS updatedAt FROM ai_operations WHERE id = ? AND organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?) LIMIT 1",
      id,
      this.requireOrganization({ organizationId: context.tenantId }),
      context.workspaceId ?? null,
    );
    if (!row) throw new DatabaseError("AI operation not found");
    return row;
  }


  async listRunnableOperations(
    now: string,
    limit = 25,
  ): Promise<readonly AiOperationRecord[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    return this.database.all<AiOperationRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, actor_id AS actorId, session_id AS sessionId, operation_type AS operationType, operation_version AS operationVersion, request_id AS requestId, correlation_id AS correlationId, idempotency_key AS idempotencyKey, status, input_reference AS inputReference, output_reference AS outputReference, worker_lease_until AS workerLeaseUntil, worker_claimed_by AS workerClaimedBy, worker_attempts AS workerAttempts, created_at AS createdAt, updated_at AS updatedAt FROM ai_operations WHERE status IN ('created','entitlement_checked','started') AND (worker_lease_until IS NULL OR worker_lease_until <= ?) ORDER BY created_at ASC, id ASC LIMIT ?",
      now,
      safeLimit,
    );
  }

  async claimOperation(
    id: EntityId,
    workerId: string,
    now: string,
    leaseUntil: string,
  ): Promise<AiOperationRecord | null> {
    await this.database.run(
      "UPDATE ai_operations SET status='started', worker_lease_until=?, worker_claimed_by=?, worker_attempts=worker_attempts+1, updated_at=? WHERE id=? AND status IN ('created','entitlement_checked','started') AND (worker_lease_until IS NULL OR worker_lease_until <= ?)",
      leaseUntil,
      workerId,
      now,
      id,
      now,
    );
    return this.database.first<AiOperationRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, actor_id AS actorId, session_id AS sessionId, operation_type AS operationType, operation_version AS operationVersion, request_id AS requestId, correlation_id AS correlationId, idempotency_key AS idempotencyKey, status, input_reference AS inputReference, output_reference AS outputReference, worker_lease_until AS workerLeaseUntil, worker_claimed_by AS workerClaimedBy, worker_attempts AS workerAttempts, created_at AS createdAt, updated_at AS updatedAt FROM ai_operations WHERE id=? AND worker_claimed_by=? LIMIT 1",
      id,
      workerId,
    );
  }

  async releaseOperationLease(
    context: RequestContext,
    id: EntityId,
    workerId: string,
    now: string,
  ): Promise<void> {
    await this.getOperation(context, id);
    await this.database.run(
      "UPDATE ai_operations SET worker_lease_until=NULL, worker_claimed_by=NULL, updated_at=? WHERE id=? AND worker_claimed_by=?",
      now,
      id,
      workerId,
    );
  }

  async setOperationStatus(context: RequestContext, id: EntityId, status: string, now: string, outputReference?: string) {
    const current = await this.getOperation(context, id);
    if (current.status === status) return current;
    if (isTerminalAiOperationStatus(current.status)) {
      throw new DatabaseError("Terminal AI operation cannot be reopened");
    }
    await this.database.run(
      "UPDATE ai_operations SET status = ?, output_reference = COALESCE(?, output_reference), updated_at = ? WHERE id = ?",
      status, outputReference ?? null, now, id,
    );
    return this.getOperation(context, current.id);
  }

function isTerminalAiOperationStatus(status: string): boolean {
  return ["succeeded", "partially_succeeded", "failed", "cancelled", "expired", "blocked"].includes(status);
}

  async recordProviderAttempt(context: RequestContext, input: {
    readonly id: EntityId; readonly operationId: EntityId; readonly attemptNumber: number;
    readonly providerId: EntityId; readonly modelId?: EntityId; readonly status: string;
    readonly providerRequestId?: string; readonly requestReference?: string; readonly responseReference?: string;
    readonly startedAt: string; readonly completedAt?: string; readonly latencyMs?: number;
    readonly inputUnits?: number; readonly outputUnits?: number;
    readonly now: string;
  }): Promise<AiProviderAttemptRecord> {
    const operation = await this.getOperation(context, input.operationId);
    await this.database.run(
      "INSERT INTO ai_provider_attempts (id, operation_id, attempt_number, provider_id, model_id, provider_request_id, request_reference, response_reference, status, started_at, completed_at, latency_ms, input_units, output_units) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id, operation.id, input.attemptNumber, input.providerId, input.modelId ?? null, input.providerRequestId ?? null,
      input.requestReference ?? null, input.responseReference ?? null, input.status, input.startedAt, input.completedAt ?? null,
      input.latencyMs ?? null, input.inputUnits ?? null, input.outputUnits ?? null,
    );
    const row = await this.database.first<AiProviderAttemptRecord>(
      "SELECT id, operation_id AS operationId, attempt_number AS attemptNumber, provider_id AS providerId, model_id AS modelId, status, provider_request_id AS providerRequestId, started_at AS startedAt, completed_at AS completedAt, latency_ms AS latencyMs, input_units AS inputUnits, output_units AS outputUnits FROM ai_provider_attempts WHERE id = ? LIMIT 1",
      input.id,
    );
    if (!row) throw new DatabaseError("AI provider attempt not found after creation");
    return row;
  }

  async recordResult(context: RequestContext, input: {
    readonly id: EntityId; readonly operationId: EntityId; readonly status: "succeeded"|"partially_succeeded"|"failed"|"blocked"|"abstained";
    readonly validatedOutputReference?: string; readonly schemaVersionReference?: string;
    readonly providerId?: EntityId; readonly modelId?: EntityId; readonly safetyOutcome?: string;
    readonly provenance?: readonly string[]; readonly warnings?: readonly string[]; readonly abstention?: Readonly<Record<string, unknown>>;
    readonly attemptSummary?: Readonly<Record<string, unknown>>; readonly errorClassification?: string; readonly now: string;
  }) {
    await this.getOperation(context, input.operationId);
    await this.database.run(
      "INSERT OR IGNORE INTO ai_runtime_results (id, operation_id, status, validated_output_reference, schema_version_reference, provider_id, model_id, safety_outcome, provenance_json, warnings_json, abstention_json, attempt_summary_json, error_classification, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id, input.operationId, input.status, input.validatedOutputReference ?? null, input.schemaVersionReference ?? null,
      input.providerId ?? null, input.modelId ?? null, input.safetyOutcome ?? null,
      input.provenance ? JSON.stringify(input.provenance) : null, input.warnings ? JSON.stringify(input.warnings) : null,
      input.abstention ? JSON.stringify(input.abstention) : null, input.attemptSummary ? JSON.stringify(input.attemptSummary) : null,
      input.errorClassification ?? null, input.now,
    );
    const operationStatus = input.status === "succeeded" ? "succeeded" : input.status === "abstained" ? "blocked" : input.status;
    await this.setOperationStatus(context, input.operationId, operationStatus, input.now, input.validatedOutputReference);
  }

  async getResult(
    context: RequestContext,
    operationId: EntityId,
  ): Promise<{
    readonly status: "succeeded" | "partially_succeeded" | "failed" | "blocked" | "abstained";
    readonly providerId: string | null;
    readonly modelId: string | null;
    readonly safetyOutcome: string | null;
    readonly provenance: string[];
    readonly warnings: string[];
  } | null> {
    await this.getOperation(context, operationId);
    const row = await this.database.first<{
      readonly status: "succeeded" | "partially_succeeded" | "failed" | "blocked" | "abstained";
      readonly providerId: string | null;
      readonly modelId: string | null;
      readonly safetyOutcome: string | null;
      readonly provenanceJson: string | null;
      readonly warningsJson: string | null;
    }>(
      "SELECT status, provider_id AS providerId, model_id AS modelId, safety_outcome AS safetyOutcome, provenance_json AS provenanceJson, warnings_json AS warningsJson FROM ai_runtime_results WHERE operation_id = ? LIMIT 1",
      operationId,
    );
    if (!row) return null;

    const provenance = parseStringArray(row.provenanceJson);
    const warnings = parseStringArray(row.warningsJson);
    return {
      status: row.status,
      providerId: row.providerId,
      modelId: row.modelId,
      safetyOutcome: row.safetyOutcome,
      provenance,
      warnings,
    };
  }

  async recordUsage(context: RequestContext, input: {
    readonly id: EntityId; readonly operationId: EntityId; readonly attemptId?: EntityId;
    readonly operationType: string; readonly operationVersion: number; readonly meterUnit: string; readonly quantity: number;
    readonly providerId?: EntityId; readonly modelId?: EntityId; readonly entitlementDecisionReference?: string;
    readonly billingUsageReference?: string; readonly idempotencyKey: string; readonly now: string;
  }): Promise<void> {
    const operation = await this.getOperation(context, input.operationId);
    if (!Number.isSafeInteger(input.quantity) || input.quantity < 0) throw new DatabaseError("AI usage quantity must be a non-negative integer");
    await this.database.run(
      "INSERT OR IGNORE INTO ai_usage_records (id, operation_id, attempt_id, organization_id, workspace_id, actor_id, operation_type, operation_version, meter_unit, quantity, provider_id, model_id, usage_status, idempotency_key, entitlement_decision_reference, billing_usage_reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'recorded', ?, ?, ?, ?)",
      input.id, input.operationId, input.attemptId ?? null, operation.organizationId, operation.workspaceId ?? null, context.actorId ?? null,
      input.operationType, input.operationVersion, input.meterUnit, input.quantity, input.providerId ?? null, input.modelId ?? null,
      input.idempotencyKey, input.entitlementDecisionReference ?? null, input.billingUsageReference ?? null, input.now,
    );
  }
}


function parseStringArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch {
    throw new DatabaseError("Stored AI Runtime string array is invalid");
  }
}
