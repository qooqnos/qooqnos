import type { EntityId, RequestContext } from "@qooqnos/core";
import type { AuthorizationService } from "@qooqnos/runtime";
import { PrivacyRepository, type PrivacyRequestStatus, type PrivacySubjectType } from "./repository";

export interface PrivacyServiceOptions {
  readonly repository: PrivacyRepository;
  readonly authorization: AuthorizationService;
  readonly id:()=>EntityId;
  readonly now:()=>string;
}

export class PrivacyService {
  constructor(private readonly options:PrivacyServiceOptions){}
  async grantConsent(context:RequestContext,input:{readonly subjectType:PrivacySubjectType;readonly subjectId:EntityId;readonly purpose:string;readonly consentVersion:string;readonly source:string;readonly evidenceReference?:string;readonly grantedAt?:string;readonly expiresAt?:string}){
    await this.options.authorization.assert({context,permission:"privacy.consent.manage",requireAuthentication:true,requireWorkspace:false});
    return this.options.repository.createConsent(context,{...input,id:this.options.id(),now:this.options.now()});
  }
  async revokeConsent(context:RequestContext,id:EntityId){
    await this.options.authorization.assert({context,permission:"privacy.consent.manage",requireAuthentication:true,requireWorkspace:false});
    return this.options.repository.revokeConsent(context,id,this.options.now(),this.options.now());
  }
  async createRequest(context:RequestContext,input:{readonly subjectType:PrivacySubjectType;readonly subjectId:EntityId;readonly requestType:"access"|"export"|"delete"|"restrict"|"correct";readonly requestedBy:string;readonly dueAt?:string}){
    await this.options.authorization.assert({context,permission:"privacy.request.manage",requireAuthentication:true,requireWorkspace:false});
    return this.options.repository.createRequest(context,{...input,id:this.options.id(),now:this.options.now()});
  }
  async transitionRequest(context:RequestContext,id:EntityId,status:PrivacyRequestStatus,details?:{resultReference?:string;rejectionReason?:string}){
    await this.options.authorization.assert({context,permission:"privacy.request.manage",requireAuthentication:true,requireWorkspace:false});
    return this.options.repository.transitionRequest(context,id,status,this.options.now(),details);
  }
}
export const PRIVACY_PERMISSIONS=[
  "privacy.consent.read","privacy.consent.manage","privacy.request.read","privacy.request.manage"
] as const;
