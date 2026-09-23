import type { EntityId, RequestContext } from "@qooqnos/core";
import type { AuthorizationService } from "@qooqnos/runtime";
import { FulfillmentRepository, type FulfillmentOrderStatus, type ShipmentStatus } from "./repository";

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

  async createPlan(context:RequestContext,input:{
    readonly fulfillmentId:EntityId;readonly version:number;readonly strategy:string;readonly createdBy:string;readonly supersedesPlanId?:EntityId;
  }){
    await this.options.authorization.assert({context,permission:"fulfillment.plan",requireAuthentication:true,requireWorkspace:true});
    return this.options.repository.createPlan(context,{...input,id:this.options.id(),now:this.options.now()});
  }

  async activatePlan(context:RequestContext,planId:EntityId){
    await this.options.authorization.assert({context,permission:"fulfillment.plan",requireAuthentication:true,requireWorkspace:true});
    return this.options.repository.activatePlan(context,planId,this.options.now());
  }

  async createTask(context:RequestContext,input:{readonly fulfillmentId:EntityId;readonly fulfillmentItemId?:EntityId;readonly taskType:string;readonly priority?:number;readonly scheduledFrom?:string;readonly scheduledTo?:string}){
    await this.options.authorization.assert({context,permission:"fulfillment.plan",requireAuthentication:true,requireWorkspace:true});
    return this.options.repository.createTask(context,{...input,id:this.options.id(),now:this.options.now()});
  }

  async assignTask(context:RequestContext,input:{readonly fulfillmentTaskId:EntityId;readonly actorRef:string;readonly actorType:string;readonly assignedBy:string}){
    await this.options.authorization.assert({context,permission:"fulfillment.assign",requireAuthentication:true,requireWorkspace:true});
    return this.options.repository.assignTask(context,{...input,id:this.options.id(),now:this.options.now()});
  }

  async setTaskStatus(context:RequestContext,input:{readonly fulfillmentTaskId:EntityId;readonly status:"pending"|"ready"|"assigned"|"in_progress"|"completed"|"failed"|"cancelled"|"blocked";readonly reasonCode?:string}){
    await this.options.authorization.assert({context,permission:"fulfillment.start",requireAuthentication:true,requireWorkspace:true});
    return this.options.repository.setTaskStatus(context,input.fulfillmentTaskId,input.status,this.options.now(),input.reasonCode);
  }

  async setShipmentStatus(context:RequestContext,input:{readonly shipmentId:EntityId;readonly status:ShipmentStatus;readonly proofOfDeliveryRef?:string;readonly reasonCode?:string}){
    const permission=input.status==="delivered"?"fulfillment.confirm_delivery":"fulfillment.update_status";
    await this.options.authorization.assert({context,permission,requireAuthentication:true,requireWorkspace:true});
    return this.options.repository.setShipmentStatus(context,{...input,now:this.options.now()});
  }

  async recordDeliveryAttempt(context:RequestContext,input:{readonly shipmentId:EntityId;readonly attemptNumber:number;readonly attemptedAt:string;readonly actorRef?:string;readonly status:string;readonly failureReasonCode?:string;readonly evidenceRef?:string;readonly nextActionRef?:string}){
    await this.options.authorization.assert({context,permission:"fulfillment.update_status",requireAuthentication:true,requireWorkspace:true});
    return this.options.repository.recordDeliveryAttempt(context,{...input,id:this.options.id(),now:this.options.now()});
  }

  async createDigitalDelivery(context:RequestContext,input:{readonly fulfillmentItemId:EntityId;readonly entitlementRef?:string;readonly deliveryChannel:string;readonly recipientScopeRef:string;readonly issuedAt:string;readonly expiresAt?:string;readonly deliveryStatus:string;readonly evidenceRef?:string}){
    await this.options.authorization.assert({context,permission:"fulfillment.plan",requireAuthentication:true,requireWorkspace:true});
    return this.options.repository.createDigitalDelivery(context,{...input,id:this.options.id(),now:this.options.now()});
  }

  async createException(context:RequestContext,input:{readonly fulfillmentId:EntityId;readonly fulfillmentItemId?:EntityId;readonly exceptionType:string;readonly severity:"low"|"medium"|"high"|"critical";readonly reasonCode:string;readonly detectedAt:string;readonly detectedBy:string}){
    await this.options.authorization.assert({context,permission:"fulfillment.create_exception",requireAuthentication:true,requireWorkspace:true});
    return this.options.repository.createException(context,{...input,id:this.options.id(),now:this.options.now()});
  }

  async resolveException(context:RequestContext,input:{readonly id:EntityId;readonly resolutionCode:string;readonly resolvedBy:string;readonly reworkTaskRef?:string}){
    await this.options.authorization.assert({context,permission:"fulfillment.resolve_exception",requireAuthentication:true,requireWorkspace:true});
    return this.options.repository.resolveException(context,{...input,now:this.options.now()});
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
