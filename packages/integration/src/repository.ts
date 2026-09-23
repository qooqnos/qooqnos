import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export interface IntegrationAccountRecord {
  readonly id: EntityId; readonly organizationId: EntityId; readonly workspaceId: EntityId | null;
  readonly providerId: EntityId; readonly accountType: string; readonly externalAccountReference: string;
  readonly status: string; readonly credentialReference: string | null; readonly metadata: Readonly<Record<string, unknown>> | null;
  readonly connectedAt: string | null; readonly disconnectedAt: string | null;
  readonly createdAt: string; readonly updatedAt: string;
}

export interface IntegrationSyncJobRecord {
  readonly id: EntityId;
  readonly integrationAccountId: EntityId;
  readonly syncType: string;
  readonly direction: "inbound" | "outbound" | "bidirectional";
  readonly status: "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";
  readonly cursorReference: string | null;
  readonly checkpointReference: string | null;
  readonly itemCount: number;
  readonly errorCount: number;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly nextRunAt: string | null;
  readonly correlationId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface IntegrationWebhookRecord {
  readonly id: EntityId; readonly integrationAccountId: EntityId; readonly externalEventId: string;
  readonly eventType: string; readonly signatureStatus: string; readonly receivedAt: string;
  readonly payloadReference: string | null; readonly processingStatus: string; readonly processedAt: string | null;
  readonly retryCount: number; readonly lastErrorReference: string | null; readonly correlationId: string;
}

export class IntegrationRepository extends Repository {
  constructor(database: D1Database) { super(database); }

  async createAccount(context: RequestContext, input: {
    readonly id: EntityId; readonly providerId: EntityId; readonly accountType: string; readonly externalAccountReference: string;
    readonly credentialReference?: string; readonly metadata?: Readonly<Record<string, unknown>>; readonly now: string;
  }): Promise<IntegrationAccountRecord> {
    const organizationId=this.requireOrganization({organizationId:context.tenantId});
    await this.database.run(
      "INSERT INTO integration_accounts (id, organization_id, workspace_id, provider_id, account_type, external_account_reference, status, credential_reference, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)",
      input.id,organizationId,context.workspaceId??null,input.providerId,input.accountType.trim(),input.externalAccountReference.trim(),
      input.credentialReference??null,input.metadata?JSON.stringify(input.metadata):null,input.now,input.now);
    return this.getAccount(context,input.id);
  }

  async getAccountForWorker(id: EntityId): Promise<IntegrationAccountRecord> {
    const row = await this.database.first<IntegrationAccountRow>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, provider_id AS providerId, account_type AS accountType, external_account_reference AS externalAccountReference, status, credential_reference AS credentialReference, metadata_json AS metadataJson, connected_at AS connectedAt, disconnected_at AS disconnectedAt, created_at AS createdAt, updated_at AS updatedAt FROM integration_accounts WHERE id = ? LIMIT 1",
      id,
    );
    if (!row) throw new DatabaseError("Integration account not found");
    return { ...row, metadata: parseObject(row.metadataJson) };
  }

