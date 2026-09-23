import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type PrivacySubjectType = "customer" | "user" | "member" | "actor";
export type PrivacyConsentStatus = "granted" | "revoked" | "expired";
export type PrivacyRequestType = "access" | "export" | "delete" | "restrict" | "correct";
export type PrivacyRequestStatus = "requested" | "validating" | "approved" | "processing" | "completed" | "rejected" | "cancelled";

export interface ConsentRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId | null;
  readonly subjectType: PrivacySubjectType;
  readonly subjectId: EntityId;
  readonly purpose: string;
  readonly consentVersion: string;
  readonly status: PrivacyConsentStatus;
  readonly source: string;
  readonly evidenceReference: string | null;
  readonly grantedAt: string | null;
  readonly revokedAt: string | null;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PrivacyRequestRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId | null;
  readonly subjectType: PrivacySubjectType;
  readonly subjectId: EntityId;
  readonly requestType: PrivacyRequestType;
  readonly status: PrivacyRequestStatus;
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly dueAt: string | null;
  readonly completedAt: string | null;
  readonly resultReference: string | null;
  readonly rejectionReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PrivacyProcessingRecord {
  readonly id: EntityId;
  readonly requestId: EntityId;
  readonly moduleId: string;
  readonly action: string;
  readonly resourceReference: string | null;
  readonly status: "queued" | "processing" | "completed" | "failed" | "skipped";
  readonly errorReference: string | null;
  readonly processedAt: string | null;
  readonly createdAt: string;
}

export class PrivacyRepository extends Repository {
  constructor(database: D1Database) { super(database); }

  async createConsent(context: RequestContext, input: {
    readonly id: EntityId; readonly subjectType: PrivacySubjectType; readonly subjectId: EntityId;
    readonly purpose: string; readonly consentVersion: string; readonly source: string;
    readonly evidenceReference?: string; readonly grantedAt?: string; readonly expiresAt?: string; readonly now: string;
  }): Promise<ConsentRecord> {
    const organizationId=this.requireOrganization({organizationId:context.tenantId});
    await this.assertSubjectScope(context, input.subjectType, input.subjectId);
    if(!input.purpose.trim()||!input.consentVersion.trim()||!input.source.trim()) throw new DatabaseError("Consent purpose/version/source are required");
    await this.database.transaction([
      {
        sql: "UPDATE privacy_consents SET status = 'revoked', revoked_at = ?, updated_at = ? WHERE organization_id = ? AND subject_type = ? AND subject_id = ? AND purpose = ? AND status = 'granted'",
        params: [input.grantedAt ?? input.now, input.now, organizationId, input.subjectType, input.subjectId, input.purpose.trim()],
      },
      {
        sql: "INSERT INTO privacy_consents (id, organization_id, workspace_id, subject_type, subject_id, purpose, consent_version, status, source, evidence_reference, granted_at, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'granted', ?, ?, ?, ?, ?, ?)",
        params: [
          input.id,
          organizationId,
          context.workspaceId ?? null,
          input.subjectType,
          input.subjectId,
          input.purpose.trim(),
          input.consentVersion.trim(),
          input.source.trim(),
          input.evidenceReference ?? null,
          input.grantedAt ?? input.now,
          input.expiresAt ?? null,
          input.now,
          input.now,
        ],
      },
    ]);
    return this.getConsent(context,input.id);
  }

