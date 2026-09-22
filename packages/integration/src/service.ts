import type { EntityId, RequestContext } from "@qooqnos/core";
import type { AuthorizationService } from "@qooqnos/runtime";
import { IntegrationRepository } from "./repository";

export interface IntegrationServiceOptions {
  readonly repository: IntegrationRepository; readonly authorization: AuthorizationService;
  readonly id:()=>EntityId; readonly now:()=>string;
}

export class IntegrationService {
  constructor(private readonly options:IntegrationServiceOptions){}
  async connectAccount(context:RequestContext,input:{readonly providerId:EntityId;readonly accountType:string;readonly externalAccountReference:string;readonly credentialReference?:string;readonly metadata?:Readonly<Record<string,unknown>>}){
    await this.options.authorization.assert({context,permission:"integration.account.manage",requireAuthentication:true,requireWorkspace:false});
    return this.options.repository.createAccount(context,{...input,id:this.options.id(),now:this.options.now()});
  }
  async ingestWebhook(context:RequestContext,input:{readonly integrationAccountId:EntityId;readonly externalEventId:string;readonly eventType:string;readonly signatureStatus:"verified"|"invalid"|"missing"|"not_required";readonly payloadReference?:string;readonly correlationId:string}){
    await this.options.authorization.assert({context,permission:"integration.webhook.receive",requireAuthentication:true,requireWorkspace:false});
    return this.options.repository.recordWebhook(context,{...input,id:this.options.id(),now:this.options.now()});
  }
}
export const INTEGRATION_PERMISSIONS=[
  "integration.account.read","integration.account.manage","integration.webhook.receive","integration.sync.read","integration.sync.manage","integration.external_reference.read","integration.external_reference.manage"
] as const;
