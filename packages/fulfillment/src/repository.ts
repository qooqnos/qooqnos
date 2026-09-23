import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type FulfillmentOrderStatus = "pending"|"planned"|"ready"|"in_progress"|"partially_completed"|"completed"|"cancelled"|"failed"|"closed";
export type FulfillmentItemStatus = "pending"|"ready"|"in_progress"|"partially_completed"|"completed"|"cancelled"|"failed"|"requires_rework";
export type ShipmentStatus = "draft"|"ready"|"dispatched"|"in_transit"|"out_for_delivery"|"delivered"|"cancelled"|"returned"|"lost"|"failed";
export type ServiceDeliveryStatus = "scheduled"|"ready"|"in_progress"|"completed"|"cancelled"|"no_show"|"failed"|"requires_rework";

export interface FulfillmentOrderRecord {
  readonly id: EntityId; readonly organizationId: EntityId; readonly workspaceId: EntityId; readonly businessId: EntityId;
  readonly sourceType: "commerce_order"|"booking"; readonly sourceId: EntityId; readonly status: FulfillmentOrderStatus;
  readonly fulfillmentType: "physical"|"digital"|"service"|"hybrid"; readonly planId: string|null;
  readonly createdAt: string; readonly updatedAt: string; readonly completedAt: string|null; readonly cancelledAt: string|null;
}

export interface FulfillmentItemRecord {
  readonly id: EntityId; readonly fulfillmentId: EntityId; readonly sourceType: string; readonly sourceId: EntityId;
  readonly sourceLineId: string|null; readonly quantity: number; readonly fulfillmentType: "physical"|"digital"|"service";
  readonly status: FulfillmentItemStatus; readonly promisedFrom: string|null; readonly promisedTo: string|null;
  readonly destinationRef: string|null; readonly serviceLocationRef: string|null; readonly assignedActorRef: string|null;
  readonly completionEvidenceRef: string|null; readonly exceptionId: EntityId|null; readonly createdAt:string; readonly updatedAt:string;
}

export interface ShipmentRecord {
  readonly id: EntityId; readonly fulfillmentItemId: EntityId; readonly carrierRef:string|null; readonly serviceLevel:string|null;
  readonly trackingReference:string|null; readonly originRef:string|null; readonly destinationRef:string|null; readonly status:ShipmentStatus;
  readonly dispatchedAt:string|null; readonly deliveredAt:string|null; readonly proofOfDeliveryRef:string|null;
  readonly createdAt:string; readonly updatedAt:string;
}

export interface ServiceDeliveryRecord {
  readonly id: EntityId; readonly fulfillmentItemId:EntityId; readonly bookingRef:EntityId; readonly providerRef:string|null;
  readonly serviceLocationRef:string|null; readonly status:ServiceDeliveryStatus; readonly scheduledFrom:string|null;
  readonly scheduledTo:string|null; readonly startedAt:string|null; readonly endedAt:string|null; readonly completionId:EntityId|null;
  readonly exceptionId:EntityId|null; readonly createdAt:string; readonly updatedAt:string;
}

export class FulfillmentRepository extends Repository {
  constructor(database:D1Database){super(database);}

