import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type DemandRequestStatus = "created"|"understanding"|"ready"|"matched"|"acted"|"closed"|"cancelled";
export type DemandProfileStatus = "draft"|"validated"|"active"|"retired";
export type MatchRequestStatus = "created"|"retrieving"|"ranking"|"decided"|"connected"|"expired"|"cancelled";
export type CandidateEligibility = "unknown"|"eligible"|"ineligible"|"blocked";
export type MatchDecision = "selected"|"rejected"|"deferred"|"excluded";

export interface DemandRequestRecord {
  readonly id: EntityId; readonly organizationId: EntityId; readonly workspaceId: EntityId|null;
  readonly customerId: EntityId|null; readonly sourceChannel: string; readonly status: DemandRequestStatus;
  readonly rawInputReference: string|null; readonly locale: string|null; readonly normalizedDemand: Readonly<Record<string,unknown>>|null;
  readonly confidence: number|null; readonly createdAt:string; readonly updatedAt:string;
}

export interface DemandProfileRecord {
  readonly id:EntityId; readonly demandRequestId:EntityId; readonly version:number;
  readonly profile:Readonly<Record<string,unknown>>; readonly confidence:number|null; readonly provenance:unknown; 
  readonly status:DemandProfileStatus; readonly createdAt:string; readonly updatedAt:string;
}

export interface MatchRequestRecord {
  readonly id:EntityId; readonly demandRequestId:EntityId; readonly organizationId:EntityId;
  readonly workspaceId:EntityId|null; readonly algorithmVersion:string; readonly policyVersion:string;
  readonly status:MatchRequestStatus; readonly requestedAt:string; readonly completedAt:string|null;
  readonly createdAt:string; readonly updatedAt:string;
}

export interface MatchCandidateRecord {
  readonly id:EntityId; readonly matchRequestId:EntityId; readonly businessId:EntityId|null; readonly offeringId:EntityId|null;
  readonly retrievalSource:string; readonly retrievalScore:number|null; readonly rankingScore:number|null;
  readonly rankPosition:number|null; readonly eligibilityStatus:CandidateEligibility; readonly reasons:unknown; readonly featureSnapshot:unknown;
  readonly createdAt:string;
}

export class MatchingRepository extends Repository {
  constructor(database:D1Database){super(database);}

  async createDemandRequest(context:RequestContext,input:{
    readonly id:EntityId; readonly customerId?:EntityId; readonly sourceChannel:string;
    readonly rawInputReference?:string; readonly locale?:string; readonly now:string;
  }):Promise<DemandRequestRecord>{
    const organizationId=this.requireOrganization({organizationId:context.tenantId});
    await this.database.run(
      "INSERT INTO demand_requests (id,organization_id,workspace_id,customer_id,source_channel,status,raw_input_reference,locale,created_at,updated_at) VALUES (?,?,?,?,?,'created',?,?,?,?)",
      input.id,organizationId,context.workspaceId??null,input.customerId??null,input.sourceChannel.trim(),
      input.rawInputReference??null,input.locale??null,input.now,input.now);
    return this.getDemandRequest(context,input.id);
  }

  async getDemandRequest(context:RequestContext,id:EntityId):Promise<DemandRequestRecord>{
    const row=await this.database.first<DemandRequestRow>(
      "SELECT id,organization_id AS organizationId,workspace_id AS workspaceId,customer_id AS customerId,source_channel AS sourceChannel,status,raw_input_reference AS rawInputReference,locale,normalized_demand_json AS normalizedDemandJson,confidence,created_at AS createdAt,updated_at AS updatedAt FROM demand_requests WHERE id=? AND organization_id=? AND (workspace_id IS NULL OR workspace_id=?) LIMIT 1",
      id,this.requireOrganization({organizationId:context.tenantId}),context.workspaceId??null);
    if(!row)throw new DatabaseError("Demand request not found");
    return {...row,normalizedDemand:parseObject(row.normalizedDemandJson)};
  }