  async getAccount(context: RequestContext,id: EntityId): Promise<IntegrationAccountRecord>{
    const row=await this.database.first<IntegrationAccountRow>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, provider_id AS providerId, account_type AS accountType, external_account_reference AS externalAccountReference, status, credential_reference AS credentialReference, metadata_json AS metadataJson, connected_at AS connectedAt, disconnected_at AS disconnectedAt, created_at AS createdAt, updated_at AS updatedAt FROM integration_accounts WHERE id = ? AND organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?) LIMIT 1",
      id,this.requireOrganization({organizationId:context.tenantId}),context.workspaceId??null);
    if(!row) throw new DatabaseError("Integration account not found");
    return {...row,metadata:parseObject(row.metadataJson)};
  }

  async recordWebhook(context: RequestContext,input:{
    readonly id:EntityId; readonly integrationAccountId:EntityId; readonly externalEventId:string;
    readonly eventType:string; readonly signatureStatus:"verified"|"invalid"|"missing"|"not_required";
    readonly payloadReference?:string; readonly correlationId:string; readonly now:string;
  }):Promise<IntegrationWebhookRecord>{
    const account=await this.getAccount(context,input.integrationAccountId);
    const existing=await this.database.first<IntegrationWebhookRecord>(
      "SELECT id, integration_account_id AS integrationAccountId, external_event_id AS externalEventId, event_type AS eventType, signature_status AS signatureStatus, received_at AS receivedAt, payload_reference AS payloadReference, processing_status AS processingStatus, processed_at AS processedAt, retry_count AS retryCount, last_error_reference AS lastErrorReference, correlation_id AS correlationId FROM integration_webhooks WHERE integration_account_id = ? AND external_event_id = ? LIMIT 1",
      account.id,input.externalEventId);
    if(existing)return existing;
    await this.database.run(
      "INSERT INTO integration_webhooks (id, integration_account_id, external_event_id, event_type, signature_status, received_at, payload_reference, processing_status, correlation_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'received', ?, ?)",
      input.id,input.integrationAccountId,input.externalEventId.trim(),input.eventType.trim(),input.signatureStatus,input.now,
      input.payloadReference??null,input.correlationId,input.now);
    const row=await this.database.first<IntegrationWebhookRecord>(
      "SELECT id, integration_account_id AS integrationAccountId, external_event_id AS externalEventId, event_type AS eventType, signature_status AS signatureStatus, received_at AS receivedAt, payload_reference AS payloadReference, processing_status AS processingStatus, processed_at AS processedAt, retry_count AS retryCount, last_error_reference AS lastErrorReference, correlation_id AS correlationId FROM integration_webhooks WHERE id = ? LIMIT 1",
      input.id);
    if(!row)throw new DatabaseError("Integration webhook not found after creation");
    return row;
  }

  async createSyncJob(context: RequestContext, input: {
    readonly id: EntityId;
    readonly integrationAccountId: EntityId;
    readonly syncType: string;
    readonly direction: "inbound"|"outbound"|"bidirectional";
    readonly correlationId: string;
    readonly nextRunAt?: string;
    readonly now: string;
  }) {
    await this.getAccount(context, input.integrationAccountId);
    await this.database.run(
      "INSERT INTO integration_sync_jobs (id, integration_account_id, sync_type, direction, status, next_run_at, correlation_id, created_at, updated_at) VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?)",
      input.id,input.integrationAccountId,input.syncType.trim(),input.direction,input.nextRunAt??null,input.correlationId,input.now,input.now);
    return this.database.first(
      "SELECT id, integration_account_id AS integrationAccountId, sync_type AS syncType, direction, status, cursor_reference AS cursorReference, checkpoint_reference AS checkpointReference, item_count AS itemCount, error_count AS errorCount, started_at AS startedAt, completed_at AS completedAt, next_run_at AS nextRunAt, correlation_id AS correlationId, created_at AS createdAt, updated_at AS updatedAt FROM integration_sync_jobs WHERE id = ? LIMIT 1",
      input.id,
    );
  }

  async setSyncJobStatus(context: RequestContext, id: EntityId, status: "queued"|"running"|"paused"|"completed"|"failed"|"cancelled", now: string) {
    const row = await this.database.first<{ accountId: EntityId }>(
      "SELECT integration_account_id AS accountId FROM integration_sync_jobs WHERE id = ? LIMIT 1",
      id,
    );
    if (!row) throw new DatabaseError("Integration sync job not found");
    await this.getAccount(context,row.accountId);
    await this.database.run(
      "UPDATE integration_sync_jobs SET status = ?, started_at = CASE WHEN ? = 'running' AND started_at IS NULL THEN ? ELSE started_at END, completed_at = CASE WHEN ? IN ('completed','failed','cancelled') THEN ? ELSE completed_at END, updated_at = ? WHERE id = ?",
      status,status,now,status,now,now,id);
  }

  async upsertExternalReference(context: RequestContext,input:{
    readonly id: EntityId;
    readonly resourceType:string;
    readonly resourceId:EntityId;
    readonly externalType:string;
    readonly externalReference:string;
    readonly integrationAccountId?:EntityId;
    readonly status?:string;
    readonly metadata?:Readonly<Record<string,unknown>>;
    readonly now:string;
  }) {
    const organizationId=this.requireOrganization({organizationId:context.tenantId});
    if(input.integrationAccountId) await this.getAccount(context,input.integrationAccountId);
    await this.database.run(
      "INSERT INTO integration_external_references (id,organization_id,workspace_id,integration_account_id,resource_type,resource_id,external_type,external_reference,status,metadata_json,first_seen_at,last_seen_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(integration_account_id,external_type,external_reference) DO UPDATE SET status=excluded.status, metadata_json=excluded.metadata_json, last_seen_at=excluded.last_seen_at, updated_at=excluded.updated_at",
      input.id,organizationId,context.workspaceId??null,input.integrationAccountId??null,input.resourceType.trim(),input.resourceId,
      input.externalType.trim(),input.externalReference.trim(),input.status??null,input.metadata?JSON.stringify(input.metadata):null,input.now,input.now,input.now,input.now);
  }


  async listProcessableWebhooks(now: string, limit = 50): Promise<readonly IntegrationWebhookRecord[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);
    return this.database.all<IntegrationWebhookRecord>(
      "SELECT id, integration_account_id AS integrationAccountId, external_event_id AS externalEventId, event_type AS eventType, signature_status AS signatureStatus, received_at AS receivedAt, payload_reference AS payloadReference, processing_status AS processingStatus, processed_at AS processedAt, retry_count AS retryCount, last_error_reference AS lastErrorReference, correlation_id AS correlationId FROM integration_webhooks WHERE processing_status IN ('received','queued') ORDER BY received_at ASC, id ASC LIMIT ?",
      safeLimit,
    );
  }

  async claimWebhook(id: EntityId, _now: string): Promise<IntegrationWebhookRecord | null> {
    await this.database.run(
      "UPDATE integration_webhooks SET processing_status='processing' WHERE id=? AND processing_status IN ('received','queued')",
      id,
    );
    return this.database.first<IntegrationWebhookRecord>(
      "SELECT id, integration_account_id AS integrationAccountId, external_event_id AS externalEventId, event_type AS eventType, signature_status AS signatureStatus, received_at AS receivedAt, payload_reference AS payloadReference, processing_status AS processingStatus, processed_at AS processedAt, retry_count AS retryCount, last_error_reference AS lastErrorReference, correlation_id AS correlationId FROM integration_webhooks WHERE id=? AND processing_status='processing' LIMIT 1",
      id,
    );
  }

  async finishWebhook(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly status: "processed" | "ignored" | "failed" | "queued";
      readonly now: string;
      readonly errorReference?: string;
    },
  ): Promise<void> {
    const current = await this.database.first<IntegrationWebhookRecord>(
      "SELECT id, integration_account_id AS integrationAccountId, external_event_id AS externalEventId, event_type AS eventType, signature_status AS signatureStatus, received_at AS receivedAt, payload_reference AS payloadReference, processing_status AS processingStatus, processed_at AS processedAt, retry_count AS retryCount, last_error_reference AS lastErrorReference, correlation_id AS correlationId FROM integration_webhooks WHERE id=? LIMIT 1",
      input.id,
    );
    if (!current) throw new DatabaseError("Integration webhook not found");
    await this.getAccount(context, current.integrationAccountId);
    const terminal = input.status === "processed" || input.status === "ignored";
    await this.database.run(
      "UPDATE integration_webhooks SET processing_status=?, processed_at=CASE WHEN ? THEN ? ELSE processed_at END, retry_count=CASE WHEN ?='queued' THEN retry_count+1 ELSE retry_count END, last_error_reference=? WHERE id=? AND processing_status='processing'",
      input.status,
      terminal ? 1 : 0,
      input.now,
      input.status,
      input.errorReference ?? null,
      input.id,
    );
  }

  async listDueSyncJobs(now: string, limit = 50): Promise<readonly IntegrationSyncJobRecord[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    return this.database.all<IntegrationSyncJobRecord>(
      "SELECT id, integration_account_id AS integrationAccountId, sync_type AS syncType, direction, status, cursor_reference AS cursorReference, checkpoint_reference AS checkpointReference, item_count AS itemCount, error_count AS errorCount, started_at AS startedAt, completed_at AS completedAt, next_run_at AS nextRunAt, correlation_id AS correlationId, created_at AS createdAt, updated_at AS updatedAt FROM integration_sync_jobs WHERE status='queued' AND (next_run_at IS NULL OR next_run_at<=?) ORDER BY COALESCE(next_run_at, created_at) ASC, id ASC LIMIT ?",
      now,
      safeLimit,
    );
  }

  async claimSyncJob(id: EntityId, now: string): Promise<IntegrationSyncJobRecord | null> {
    await this.database.run(
      "UPDATE integration_sync_jobs SET status='running', started_at=COALESCE(started_at, ?), updated_at=? WHERE id=? AND status='queued'",
      now,
      now,
      id,
    );
    return this.database.first<IntegrationSyncJobRecord>(
      "SELECT id, integration_account_id AS integrationAccountId, sync_type AS syncType, direction, status, cursor_reference AS cursorReference, checkpoint_reference AS checkpointReference, item_count AS itemCount, error_count AS errorCount, started_at AS startedAt, completed_at AS completedAt, next_run_at AS nextRunAt, correlation_id AS correlationId, created_at AS createdAt, updated_at AS updatedAt FROM integration_sync_jobs WHERE id=? AND status='running' LIMIT 1",
      id,
    );
  }

  async finishSyncJob(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly status: "completed" | "failed" | "queued";
      readonly cursorReference?: string;
      readonly checkpointReference?: string;
      readonly itemCount?: number;
      readonly errorCount?: number;
      readonly nextRunAt?: string | null;
      readonly now: string;
    },
  ): Promise<void> {
    const current = await this.database.first<IntegrationSyncJobRecord>(
      "SELECT id, integration_account_id AS integrationAccountId, sync_type AS syncType, direction, status, cursor_reference AS cursorReference, checkpoint_reference AS checkpointReference, item_count AS itemCount, error_count AS errorCount, started_at AS startedAt, completed_at AS completedAt, next_run_at AS nextRunAt, correlation_id AS correlationId, created_at AS createdAt, updated_at AS updatedAt FROM integration_sync_jobs WHERE id=? LIMIT 1",
      input.id,
    );
    if (!current) throw new DatabaseError("Integration sync job not found");
    await this.getAccount(context, current.integrationAccountId);
    await this.database.run(
      "UPDATE integration_sync_jobs SET status=?, cursor_reference=COALESCE(?,cursor_reference), checkpoint_reference=COALESCE(?,checkpoint_reference), item_count=item_count+?, error_count=error_count+?, completed_at=CASE WHEN ? IN ('completed','failed') THEN ? ELSE completed_at END, next_run_at=?, updated_at=? WHERE id=? AND status='running'",
      input.status,
      input.cursorReference ?? null,
      input.checkpointReference ?? null,
      Math.max(0, input.itemCount ?? 0),
      Math.max(0, input.errorCount ?? 0),
      input.status,
      input.now,
      input.nextRunAt ?? null,
      input.now,
      input.id,
    );
  }

  async updateWebhookStatus(context:RequestContext,id:EntityId,status:string,now:string,errorReference?:string){
    const row=await this.database.first<{accountId:EntityId}>(
      "SELECT integration_account_id AS accountId FROM integration_webhooks WHERE id = ? LIMIT 1",id);
    if(!row)throw new DatabaseError("Integration webhook not found");
    await this.getAccount(context,row.accountId);
    await this.database.run(
      "UPDATE integration_webhooks SET processing_status = ?, processed_at = CASE WHEN ? IN ('processed','ignored') THEN ? ELSE processed_at END, last_error_reference = ? WHERE id = ?",
      status,status,now,errorReference??null,id);
  }
}

interface IntegrationAccountRow extends Omit<IntegrationAccountRecord,"metadata"> { readonly metadataJson:string|null; }
function parseObject(value:string|null):Readonly<Record<string,unknown>>|null{
  if(!value)return null; try{const parsed=JSON.parse(value);return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:null;}catch{throw new DatabaseError("Stored Integration metadata is invalid");}
}
