import type { EntityId, RequestContext } from "@qooqnos/core";
import { rankEligibleCandidates, type DiscoveryCandidate } from "@qooqnos/core";
import { DiscoveryRepository } from "@qooqnos/discovery";
import type { AuthorizationService } from "@qooqnos/runtime";
import { MatchingRepository } from "./repository";
import { MatchingLearningRepository, type MatchLearningSignalType } from "./learning-repository";
import { CustomerRelationshipRepository } from "@qooqnos/database";

export interface MatchingServiceOptions {
  readonly repository:MatchingRepository; readonly discovery:DiscoveryRepository;
  readonly relationships?:CustomerRelationshipRepository; readonly learning?:MatchingLearningRepository;
  readonly authorization:AuthorizationService; readonly id:()=>EntityId; readonly now:()=>string;
}

export class MatchingService {
  constructor(private readonly options:MatchingServiceOptions){}

  async createDemand(context:RequestContext,input:{readonly customerId?:EntityId;readonly sourceChannel:string;readonly rawInputReference?:string;readonly locale?:string}){
    await this.options.authorization.assert({context,permission:"matching.demand.create",requireAuthentication:true,requireWorkspace:false});
    return this.options.repository.createDemandRequest(context,{...input,id:this.options.id(),now:this.options.now()});
  }

  async updateUnderstanding(context:RequestContext,input:{readonly demandRequestId:EntityId;readonly normalizedDemand:Readonly<Record<string,unknown>>;readonly confidence?:number;readonly status?:"created"|"understanding"|"ready"|"matched"|"acted"|"closed"|"cancelled"}){
    await this.options.authorization.assert({context,permission:"matching.demand.manage",requireAuthentication:true,requireWorkspace:false});
    return this.options.repository.setDemandUnderstanding(context,input.demandRequestId,{...input,now:this.options.now()});
  }

  async createProfile(context:RequestContext,input:{readonly demandRequestId:EntityId;readonly version:number;readonly profile:Readonly<Record<string,unknown>>;readonly confidence?:number;readonly provenance?:unknown;readonly status?:"draft"|"validated"|"active"|"retired"}){
    await this.options.authorization.assert({context,permission:"matching.demand.manage",requireAuthentication:true,requireWorkspace:false});
    return this.options.repository.createDemandProfile(context,{...input,id:this.options.id(),now:this.options.now()});
  }

  async createMatchRequest(context:RequestContext,input:{readonly demandRequestId:EntityId;readonly algorithmVersion:string;readonly policyVersion:string}){
    await this.options.authorization.assert({context,permission:"matching.request.create",requireAuthentication:true,requireWorkspace:false});
    return this.options.repository.createMatchRequest(context,{...input,id:this.options.id(),now:this.options.now()});
  }

  async addCandidate(context:RequestContext,input:{readonly matchRequestId:EntityId;readonly businessId?:EntityId;readonly offeringId?:EntityId;readonly retrievalSource:string;readonly retrievalScore?:number;readonly rankingScore?:number;readonly rankPosition?:number;readonly eligibilityStatus?:"unknown"|"eligible"|"ineligible"|"blocked";readonly reasons?:unknown;readonly featureSnapshot?:unknown}){
    await this.options.authorization.assert({context,permission:"matching.candidate.manage",requireAuthentication:true,requireWorkspace:false});
    return this.options.repository.addCandidate(context,{...input,id:this.options.id(),now:this.options.now()});
  }

  async retrieveAndRank(context:RequestContext,input:{readonly matchRequestId:EntityId;readonly query:string;readonly limit?:number}){
    await this.options.authorization.assert({context,permission:"matching.request.execute",requireAuthentication:true,requireWorkspace:true});
    const request=await this.options.repository.getMatchRequest(context,input.matchRequestId);
    if(!context.workspaceId||request.workspaceId!==context.workspaceId)throw new Error("Matching retrieval requires the request workspace scope");
    const existing=await this.options.repository.listCandidates(context,request.id,input.limit??50);
    if(existing.length>0)return {request:await this.options.repository.setMatchStatus(context,request.id,"decided",this.options.now()),candidates:existing};
    await this.options.repository.setMatchStatus(context,request.id,"retrieving",this.options.now());
    const documents=await this.options.discovery.search({context,query:input.query,limit:Math.min(Math.max(input.limit??20,1),50)});
    const discoveryCandidates:DiscoveryCandidate[]=[];
    for(const [index,document] of documents.entries()){
      if(document.sourceType!=="business")continue;
      discoveryCandidates.push({id:document.sourceId,resourceType:"business",payload:document,eligibility:{eligible:document.eligibility==="eligible",reasons:document.eligibility==="eligible"?[]:["discovery_projection_ineligible"],policyVersion:"discovery.lexical-v1"},signals:{retrievalScore:1/(index+1),freshness:document.updatedAt===document.createdAt?0.1:0}});
    }
    const ranked=rankEligibleCandidates(discoveryCandidates,request.algorithmVersion);
    await this.options.repository.setMatchStatus(context,request.id,"ranking",this.options.now());
    const created=[];
    for(const [index,candidate] of ranked.candidates.entries())created.push(await this.options.repository.addCandidate(context,{id:this.options.id(),matchRequestId:request.id,businessId:candidate.id,retrievalSource:"discovery.lexical",retrievalScore:candidate.signals.retrievalScore,rankingScore:candidate.score,rankPosition:index+1,eligibilityStatus:"eligible",reasons:candidate.eligibility.reasons,featureSnapshot:{...candidate.signals,rankingVersion:ranked.rankingVersion,sourceDocumentId:candidate.id},now:this.options.now()}));
    return {request:await this.options.repository.setMatchStatus(context,request.id,"decided",this.options.now()),candidates:created};
  }

