import type { EntityId, RequestContext } from "@qooqnos/core";
import type { AuthorizationService } from "@qooqnos/runtime";
import { MatchingRepository } from "./repository";

export interface MatchingServiceOptions {
  readonly repository: MatchingRepository; readonly authorization: AuthorizationService;
  readonly id:()=>EntityId; readonly now:()=>string;
}

export class MatchingService {
  constructor(private readonly options:MatchingServiceOptions){}
  async createDemand(context:RequestContext,input:{readonly customerId?:EntityId;readonly sourceChannel:string;readonly rawInputReference?:string;readonly locale?:string}){
    await this.options.authorization.assert({context,permission:"matching.demand.create",requireAuthentication:true,requireWorkspace:false});
    return this.options.repository.createDemandRequest(context,{...input,id:this.options.id(),now:this.options.now()});
  }
  async createMatchRequest(context:RequestContext,input:{readonly demandRequestId:EntityId;readonly algorithmVersion:string;readonly policyVersion:string}){
    await this.options.authorization.assert({context,permission:"matching.request.create",requireAuthentication:true,requireWorkspace:false});
    return this.options.repository.createMatchRequest(context,{...input,id:this.options.id(),now:this.options.now()});
  }
  async decide(context:RequestContext,input:{readonly matchRequestId:EntityId;readonly candidateId:EntityId;readonly decision:"selected"|"rejected"|"deferred"|"excluded";readonly reasonCode?:string;readonly decisionSource:string;readonly policyVersion:string}){
    await this.options.authorization.assert({context,permission:"matching.decision.manage",requireAuthentication:true,requireWorkspace:false});
    return this.options.repository.decide(context,{...input,id:this.options.id(),now:this.options.now()});
  }
}
export const MATCHING_PERMISSIONS=[
  "matching.demand.read","matching.demand.create","matching.demand.manage",
  "matching.request.read","matching.request.create","matching.candidate.read",
  "matching.decision.read","matching.decision.manage"
] as const;