  async setDemandUnderstanding(context:RequestContext,id:EntityId,input:{
    readonly normalizedDemand:Readonly<Record<string,unknown>>; readonly confidence?:number; readonly status?:DemandRequestStatus; readonly now:string;
  }):Promise<DemandRequestRecord>{
    await this.getDemandRequest(context,id);
    if(input.confidence!==undefined&&(input.confidence<0||input.confidence>1))throw new DatabaseError("Demand confidence must be between 0 and 1");
    await this.database.run(
      "UPDATE demand_requests SET normalized_demand_json=?,confidence=?,status=?,updated_at=? WHERE id=?",
      JSON.stringify(input.normalizedDemand),input.confidence??null,input.status??"ready",input.now,id);
    return this.getDemandRequest(context,id);
  }

  async createDemandProfile(context:RequestContext,input:{
    readonly id:EntityId; readonly demandRequestId:EntityId; readonly version:number;
    readonly profile:Readonly<Record<string,unknown>>; readonly confidence?:number; readonly provenance?:unknown;
    readonly status?:DemandProfileStatus; readonly now:string;
  }):Promise<DemandProfileRecord>{
    await this.getDemandRequest(context,input.demandRequestId);
    if(input.confidence!==undefined&&(input.confidence<0||input.confidence>1))throw new DatabaseError("Demand profile confidence must be between 0 and 1");
    await this.database.run(
      "INSERT INTO demand_profiles (id,demand_request_id,version,profile_json,confidence,provenance_json,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?, ?,?)",
      input.id,input.demandRequestId,input.version,JSON.stringify(input.profile),input.confidence??null,
      input.provenance?JSON.stringify(input.provenance):null,input.status??"active",input.now,input.now);
    return this.getDemandProfile(context,input.id);
  }

  async getDemandProfile(context:RequestContext,id:EntityId):Promise<DemandProfileRecord>{
    const row=await this.database.first<DemandProfileRow>(
      "SELECT p.id,p.demand_request_id AS demandRequestId,p.version,p.profile_json AS profileJson,p.confidence,p.provenance_json AS provenanceJson,p.status,p.created_at AS createdAt,p.updated_at AS updatedAt FROM demand_profiles p INNER JOIN demand_requests d ON d.id=p.demand_request_id WHERE p.id=? AND d.organization_id=? AND (d.workspace_id IS NULL OR d.workspace_id=?) LIMIT 1",
      id,this.requireOrganization({organizationId:context.tenantId}),context.workspaceId??null);
    if(!row)throw new DatabaseError("Demand profile not found");
    return {...row,profile:parseObject(row.profileJson)??{},provenance:parseJson(row.provenanceJson)};
  }

  async createMatchRequest(context:RequestContext,input:{
    readonly id:EntityId; readonly demandRequestId:EntityId; readonly algorithmVersion:string; readonly policyVersion:string; readonly now:string;
  }):Promise<MatchRequestRecord>{
    const demand=await this.getDemandRequest(context,input.demandRequestId);
    const organizationId=this.requireOrganization({organizationId:context.tenantId});
    await this.database.run(
      "INSERT INTO match_requests (id,demand_request_id,organization_id,workspace_id,algorithm_version,policy_version,status,requested_at,created_at,updated_at) VALUES (?,?,?,?,?,?, 'created',?,?,?)",
      input.id,input.demandRequestId,organizationId,demand.workspaceId,input.algorithmVersion.trim(),input.policyVersion.trim(),input.now,input.now,input.now);
    return this.getMatchRequest(context,input.id);
  }

  async getMatchRequest(context:RequestContext,id:EntityId):Promise<MatchRequestRecord>{
    return this.database.first<MatchRequestRecord>(
      "SELECT id,demand_request_id AS demandRequestId,organization_id AS organizationId,workspace_id AS workspaceId,algorithm_version AS algorithmVersion,policy_version AS policyVersion,status,requested_at AS requestedAt,completed_at AS completedAt,created_at AS createdAt,updated_at AS updatedAt FROM match_requests WHERE id=? AND organization_id=? AND (workspace_id IS NULL OR workspace_id=?) LIMIT 1",
      id,this.requireOrganization({organizationId:context.tenantId}),context.workspaceId??null
    ).then(row=>{if(!row)throw new DatabaseError("Match request not found");return row;});
  }

