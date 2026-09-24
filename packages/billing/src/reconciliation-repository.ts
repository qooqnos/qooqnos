import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type ReconciliationStatus = "open" | "investigating" | "resolved" | "ignored";
export type ReconciliationEventType = "opened" | "investigating" | "resolved" | "ignored" | "note";

export interface ReconciliationCaseRecord {
  readonly id: EntityId; readonly organizationId: EntityId; readonly workspaceId: EntityId | null;
  readonly businessId: EntityId | null; readonly provider: string; readonly referenceType: string;
  readonly externalReference: string | null; readonly localReference: string | null;
  readonly status: ReconciliationStatus; readonly category: string; readonly details: unknown;
  readonly expectedAmountMinor: number | null; readonly observedAmountMinor: number | null;
  readonly currency: string | null; readonly correlationId: string | null; readonly idempotencyKey: string | null;
  readonly resolutionCode: string | null; readonly resolvedBy: EntityId | null;
  readonly openedAt: string; readonly resolvedAt: string | null; readonly createdAt: string; readonly updatedAt: string;
}
export interface ReconciliationMismatchInput {
  readonly id: EntityId; readonly provider: string; readonly referenceType: string;
  readonly externalReference?: string; readonly localReference?: string; readonly businessId?: EntityId;
  readonly expectedAmountMinor?: number; readonly observedAmountMinor?: number; readonly currency?: string;
  readonly category: string; readonly details?: Readonly<Record<string, unknown>>;
  readonly correlationId: string; readonly idempotencyKey: string; readonly openedAt: string; readonly now: string;
}
export interface ReconciliationEventRecord {
  readonly id: EntityId; readonly caseId: EntityId; readonly organizationId: EntityId;
  readonly eventType: ReconciliationEventType; readonly fromStatus: string | null; readonly toStatus: string | null;
  readonly actorReference: EntityId | null; readonly details: unknown; readonly occurredAt: string; readonly correlationId: string; readonly createdAt: string;
}

export class ReconciliationRepository extends Repository {
  constructor(database: D1Database) { super(database); }

  async openMismatch(context: RequestContext, input: ReconciliationMismatchInput): Promise<ReconciliationCaseRecord> {
    const organizationId=this.requireOrganization({organizationId:context.tenantId});
    if(!input.idempotencyKey.trim()) throw new DatabaseError("Reconciliation idempotency key is required");
    if(!input.provider.trim()||!input.referenceType.trim()||!input.category.trim()) throw new DatabaseError("Reconciliation provider, reference type and category are required");
    if(input.expectedAmountMinor!==undefined && (!Number.isSafeInteger(input.expectedAmountMinor)||input.expectedAmountMinor<0)) throw new DatabaseError("Expected amount must be a non-negative integer");
    if(input.observedAmountMinor!==undefined && (!Number.isSafeInteger(input.observedAmountMinor)||input.observedAmountMinor<0)) throw new DatabaseError("Observed amount must be a non-negative integer");
    const currency=input.currency ? normalizeCurrency(input.currency) : null;
    const existing=await this.getByIdempotency(context,input.idempotencyKey);
    if(existing) return existing;
    await this.database.run(
      "INSERT INTO billing_reconciliation_cases (id,organization_id,workspace_id,business_id,provider,reference_type,external_reference,local_reference,status,category,details_json,opened_at,created_at,updated_at,expected_amount_minor,observed_amount_minor,currency,correlation_id,idempotency_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      input.id,organizationId,context.workspaceId??null,input.businessId??null,input.provider.trim(),input.referenceType.trim(),input.externalReference?.trim()??null,input.localReference?.trim()??null,"open",input.category.trim(),input.details?JSON.stringify(input.details):null,input.openedAt,input.now,input.now,input.expectedAmountMinor??null,input.observedAmountMinor??null,currency,input.correlationId,input.idempotencyKey.trim()
    );
    await this.appendEvent(context,input.id,"opened",null,"open",input.details,input.openedAt,input.correlationId,input.now);
    return (await this.get(context,input.id))!;
  }

