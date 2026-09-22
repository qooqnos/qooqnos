import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export interface IntegrationAccountRecord {
  readonly id: EntityId; readonly organizationId: EntityId; readonly workspaceId: EntityId | null;
  readonly providerId: EntityId; readonly accountType: string; readonly externalAccountReference: string;
  readonly status: string; readonly credentialReference: string | null; readonly metadata: Readonly<Record<string, unknown>> | null;
  readonly connectedAt: string | null; readonly disconnectedAt: string | null;
  readonly createdAt: string; readonly updatedAt: string;
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