  async setMatchStatus(
    context: RequestContext,
    id: EntityId,
    status: MatchRequestStatus,
    now: string,
  ): Promise<MatchRequestRecord> {
    const current = await this.getMatchRequest(context, id);
    if (current.status === status) return current;
    if (isTerminalMatchStatus(current.status)) {
      throw new DatabaseError("Terminal MatchRequest cannot be reopened");
    }
    if (!isAllowedMatchTransition(current.status, status)) {
      throw new DatabaseError(`Invalid MatchRequest transition: ${current.status} -> ${status}`);
    }
    const completedAt = status === "decided" || status === "connected" || status === "expired" || status === "cancelled"
      ? now
      : current.completedAt;
    await this.database.run(
      "UPDATE match_requests SET status = ?, completed_at = ?, updated_at = ? WHERE id = ? AND organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?)",
      status,
      completedAt,
      now,
      id,
      current.organizationId,
      context.workspaceId ?? null,
    );
    return this.getMatchRequest(context, id);
  }

  async addCandidate(context:RequestContext,input:{
    readonly id:EntityId; readonly matchRequestId:EntityId; readonly businessId?:EntityId;
    readonly offeringId?:EntityId; readonly retrievalSource:string; readonly retrievalScore?:number; readonly rankingScore?:number;
    readonly rankPosition?:number; readonly eligibilityStatus?:CandidateEligibility; readonly reasons?:unknown; readonly featureSnapshot?:unknown; readonly now:string;
  }):Promise<MatchCandidateRecord>{
    await this.getMatchRequest(context,input.matchRequestId);
    if((input.businessId?1:0)+(input.offeringId?1:0)!==1)throw new DatabaseError("A match candidate must target exactly one business or offering");
    await this.database.run(
      "INSERT INTO match_candidates (id,match_request_id,business_id,offering_id,retrieval_source,retrieval_score,ranking_score,rank_position,eligibility_status,reasons_json,feature_snapshot_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      input.id,input.matchRequestId,input.businessId??null,input.offeringId??null,input.retrievalSource.trim(),
      input.retrievalScore??null,input.rankingScore??null,input.rankPosition??null,input.eligibilityStatus??"unknown",
      input.reasons?JSON.stringify(input.reasons):null,input.featureSnapshot?JSON.stringify(input.featureSnapshot):null,input.now);
    return this.getCandidate(context,input.id);
  }

  async getCandidate(context:RequestContext,id:EntityId):Promise<MatchCandidateRecord>{
    const row=await this.database.first<MatchCandidateRow>(
      "SELECT c.id,c.match_request_id AS matchRequestId,c.business_id AS businessId,c.offering_id AS offeringId,c.retrieval_source AS retrievalSource,c.retrieval_score AS retrievalScore,c.ranking_score AS rankingScore,c.rank_position AS rankPosition,c.eligibility_status AS eligibilityStatus,c.reasons_json AS reasonsJson,c.feature_snapshot_json AS featureSnapshotJson,c.created_at AS createdAt FROM match_candidates c INNER JOIN match_requests mr ON mr.id=c.match_request_id WHERE c.id=? AND mr.organization_id=? AND (mr.workspace_id IS NULL OR mr.workspace_id=?) LIMIT 1",
      id,this.requireOrganization({organizationId:context.tenantId}),context.workspaceId??null);
    if(!row)throw new DatabaseError("Match candidate not found");
    return {...row,reasons:parseJson(row.reasonsJson),featureSnapshot:parseJson(row.featureSnapshotJson)};
  }

  async hasSelectedDecision(context:RequestContext,matchRequestId:EntityId,candidateId:EntityId):Promise<boolean>{
    await this.getMatchRequest(context,matchRequestId);
    const row=await this.database.first<{decision: MatchDecision}>(
      "SELECT md.decision FROM match_decisions md WHERE md.match_request_id=? AND md.candidate_id=? ORDER BY md.decided_at DESC, md.id DESC LIMIT 1",
      matchRequestId,candidateId
    );
    return row?.decision === "selected";
  }