  async investigate(context:RequestContext,caseId:EntityId,details?:Readonly<Record<string,unknown>>,occurredAt?:string,now?:string):Promise<ReconciliationCaseRecord>{
    return this.transition(context,caseId,"investigating","investigating",details,occurredAt??new Date().toISOString(),now??occurredAt??new Date().toISOString());
  }
  async resolve(context:RequestContext,caseId:EntityId,resolutionCode:string,details?:Readonly<Record<string,unknown>>,occurredAt?:string,now?:string):Promise<ReconciliationCaseRecord>{
    if(!resolutionCode.trim()) throw new DatabaseError("Reconciliation resolution code is required");
    return this.transition(context,caseId,"resolved",resolutionCode.trim(),details,occurredAt??new Date().toISOString(),now??occurredAt??new Date().toISOString());
  }
  async ignore(context:RequestContext,caseId:EntityId,reason:string,occurredAt?:string,now?:string):Promise<ReconciliationCaseRecord>{
    if(!reason.trim()) throw new DatabaseError("Reconciliation ignore reason is required");
    return this.transition(context,caseId,"ignored",reason.trim(),undefined,occurredAt??new Date().toISOString(),now??occurredAt??new Date().toISOString());
  }
  async addNote(context:RequestContext,caseId:EntityId,details:Readonly<Record<string,unknown>>,occurredAt:string,now:string):Promise<void>{
    const c=await this.get(context,caseId); if(!c) throw new DatabaseError("Reconciliation case not found");
    await this.appendEvent(context,caseId,"note",c.status,c.status,details,occurredAt,c.correlationId??("reconciliation:"+caseId),now);
  }
  async get(context:RequestContext,id:EntityId):Promise<ReconciliationCaseRecord|null>{
    return this.database.first<ReconciliationCaseRecord>(this.select()+" WHERE id=? AND organization_id=? AND (workspace_id IS NULL OR workspace_id=?) LIMIT 1",id,this.requireOrganization({organizationId:context.tenantId}),context.workspaceId??null);
  }
  async listOpen(context:RequestContext,provider?:string):Promise<readonly ReconciliationCaseRecord[]>{
    const sql=this.select()+" WHERE organization_id=? AND (workspace_id IS NULL OR workspace_id=?) AND status IN ('open','investigating')"+(provider?" AND provider=?":"")+" ORDER BY opened_at ASC,id ASC";
    return this.database.all<ReconciliationCaseRecord>(sql,this.requireOrganization({organizationId:context.tenantId}),context.workspaceId??null,...(provider?[provider]:[]));
  }
  async listEvents(context:RequestContext,caseId:EntityId):Promise<readonly ReconciliationEventRecord[]>{
    const c=await this.get(context,caseId); if(!c) throw new DatabaseError("Reconciliation case not found");
    return this.database.all<ReconciliationEventRecord>("SELECT id,case_id AS caseId,organization_id AS organizationId,event_type AS eventType,from_status AS fromStatus,to_status AS toStatus,actor_reference AS actorReference,details_json AS details,occurred_at AS occurredAt,correlation_id AS correlationId,created_at AS createdAt FROM billing_reconciliation_case_events WHERE case_id=? AND organization_id=? ORDER BY occurred_at ASC,id ASC",caseId,this.requireOrganization({organizationId:context.tenantId}));
  }
  private async transition(context:RequestContext,id:EntityId,status:ReconciliationStatus,resolutionCode:string,details:Readonly<Record<string,unknown>>|undefined,occurredAt:string,now:string){
    const c=await this.get(context,id); if(!c) throw new DatabaseError("Reconciliation case not found");
    if(c.status==="resolved"||c.status==="ignored") throw new DatabaseError("Closed reconciliation case cannot transition");
    if(status==="investigating"&&c.status!=="open") throw new DatabaseError("Only open reconciliation cases can be investigated");
    const org=this.requireOrganization({organizationId:context.tenantId});
    await this.database.transaction([
      {sql:"UPDATE billing_reconciliation_cases SET status=?,resolution_code=?,resolved_by=?,resolved_at=?,updated_at=? WHERE id=? AND organization_id=? AND status IN ('open','investigating')",params:[status,status==="resolved"||status==="ignored"?resolutionCode:null,status==="resolved"||status==="ignored"?(context.actorId??null):null,status==="resolved"||status==="ignored"?occurredAt:null,now,id,org]},
      {sql:"INSERT INTO billing_reconciliation_case_events (id,case_id,organization_id,event_type,from_status,to_status,actor_reference,details_json,occurred_at,correlation_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",params:[id+":"+status+":"+occurredAt,id,org,status,c.status,status,context.actorId??null,details?JSON.stringify(details):null,occurredAt,c.correlationId??("reconciliation:"+id),now]}
    ]);
    return (await this.get(context,id))!;
  }
  private async appendEvent(context:RequestContext,caseId:EntityId,eventType:ReconciliationEventType,fromStatus:string|null,toStatus:string|null,details:unknown,occurredAt:string,correlationId:string,now:string){
    await this.database.run("INSERT OR IGNORE INTO billing_reconciliation_case_events (id,case_id,organization_id,event_type,from_status,to_status,actor_reference,details_json,occurred_at,correlation_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",caseId+":"+eventType+":"+occurredAt,caseId,this.requireOrganization({organizationId:context.tenantId}),eventType,fromStatus,toStatus,context.actorId??null,details?JSON.stringify(details):null,occurredAt,correlationId,now);
  }
  private async getByIdempotency(context:RequestContext,key:string){return this.database.first<ReconciliationCaseRecord>(this.select()+" WHERE organization_id=? AND idempotency_key=? LIMIT 1",this.requireOrganization({organizationId:context.tenantId}),key.trim());}
  private select(){return "SELECT id,organization_id AS organizationId,workspace_id AS workspaceId,business_id AS businessId,provider,reference_type AS referenceType,external_reference AS externalReference,local_reference AS localReference,status,category,details_json AS details,expected_amount_minor AS expectedAmountMinor,observed_amount_minor AS observedAmountMinor,currency,correlation_id AS correlationId,idempotency_key AS idempotencyKey,resolution_code AS resolutionCode,resolved_by AS resolvedBy,opened_at AS openedAt,resolved_at AS resolvedAt,created_at AS createdAt,updated_at AS updatedAt FROM billing_reconciliation_cases";}
}
function normalizeCurrency(value:string){const v=value.trim().toUpperCase();if(!/^[A-Z]{3}$/.test(v))throw new DatabaseError("Reconciliation currency must be a 3-letter ISO currency code");return v;}