  async get(context:RequestContext,id:EntityId):Promise<FulfillmentOrderRecord|null>{
    return this.database.first<FulfillmentOrderRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, business_id AS businessId, source_type AS sourceType, source_id AS sourceId, status, fulfillment_type AS fulfillmentType, plan_id AS planId, created_at AS createdAt, updated_at AS updatedAt, completed_at AS completedAt, cancelled_at AS cancelledAt FROM fulfillment_orders WHERE id=? AND organization_id=? AND workspace_id=? LIMIT 1",
      id,this.requireOrganization({organizationId:context.tenantId}),this.requireWorkspace({workspaceId:context.workspaceId}));
  }

  async createFromCommitment(context:RequestContext,input:{
    readonly id:EntityId; readonly sourceType:"commerce_order"|"booking"; readonly sourceId:EntityId;
    readonly businessId:EntityId; readonly fulfillmentType:"physical"|"digital"|"service"|"hybrid"; readonly now:string;
  }):Promise<FulfillmentOrderRecord>{
    const organizationId=this.requireOrganization({organizationId:context.tenantId});
    const workspaceId=this.requireWorkspace({workspaceId:context.workspaceId});
    const existing=await this.database.first<FulfillmentOrderRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, business_id AS businessId, source_type AS sourceType, source_id AS sourceId, status, fulfillment_type AS fulfillmentType, plan_id AS planId, created_at AS createdAt, updated_at AS updatedAt, completed_at AS completedAt, cancelled_at AS cancelledAt FROM fulfillment_orders WHERE source_type=? AND source_id=? LIMIT 1",
      input.sourceType,input.sourceId);
    if(existing)return existing;
    await this.database.run(
      "INSERT INTO fulfillment_orders (id,organization_id,workspace_id,business_id,source_type,source_id,status,fulfillment_type,created_at,updated_at) VALUES (?,?,?,?,?,?,'pending',?,?,?)",
      input.id,organizationId,workspaceId,input.businessId,input.sourceType,input.sourceId,input.fulfillmentType,input.now,input.now);
    const record=await this.get(context,input.id);
    if(!record)throw new DatabaseError("Fulfillment order not found after creation");
    return record;
  }

  async listItems(context:RequestContext,fulfillmentId:EntityId):Promise<readonly FulfillmentItemRecord[]>{
    const fulfillment=await this.get(context,fulfillmentId);
    if(!fulfillment)throw new DatabaseError("Fulfillment order not found");
    return this.database.all<FulfillmentItemRecord>(
      "SELECT id, fulfillment_id AS fulfillmentId, source_type AS sourceType, source_id AS sourceId, source_line_id AS sourceLineId, quantity, fulfillment_type AS fulfillmentType, status, promised_from AS promisedFrom, promised_to AS promisedTo, destination_ref AS destinationRef, service_location_ref AS serviceLocationRef, assigned_actor_ref AS assignedActorRef, completion_evidence_ref AS completionEvidenceRef, exception_id AS exceptionId, created_at AS createdAt, updated_at AS updatedAt FROM fulfillment_items WHERE fulfillment_id=? ORDER BY created_at ASC,id ASC",
      fulfillmentId);
  }

  async addItem(context:RequestContext,input:{
    readonly id:EntityId;readonly fulfillmentId:EntityId;readonly sourceType:string;readonly sourceId:EntityId;readonly sourceLineId?:string;
    readonly quantity:number;readonly fulfillmentType:"physical"|"digital"|"service";readonly promisedFrom?:string;readonly promisedTo?:string;
    readonly destinationRef?:string;readonly serviceLocationRef?:string;readonly assignedActorRef?:string;readonly now:string;
  }):Promise<FulfillmentItemRecord>{
    await this.getRequired(context,input.fulfillmentId);
    if(!Number.isSafeInteger(input.quantity)||input.quantity<=0)throw new DatabaseError("Fulfillment quantity must be positive");
    await this.database.run(
      "INSERT INTO fulfillment_items (id,fulfillment_id,source_type,source_id,source_line_id,quantity,fulfillment_type,status,promised_from,promised_to,destination_ref,service_location_ref,assigned_actor_ref,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'pending',?,?,?,?,?, ?,?)",
      input.id,input.fulfillmentId,input.sourceType.trim(),input.sourceId,input.sourceLineId??null,input.quantity,input.fulfillmentType,
      input.promisedFrom??null,input.promisedTo??null,input.destinationRef??null,input.serviceLocationRef??null,input.assignedActorRef??null,input.now,input.now);
    const rows=await this.listItems(context,input.fulfillmentId);
    const record=rows.find(row=>row.id===input.id);
    if(!record)throw new DatabaseError("Fulfillment item not found after creation");
    return record;
  }

  async setStatus(context:RequestContext,id:EntityId,status:FulfillmentOrderStatus,now:string,reasonCode?:string):Promise<FulfillmentOrderRecord>{
    const current=await this.getRequired(context,id);
    if(current.status===status)return current;
    if(!canTransitionFulfillment(current.status,status))throw new DatabaseError("Invalid FulfillmentOrder status transition");
    const completedAt=status==="completed"?now:current.completedAt;
    const cancelledAt=status==="cancelled"?now:current.cancelledAt;
    const eventType="fulfillment."+status;
    const results=await this.database.transaction([
      {sql:"UPDATE fulfillment_orders SET status=?,completed_at=?,cancelled_at=?,updated_at=? WHERE id=? AND organization_id=? AND workspace_id=? AND status=?",params:[status,completedAt,cancelledAt,now,id,current.organizationId,current.workspaceId,current.status]},
      {sql:"INSERT INTO fulfillment_status_history (id,aggregate_type,aggregate_id,from_status,to_status,changed_by,changed_at,reason_code,correlation_id,policy_version) VALUES (?,?,?,?,?,?,?,?,?,?)",params:[id+":status:"+status+":"+now,"fulfillment_order",id,current.status,status,context.actorId??"system",now,reasonCode??null,context.correlationId,null]},
      {sql:"INSERT OR IGNORE INTO outbox_events (id,event_type,event_version,aggregate_type,aggregate_id,organization_id,workspace_id,payload_json,status,attempts,available_at,occurred_at,published_at) VALUES (?, ?, 1, 'fulfillment_order', ?, ?, ?, ?, 'pending', 0, ?, ?, NULL)",params:[id+":event:"+status+":"+now,eventType,id,current.organizationId,current.workspaceId,JSON.stringify({fulfillmentId:id,fromStatus:current.status,toStatus:status,reasonCode:reasonCode??null}),now,now]}
    ]);
    const update=results[0];
    if(!update||((update.meta?.changes??0)!==1)){
      const latest=await this.get(context,id);
      if(latest?.status===status)return latest;
      throw new DatabaseError("FulfillmentOrder changed concurrently");
    }
    return this.getRequired(context,id);
  }

  async createShipment(context:RequestContext,input:{
    readonly id:EntityId;readonly fulfillmentItemId:EntityId;readonly carrierRef?:string;readonly serviceLevel?:string;
    readonly trackingReference?:string;readonly originRef?:string;readonly destinationRef?:string;readonly now:string;
  }):Promise<ShipmentRecord>{
    await this.getItemRequired(context,input.fulfillmentItemId);
    await this.database.run(
      "INSERT INTO shipments (id,fulfillment_item_id,carrier_ref,service_level,tracking_reference,origin_ref,destination_ref,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'draft',?,?)",
      input.id,input.fulfillmentItemId,input.carrierRef??null,input.serviceLevel??null,input.trackingReference??null,input.originRef??null,input.destinationRef??null,input.now,input.now);
    const record=await this.database.first<ShipmentRecord>("SELECT id,fulfillment_item_id AS fulfillmentItemId,carrier_ref AS carrierRef,service_level AS serviceLevel,tracking_reference AS trackingReference,origin_ref AS originRef,destination_ref AS destinationRef,status,dispatched_at AS dispatchedAt,delivered_at AS deliveredAt,proof_of_delivery_ref AS proofOfDeliveryRef,created_at AS createdAt,updated_at AS updatedAt FROM shipments WHERE id=? LIMIT 1",input.id);
    if(!record)throw new DatabaseError("Shipment not found after creation");
    return record;
  }

  async recordTrackingEvent(context:RequestContext,input:{
    readonly id:EntityId;readonly shipmentId:EntityId;readonly eventType:string;readonly occurredAt:string;readonly source:string;
    readonly externalEventId?:string;readonly locationRef?:string;readonly normalizedStatus:string;readonly providerPayloadRef?:string;
    readonly eventVersion?:number;readonly deduplicationKey:string;readonly now:string;
  }):Promise<void>{
    const shipment=await this.database.first<{id:EntityId;fulfillmentItemId:EntityId}>("SELECT id,fulfillment_item_id AS fulfillmentItemId FROM shipments WHERE id=? LIMIT 1",input.shipmentId);
    if(!shipment)throw new DatabaseError("Shipment not found");
    await this.getItemRequired(context,shipment.fulfillmentItemId);
    await this.database.run(
      "INSERT OR IGNORE INTO tracking_events (id,shipment_id,event_type,occurred_at,received_at,source,external_event_id,location_ref,normalized_status,provider_payload_ref,event_version,deduplication_key,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
      input.id,input.shipmentId,input.eventType.trim(),input.occurredAt,input.now,input.source.trim(),input.externalEventId??null,input.locationRef??null,input.normalizedStatus.trim(),input.providerPayloadRef??null,input.eventVersion??1,input.deduplicationKey.trim(),input.now);
  }

  async createServiceDelivery(context:RequestContext,input:{
    readonly id:EntityId;readonly fulfillmentItemId:EntityId;readonly bookingRef:EntityId;readonly providerRef?:string;readonly serviceLocationRef?:string;readonly scheduledFrom?:string;readonly scheduledTo?:string;readonly now:string;
  }):Promise<ServiceDeliveryRecord>{
    const item=await this.getItemRequired(context,input.fulfillmentItemId);
    if(item.fulfillmentType!=="service")throw new DatabaseError("Service delivery requires a service fulfillment item");
    await this.database.run(
      "INSERT INTO service_deliveries (id,fulfillment_item_id,booking_ref,provider_ref,service_location_ref,status,scheduled_from,scheduled_to,created_at,updated_at) VALUES (?,?,?,?,?,'scheduled',?,?,?,?)",
      input.id,input.fulfillmentItemId,input.bookingRef,input.providerRef??null,input.serviceLocationRef??null,input.scheduledFrom??null,input.scheduledTo??null,input.now,input.now);
    const record=await this.database.first<ServiceDeliveryRecord>("SELECT id,fulfillment_item_id AS fulfillmentItemId,booking_ref AS bookingRef,provider_ref AS providerRef,service_location_ref AS serviceLocationRef,status,scheduled_from AS scheduledFrom,scheduled_to AS scheduledTo,started_at AS startedAt,ended_at AS endedAt,completion_id AS completionId,exception_id AS exceptionId,created_at AS createdAt,updated_at AS updatedAt FROM service_deliveries WHERE id=? LIMIT 1",input.id);
    if(!record)throw new DatabaseError("Service delivery not found after creation");
    return record;
  }

  async completeService(context:RequestContext,input:{
    readonly id:EntityId;readonly serviceDeliveryId:EntityId;readonly completedByActorRef:string;readonly completedAt:string;readonly confirmationType:string;
    readonly customerConfirmationRef?:string;readonly providerConfirmationRef?:string;readonly evidenceRef?:string;readonly now:string;
  }):Promise<void>{
    const delivery=await this.database.first<ServiceDeliveryRecord>("SELECT id,fulfillment_item_id AS fulfillmentItemId,booking_ref AS bookingRef,provider_ref AS providerRef,service_location_ref AS serviceLocationRef,status,scheduled_from AS scheduledFrom,scheduled_to AS scheduledTo,started_at AS startedAt,ended_at AS endedAt,completion_id AS completionId,exception_id AS exceptionId,created_at AS createdAt,updated_at AS updatedAt FROM service_deliveries WHERE id=? LIMIT 1",input.serviceDeliveryId);
    if(!delivery)throw new DatabaseError("Service delivery not found");
    await this.getItemRequired(context,delivery.fulfillmentItemId);
    if(!["ready","in_progress"].includes(delivery.status))throw new DatabaseError("Service delivery cannot be completed from current status");
    await this.database.transaction([
      {sql:"INSERT INTO service_completions (id,service_delivery_id,completed_by_actor_ref,completed_at,confirmation_type,customer_confirmation_ref,provider_confirmation_ref,evidence_ref,status,created_at) VALUES (?,?,?,?,?,?,?,?,'confirmed',?)",params:[input.id,input.serviceDeliveryId,input.completedByActorRef.trim(),input.completedAt,input.confirmationType.trim(),input.customerConfirmationRef??null,input.providerConfirmationRef??null,input.evidenceRef??null,input.now]},
      {sql:"UPDATE service_deliveries SET status='completed',ended_at=?,completion_id=?,updated_at=? WHERE id=? AND status IN ('ready','in_progress')",params:[input.completedAt,input.id,input.now,input.serviceDeliveryId]},
      {sql:"UPDATE fulfillment_items SET status='completed',completion_evidence_ref=?,updated_at=? WHERE id=? AND status IN ('ready','in_progress','partially_completed')",params:[input.evidenceRef??null,input.now,delivery.fulfillmentItemId]},
      {sql:"INSERT INTO fulfillment_status_history (id,aggregate_type,aggregate_id,from_status,to_status,changed_by,changed_at,reason_code,correlation_id,policy_version) VALUES (?,?,?,?,?,?,?,?,?,?)",params:[input.serviceDeliveryId+":completed:"+input.now,"service_delivery",input.serviceDeliveryId,delivery.status,"completed",input.completedByActorRef,input.completedAt,null,context.correlationId,null]}
    ]);
  }

  private async getRequired(context:RequestContext,id:EntityId):Promise<FulfillmentOrderRecord>{
    const record=await this.get(context,id); if(!record)throw new DatabaseError("Fulfillment order not found"); return record;
  }

  private async getItemRequired(context:RequestContext,id:EntityId):Promise<FulfillmentItemRecord>{
    const row=await this.database.first<FulfillmentItemRecord>(
      "SELECT fi.id,fi.fulfillment_id AS fulfillmentId,fi.source_type AS sourceType,fi.source_id AS sourceId,fi.source_line_id AS sourceLineId,fi.quantity,fi.fulfillment_type AS fulfillmentType,fi.status,fi.promised_from AS promisedFrom,fi.promised_to AS promisedTo,fi.destination_ref AS destinationRef,fi.service_location_ref AS serviceLocationRef,fi.assigned_actor_ref AS assignedActorRef,fi.completion_evidence_ref AS completionEvidenceRef,fi.exception_id AS exceptionId,fi.created_at AS createdAt,fi.updated_at AS updatedAt FROM fulfillment_items fi INNER JOIN fulfillment_orders fo ON fo.id=fi.fulfillment_id WHERE fi.id=? AND fo.organization_id=? AND fo.workspace_id=? LIMIT 1",
      id,this.requireOrganization({organizationId:context.tenantId}),this.requireWorkspace({workspaceId:context.workspaceId}));
    if(!row)throw new DatabaseError("Fulfillment item not found"); return row;
  }
}

function canTransitionFulfillment(from:FulfillmentOrderStatus,to:FulfillmentOrderStatus):boolean{
  const allowed:Record<FulfillmentOrderStatus,readonly FulfillmentOrderStatus[]>={
    pending:["planned","cancelled","failed"],planned:["ready","cancelled","failed"],ready:["in_progress","cancelled","failed"],
    in_progress:["partially_completed","completed","cancelled","failed"],partially_completed:["in_progress","completed","failed"],
    completed:["closed"],cancelled:["closed"],failed:["closed"],closed:[]
  };
  return allowed[from].includes(to);
}