  async expireConsents(now: string, limit = 500): Promise<number> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 1000);
    const rows = await this.database.all<{ id: EntityId; organizationId: EntityId; workspaceId: EntityId | null }>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId FROM privacy_consents WHERE status='granted' AND expires_at IS NOT NULL AND expires_at <= ? ORDER BY expires_at ASC, id ASC LIMIT ?",
      now,
      safeLimit,
    );
    let expired = 0;
    for (const row of rows) {
      const results = await this.database.transaction([
        {
          sql: "UPDATE privacy_consents SET status='expired', updated_at=? WHERE id=? AND status='granted' AND expires_at IS NOT NULL AND expires_at <= ?",
          params: [now, row.id, now],
        },
        {
          sql: "INSERT OR IGNORE INTO outbox_events (id,event_type,event_version,aggregate_type,aggregate_id,organization_id,workspace_id,payload_json,status,attempts,available_at,occurred_at,published_at) VALUES (?, ?, 1, 'privacy_consent', ?, ?, ?, ?, 'pending', 0, ?, ?, NULL)",
          params: [
            row.id + ":expired",
            "privacy.consent.expired",
            row.id,
            row.organizationId,
            row.workspaceId,
            JSON.stringify({ consentId: row.id, status: "expired" }),
            now,
            now,
          ],
        },
      ]);
      if ((results[0]?.meta?.changes ?? 0) === 1) expired += 1;
    }
    return expired;
  }

  async revokeConsent(context:RequestContext,id:EntityId,revokedAt:string,now:string):Promise<ConsentRecord>{
    const current=await this.getConsent(context,id);
    if(!current)throw new DatabaseError("Consent not found");
    if(current.status!=="granted")return current;
    await this.database.run("UPDATE privacy_consents SET status='revoked', revoked_at=?, updated_at=? WHERE id=?",revokedAt,now,id);
    return this.getConsent(context,id);
  }

  async getConsent(context:RequestContext,id:EntityId):Promise<ConsentRecord>{
    const row=await this.database.first<ConsentRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, subject_type AS subjectType, subject_id AS subjectId, purpose, consent_version AS consentVersion, status, source, evidence_reference AS evidenceReference, granted_at AS grantedAt, revoked_at AS revokedAt, expires_at AS expiresAt, created_at AS createdAt, updated_at AS updatedAt FROM privacy_consents WHERE id=? AND organization_id=? AND (workspace_id IS NULL OR workspace_id=?) LIMIT 1",
      id,this.requireOrganization({organizationId:context.tenantId}),context.workspaceId??null);
    if(!row)throw new DatabaseError("Consent not found");
    return row;
  }

  async getActiveConsent(context:RequestContext,subjectType:PrivacySubjectType,subjectId:EntityId,purpose:string):Promise<ConsentRecord|null>{
    return this.database.first<ConsentRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, subject_type AS subjectType, subject_id AS subjectId, purpose, consent_version AS consentVersion, status, source, evidence_reference AS evidenceReference, granted_at AS grantedAt, revoked_at AS revokedAt, expires_at AS expiresAt, created_at AS createdAt, updated_at AS updatedAt FROM privacy_consents WHERE organization_id=? AND subject_type=? AND subject_id=? AND purpose=? AND status='granted' AND (expires_at IS NULL OR expires_at>?) AND (workspace_id IS NULL OR workspace_id=?) ORDER BY created_at DESC LIMIT 1",
      this.requireOrganization({organizationId:context.tenantId}),subjectType,subjectId,purpose.trim(),new Date().toISOString(),context.workspaceId??null);
  }

  async createRequest(context:RequestContext,input:{
    readonly id:EntityId; readonly subjectType:PrivacySubjectType; readonly subjectId:EntityId; readonly requestType:PrivacyRequestType;
    readonly requestedBy:string; readonly dueAt?:string; readonly now:string;
  }):Promise<PrivacyRequestRecord>{
    const organizationId=this.requireOrganization({organizationId:context.tenantId});
    await this.assertSubjectScope(context, input.subjectType, input.subjectId);
    if(!input.requestedBy.trim())throw new DatabaseError("Privacy request requester is required");
    await this.database.run(
      "INSERT INTO privacy_requests (id, organization_id, workspace_id, subject_type, subject_id, request_type, status, requested_by, requested_at, due_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'requested', ?, ?, ?, ?, ?)",
      input.id,organizationId,context.workspaceId??null,input.subjectType,input.subjectId,input.requestType,input.requestedBy.trim(),input.now,input.dueAt??null,input.now,input.now);
    return this.getRequest(context,input.id);
  }

  async getRequest(context:RequestContext,id:EntityId):Promise<PrivacyRequestRecord>{
    const row=await this.database.first<PrivacyRequestRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, subject_type AS subjectType, subject_id AS subjectId, request_type AS requestType, status, requested_by AS requestedBy, requested_at AS requestedAt, due_at AS dueAt, completed_at AS completedAt, result_reference AS resultReference, rejection_reason AS rejectionReason, created_at AS createdAt, updated_at AS updatedAt FROM privacy_requests WHERE id=? AND organization_id=? AND (workspace_id IS NULL OR workspace_id=?) LIMIT 1",
      id,this.requireOrganization({organizationId:context.tenantId}),context.workspaceId??null);
    if(!row)throw new DatabaseError("Privacy request not found");
    return row;
  }

  async transitionRequest(context:RequestContext,id:EntityId,status:PrivacyRequestStatus,now:string,details?:{resultReference?:string;rejectionReason?:string}):Promise<PrivacyRequestRecord>{
    const current=await this.getRequest(context,id);
    if(current.status==="completed"||current.status==="cancelled") return current;
    const completedAt=["completed","rejected","cancelled"].includes(status)?now:current.completedAt;
    await this.database.run(
      "UPDATE privacy_requests SET status=?, completed_at=?, result_reference=COALESCE(?,result_reference), rejection_reason=COALESCE(?,rejection_reason), updated_at=? WHERE id=?",
      status,completedAt,details?.resultReference??null,details?.rejectionReason??null,now,id);
    return this.getRequest(context,id);
  }

  private async assertSubjectScope(
    context: RequestContext,
    subjectType: PrivacySubjectType,
    subjectId: EntityId,
  ): Promise<void> {
    const organizationId=this.requireOrganization({organizationId:context.tenantId});
    const workspaceId=context.workspaceId ?? null;
    let row:{readonly found:number}|null=null;

    if(subjectType === "customer"){
      row=await this.database.first<{readonly found:number}>(
        "SELECT 1 AS found FROM customers WHERE id=? AND organization_id=? LIMIT 1",
        subjectId,
        organizationId,
      );
    } else if(subjectType === "member"){
      row=await this.database.first<{readonly found:number}>(
        "SELECT 1 AS found FROM memberships m INNER JOIN workspaces w ON w.id=m.workspace_id WHERE m.id=? AND w.organization_id=? AND (? IS NULL OR m.workspace_id=?) LIMIT 1",
        subjectId,
        organizationId,
        workspaceId,
        workspaceId,
      );
    } else {
      row=await this.database.first<{readonly found:number}>(
        "SELECT 1 AS found FROM users u WHERE u.id=? AND EXISTS (SELECT 1 FROM memberships m INNER JOIN workspaces w ON w.id=m.workspace_id WHERE m.user_id=u.id AND w.organization_id=? AND (? IS NULL OR m.workspace_id=?)) LIMIT 1",
        subjectId,
        organizationId,
        workspaceId,
        workspaceId,
      );
    }

    if(!row) throw new DatabaseError("Privacy subject does not belong to the current organization/workspace scope");
  }

  async recordProcessing(context:RequestContext,input:{
    readonly id:EntityId; readonly requestId:EntityId; readonly moduleId:string; readonly action:string;
    readonly resourceReference?:string; readonly status:PrivacyProcessingRecord["status"]; readonly errorReference?:string; readonly processedAt?:string; readonly now:string;
  }):Promise<void>{
    await this.getRequest(context,input.requestId);
    await this.database.run(
      "INSERT INTO privacy_processing_records (id, request_id, module_id, action, resource_reference, status, error_reference, processed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id,input.requestId,input.moduleId.trim(),input.action.trim(),input.resourceReference??null,input.status,input.errorReference??null,input.processedAt??null,input.now);
  }
}