  async resolveOfferingBusiness(context:RequestContext,offeringId:EntityId):Promise<EntityId|null>{
    const organizationId=this.requireOrganization({organizationId:context.tenantId});
    const workspaceId=this.requireWorkspace({workspaceId:context.workspaceId});
    const row=await this.database.first<{businessId:EntityId}>(
      "SELECT o.business_id AS businessId FROM offerings o INNER JOIN businesses b ON b.id=o.business_id WHERE o.id=? AND b.organization_id=? AND b.workspace_id=? LIMIT 1",
      offeringId,organizationId,workspaceId
    );
    return row?.businessId ?? null;
  }

  async decide(context:RequestContext,input:{
    readonly id:EntityId; readonly matchRequestId:EntityId; readonly candidateId:EntityId; readonly decision:MatchDecision;
    readonly reasonCode?:string; readonly decisionSource:string; readonly policyVersion:string; readonly now:string;
  }):Promise<void>{
    const request=await this.getMatchRequest(context,input.matchRequestId);
    const candidate=await this.getCandidate(context,input.candidateId);
    if(candidate.matchRequestId!==request.id)throw new DatabaseError("Candidate does not belong to match request");
    await this.database.run(
      "INSERT INTO match_decisions (id,match_request_id,candidate_id,decision,reason_code,decision_source,policy_version,actor_reference,decided_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      input.id,input.matchRequestId,input.candidateId,input.decision,input.reasonCode??null,input.decisionSource.trim(),input.policyVersion.trim(),context.actorId??"system",input.now,input.now);
  }

  async listCandidates(context:RequestContext,matchRequestId:EntityId,limit=100):Promise<readonly MatchCandidateRecord[]>{
    await this.getMatchRequest(context,matchRequestId);
    const safe=Math.min(Math.max(Math.trunc(limit),1),500);
    const rows=await this.database.all<MatchCandidateRow>(
      "SELECT c.id,c.match_request_id AS matchRequestId,c.business_id AS businessId,c.offering_id AS offeringId,c.retrieval_source AS retrievalSource,c.retrieval_score AS retrievalScore,c.ranking_score AS rankingScore,c.rank_position AS rankPosition,c.eligibility_status AS eligibilityStatus,c.reasons_json AS reasonsJson,c.feature_snapshot_json AS featureSnapshotJson,c.created_at AS createdAt FROM match_candidates c WHERE c.match_request_id=? ORDER BY c.rank_position ASC, c.ranking_score DESC, c.id ASC LIMIT ?",
      matchRequestId,safe);
    return rows.map(row=>({...row,reasons:parseJson(row.reasonsJson),featureSnapshot:parseJson(row.featureSnapshotJson)}));
  }
}

interface DemandRequestRow extends Omit<DemandRequestRecord,"normalizedDemand">{readonly normalizedDemandJson:string|null;}
interface DemandProfileRow extends Omit<DemandProfileRecord,"profile"|"provenance">{readonly profileJson:string;readonly provenanceJson:string|null;}
interface MatchCandidateRow extends Omit<MatchCandidateRecord,"reasons"|"featureSnapshot">{readonly reasonsJson:string|null;readonly featureSnapshotJson:string|null;}
function isTerminalMatchStatus(status:MatchRequestStatus):boolean {
  return status === "connected" || status === "expired" || status === "cancelled";
}

function isAllowedMatchTransition(from:MatchRequestStatus,to:MatchRequestStatus):boolean {
  const transitions: Record<MatchRequestStatus, readonly MatchRequestStatus[]> = {
    created: ["retrieving","ranking","decided","cancelled","expired"],
    retrieving: ["ranking","decided","cancelled","expired"],
    ranking: ["decided","cancelled","expired"],
    decided: ["connected","cancelled","expired"],
    connected: [],
    expired: [],
    cancelled: [],
  };
  return transitions[from].includes(to);
}

function parseJson(v:string|null):unknown{if(!v)return null;try{return JSON.parse(v);}catch{throw new DatabaseError("Stored Matching JSON is invalid");}}
function parseObject(v:string|null):Readonly<Record<string,unknown>>|null{const p=parseJson(v);return p&&typeof p==="object"&&!Array.isArray(p)?p as Readonly<Record<string,unknown>>:null;}
