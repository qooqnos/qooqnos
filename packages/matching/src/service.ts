import type { EntityId, RequestContext } from "@qooqnos/core";
import type { AuthorizationService } from "@qooqnos/runtime";
import { MatchingRepository } from "./repository";

export interface MatchingServiceOptions {
  readonly repository:MatchingRepository; readonly authorization:AuthorizationService; readonly id:()=>EntityId; readonly now:()=>string;
}

export class MatchingService {
  constructor(private readonly options:MatchingServiceOptions){}

  async createDemand(context:RequestContext,input:{readonly customerId?:EntityId;readonly sourceChannel:string;readonly rawInputReference?:string;readonly locale?:string}){
    await this.options.authorization.assert({context,permission:"matching.demand.create",requireAuthentication:true,requireWorkspace:false});
    return this.options.repository.createDemandRequest(context,{...input,id:this.options.id(),now:this.options.now()});
  }

  async updateUnderstanding(context:RequestContext,input:{
    readonly demandRequestId:EntityId; readonly normalizedDemand:Readonly<Record<string,unknown>>; readonly confidence?:number;
    readonly status?: "created"|"understanding"|"ready"|"matched"|"acted"|"closed"|"cancelled";
  }){
    await this.options.authorization.assert({context,permission:"matching.demand.manage",requireAuthentication:true,requireWorkspace:false});
    return this.options.repository.setDemandUnderstanding(context,input.demandRequestId,{...input,now:this.options.now()});
  }

  async createProfile(context:RequestContext,input:{
    readonly demandRequestId:EntityId; readonly version:number; readonly profile:Readonly<Record<string,unknown>>;
    readonly confidence?:number; readonly provenance?:unknown; readonly status?:"draft"|"validated"|"active"|"retired";
  }){
    await this.options.authorization.assert({context,permission:"matching.demand.manage",requireAuthentication:true,requireWorkspace:false});
    return this.options.repository.createDemandProfile(context,{...input,id:this.options.id(),now:this.options.now()});
  }

  async createMatchRequest(context:RequestContext,input:{readonly demandRequestId:EntityId;readonly algorithmVersion:string;readonly policyVersion:string}){
    await this.options.authorization.assert({context,permission:"matching.request.create",requireAuthentication:true,requireWorkspace:false});
    return this.options.repository.createMatchRequest(context,{...input,id:this.options.id(),now:this.options.now()});
  }

  async addCandidate(context:RequestContext,input:{
    readonly matchRequestId:EntityId; readonly businessId?:EntityId; readonly offeringId?:EntityId; readonly retrievalSource:string;
    readonly retrievalScore?:number; readonly rankingScore?:number; readonly rankPosition?:number;
    readonly eligibilityStatus?:"unknown"|"eligible"|"ineligible"|"blocked"; readonly reasons?:unknown; readonly featureSnapshot?:unknown;
  }){
    await this.options.authorization.assert({context,permission:"matching.candidate.manage",requireAuthentication:true,requireWorkspace:false});
    return this.options.repository.addCandidate(context,{...input,id:this.options.id(),now:this.options.now()});
  }

  async decide(context:RequestContext,input:{
    readonly matchRequestId:EntityId;readonly candidateId:EntityId;readonly decision:"selected"|"rejected"|"deferred"|"excluded";
    readonly reasonCode?:string;readonly decisionSource:string;readonly policyVersion:string;
  }){
    await this.options.authorization.assert({context,permission:"matching.decision.manage",requireAuthentication:true,requireWorkspace:false});
    return this.options.repository.decide(context,{...input,id:this.options.id(),now:this.options.now()});
  }
}

export const MATCHING_PERMISSIONS=[
  "matching.demand.read","matching.demand.create","matching.demand.manage",
  "matching.request.read","matching.request.create","matching.candidate.read","matching.candidate.manage",
  "matching.decision.read","matching.decision.manage"
] as const;