  async connect(context:RequestContext,input:{readonly matchRequestId:EntityId;readonly candidateId:EntityId;readonly relationshipType?:string}){
    await this.options.authorization.assert({context,permission:"matching.request.connect",requireAuthentication:true,requireWorkspace:true});
    if(!this.options.relationships)throw new Error("Matching connection relationship capability is not configured");
    const request=await this.options.repository.getMatchRequest(context,input.matchRequestId);
    const demand=await this.options.repository.getDemandRequest(context,request.demandRequestId);
    if(!demand.customerId)throw new Error("Matching connection requires a customer");
    const candidate=await this.options.repository.getCandidate(context,input.candidateId);
    if(candidate.matchRequestId!==request.id)throw new Error("Candidate does not belong to match request");
    if(candidate.eligibilityStatus!=="eligible")throw new Error("Only eligible candidates can be connected");
    if(!(await this.options.repository.hasSelectedDecision(context,request.id,candidate.id)))throw new Error("Only selected match candidates can be connected");
    let businessId=candidate.businessId;
    if(!businessId&&candidate.offeringId)businessId=await this.options.repository.resolveOfferingBusiness(context,candidate.offeringId);
    if(!businessId)throw new Error("Match candidate does not resolve to a business");
    const now=this.options.now(),relationshipType=input.relationshipType?.trim()||"match";
    const existingRelationship=await this.options.relationships.getByCustomerBusinessType(context,demand.customerId,businessId,relationshipType);
    if(existingRelationship){const updatedRequest=request.status==="connected"?request:await this.options.repository.setMatchStatus(context,request.id,"connected",now);return {request:updatedRequest,relationship:existingRelationship,replayed:true};}
    const relationship=await this.options.relationships.create(context,{id:this.options.id(),customerId:demand.customerId,businessId,relationshipType,source:"matching",firstInteractionAt:now,lastInteractionAt:now,now});
    const updatedRequest=await this.options.repository.setMatchStatus(context,request.id,"connected",now);
    return {request:updatedRequest,relationship,replayed:false};
  }

  async decide(context:RequestContext,input:{readonly matchRequestId:EntityId;readonly candidateId:EntityId;readonly decision:"selected"|"rejected"|"deferred"|"excluded";readonly reasonCode?:string;readonly decisionSource:string;readonly policyVersion:string}){
    await this.options.authorization.assert({context,permission:"matching.decision.manage",requireAuthentication:true,requireWorkspace:false});
    return this.options.repository.decide(context,{...input,id:this.options.id(),now:this.options.now()});
  }

  async recordLearningSignal(context:RequestContext,input:{readonly matchRequestId:EntityId;readonly candidateId?:EntityId;readonly signalType:MatchLearningSignalType;readonly signalValue?:number;readonly source:string;readonly actorReference?:string;readonly metadata?:unknown;readonly occurredAt?:string}){
    await this.options.authorization.assert({context,permission:"matching.learning.record",requireAuthentication:true,requireWorkspace:false});
    if(!this.options.learning)throw new Error("Matching learning capability is not configured");
    const now=this.options.now();
    return this.options.learning.record(context,{...input,id:this.options.id(),occurredAt:input.occurredAt??now,now});
  }
}

export const MATCHING_PERMISSIONS=[
  "matching.demand.read","matching.demand.create","matching.demand.manage",
  "matching.request.read","matching.request.create","matching.request.execute","matching.request.connect",
  "matching.candidate.read","matching.candidate.manage","matching.decision.read","matching.decision.manage",
  "matching.learning.record"
] as const;
