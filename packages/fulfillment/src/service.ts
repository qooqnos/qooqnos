import type { EntityId, RequestContext } from "@qooqnos/core";
import type { AuthorizationService } from "@qooqnos/runtime";
import { FulfillmentRepository, type FulfillmentOrderStatus } from "./repository";

export interface FulfillmentServiceOptions {
  readonly repository:FulfillmentRepository; readonly authorization:AuthorizationService; readonly id:()=>EntityId; readonly now:()=>string;
}

export class FulfillmentService {
  constructor(private readonly options:FulfillmentServiceOptions){}
  async create(context:RequestContext,input:{readonly sourceType:"commerce_order"|"booking";readonly sourceId:EntityId;readonly businessId:EntityId;readonly fulfillmentType:"physical"|"digital"|"service"|"hybrid"}){
    await this.options.authorization.assert({context,permission:"fulfillment.create",requireAuthentication:true,requireWorkspace:true});
    return this.options.repository.createFromCommitment(context,{...input,id:this.options.id(),now:this.options.now()});
  }
  async setStatus(context:RequestContext,id:EntityId,status:FulfillmentOrderStatus,reasonCode?:string){
    await this.options.authorization.assert({context,permission:"fulfillment.update_status",requireAuthentication:true,requireWorkspace:true});
    return this.options.repository.setStatus(context,id,status,this.options.now(),reasonCode);
  }
  async recordTracking(context:RequestContext,input:{readonly shipmentId:EntityId;readonly eventType:string;readonly occurredAt:string;readonly source:string;readonly externalEventId?:string;readonly locationRef?:string;readonly normalizedStatus:string;readonly providerPayloadRef?:string;readonly eventVersion?:number;readonly deduplicationKey:string}){
    await this.options.authorization.assert({context,permission:"fulfillment.update_status",requireAuthentication:true,requireWorkspace:true});
    return this.options.repository.recordTrackingEvent(context,{...input,id:this.options.id(),now:this.options.now()});
  }
  async createShipment(context:RequestContext,input:{readonly fulfillmentItemId:EntityId;readonly carrierRef?:string;readonly serviceLevel?:string;readonly trackingReference?:string;readonly originRef?:string;readonly destinationRef?:string}){
    await this.options.authorization.assert({context,permission:"fulfillment.plan",requireAuthentication:true,requireWorkspace:true});
    return this.options.repository.createShipment(context,{...input,id:this.options.id(),now:this.options.now()});
  }
  async createServiceDelivery(context:RequestContext,input:{
    readonly fulfillmentItemId:EntityId;readonly bookingRef:EntityId;readonly providerRef?:string;readonly serviceLocationRef?:string;
    readonly scheduledFrom?:string;readonly scheduledTo?:string;
  }){
    await this.options.authorization.assert({context,permission:"fulfillment.plan",requireAuthentication:true,requireWorkspace:true});
    return this.options.repository.createServiceDelivery(context,{...input,id:this.options.id(),now:this.options.now()});
  }

  async completeService(context:RequestContext,input:{readonly serviceDeliveryId:EntityId;readonly completedByActorRef:string;readonly completedAt:string;readonly confirmationType:string;readonly customerConfirmationRef?:string;readonly providerConfirmationRef?:string;readonly evidenceRef?:string}){
    await this.options.authorization.assert({context,permission:"fulfillment.confirm_service_completion",requireAuthentication:true,requireWorkspace:true});
    return this.options.repository.completeService(context,{...input,id:this.options.id(),now:this.options.now()});
  }
}

export const FULFILLMENT_PERMISSIONS=[
  "fulfillment.create","fulfillment.get","fulfillment.plan","fulfillment.assign","fulfillment.start","fulfillment.update_status",
  "fulfillment.confirm_delivery","fulfillment.confirm_service_completion","fulfillment.create_exception","fulfillment.resolve_exception",
  "fulfillment.cancel","fulfillment.get_tracking"
] as const;
