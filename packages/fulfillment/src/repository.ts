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


  async createPlan(context:RequestContext,input:{
    readonly id:EntityId;readonly fulfillmentId:EntityId;readonly version:number;readonly strategy:string;readonly createdBy:string;
    readonly supersedesPlanId?:EntityId;readonly now:string;
  }):Promise<{
    readonly id:EntityId;readonly fulfillmentId:EntityId;readonly version:number;readonly status:string;readonly strategy:string;readonly createdBy:string;
    readonly createdAt:string;readonly activatedAt:string|null;readonly supersedesPlanId:EntityId|null;
  }>{
    const fulfillment=await this.getRequired(context,input.fulfillmentId);
    if(!Number.isSafeInteger(input.version)||input.version<1)throw new DatabaseError("Fulfillment plan version must be positive");
    if(!input.strategy.trim()||!input.createdBy.trim())throw new DatabaseError("Fulfillment plan strategy and creator are required");
    await this.database.run(
      "INSERT INTO fulfillment_plans (id,fulfillment_id,version,status,strategy,created_by,created_at,supersedes_plan_id) VALUES (?,?,?,'draft',?,?,?,?)",
      input.id,input.fulfillmentId,input.version,input.strategy.trim(),input.createdBy.trim(),input.now,input.supersedesPlanId??null);
    await this.database.run(
      "UPDATE fulfillment_orders SET updated_at=? WHERE id=? AND organization_id=? AND workspace_id=?",
      input.now,fulfillment.id,fulfillment.organizationId,fulfillment.workspaceId);
    const row=await this.database.first<{
      id:EntityId;fulfillmentId:EntityId;version:number;status:string;strategy:string;createdBy:string;createdAt:string;activatedAt:string|null;supersedesPlanId:EntityId|null;
    }>("SELECT id,fulfillment_id AS fulfillmentId,version,status,strategy,created_by AS createdBy,created_at AS createdAt,activated_at AS activatedAt,supersedes_plan_id AS supersedesPlanId FROM fulfillment_plans WHERE id=? LIMIT 1",input.id);
    if(!row)throw new DatabaseError("Fulfillment plan not found after creation");
    return row;
  }

  async activatePlan(context:RequestContext,planId:EntityId,now:string):Promise<void>{
    const plan=await this.database.first<{id:EntityId;fulfillmentId:EntityId;status:string}>(
      "SELECT id,fulfillment_id AS fulfillmentId,status FROM fulfillment_plans WHERE id=? LIMIT 1",planId);
    if(!plan)throw new DatabaseError("Fulfillment plan not found");
    const fulfillment=await this.getRequired(context,plan.fulfillmentId);
    if(plan.status==="active")return;
    if(plan.status!=="draft")throw new DatabaseError("Only draft Fulfillment plans can be activated");
    const active=await this.database.first<{id:EntityId}>(
      "SELECT id FROM fulfillment_plans WHERE fulfillment_id=? AND status='active' ORDER BY version DESC LIMIT 1",plan.fulfillmentId);
    const results=await this.database.transaction([
      ...(active ? [{sql:"UPDATE fulfillment_plans SET status='superseded' WHERE id=? AND status='active'",params:[active.id]}] : []),
      {sql:"UPDATE fulfillment_plans SET status='active',activated_at=? WHERE id=? AND status='draft'",params:[now,planId]},
      {sql:"UPDATE fulfillment_orders SET status=CASE WHEN status='pending' THEN 'planned' ELSE status END,plan_id=?,updated_at=? WHERE id=? AND organization_id=? AND workspace_id=?",params:[planId,now,fulfillment.id,fulfillment.organizationId,fulfillment.workspaceId]},
      {sql:"INSERT INTO fulfillment_status_history (id,aggregate_type,aggregate_id,from_status,to_status,changed_by,changed_at,reason_code,correlation_id,policy_version) VALUES (?,?,?,?,?,?,?,?,?,?)",params:[planId+":planned:"+now,"fulfillment_order",fulfillment.id,fulfillment.status==="pending"?"pending":fulfillment.status,fulfillment.status==="pending"?"planned":fulfillment.status,context.actorId??"system",now,"plan_activated",context.correlationId,null]},
      {sql:"INSERT OR IGNORE INTO outbox_events (id,event_type,event_version,aggregate_type,aggregate_id,organization_id,workspace_id,payload_json,status,attempts,available_at,occurred_at,published_at) VALUES (?, ?, 1, 'fulfillment_order', ?, ?, ?, ?, 'pending', 0, ?, ?, NULL)",params:[fulfillment.id+":planned:"+now,"fulfillment.planned",fulfillment.id,fulfillment.organizationId,fulfillment.workspaceId,JSON.stringify({fulfillmentId:fulfillment.id,planId}),now,now]}
    ]);
    const update=results[active?1:0];
    if(!update||((update.meta?.changes??0)!==1))throw new DatabaseError("Fulfillment plan activation failed");
  }

  async createTask(context:RequestContext,input:{
    readonly id:EntityId;readonly fulfillmentId:EntityId;readonly fulfillmentItemId?:EntityId;readonly taskType:string;
    readonly priority?:number;readonly scheduledFrom?:string;readonly scheduledTo?:string;readonly now:string;
  }){
    await this.getRequired(context,input.fulfillmentId);
    if(input.fulfillmentItemId)await this.getItemRequired(context,input.fulfillmentItemId);
    if(!input.taskType.trim())throw new DatabaseError("Fulfillment task type is required");
    if(!Number.isSafeInteger(input.priority??100)||((input.priority??100)<0))throw new DatabaseError("Fulfillment task priority must be non-negative");
    await this.database.run(
      "INSERT INTO fulfillment_tasks (id,fulfillment_id,fulfillment_item_id,task_type,status,priority,scheduled_from,scheduled_to,created_at,updated_at) VALUES (?,?,?,?,'pending',?,?,?,?,?)",
      input.id,input.fulfillmentId,input.fulfillmentItemId??null,input.taskType.trim(),input.priority??100,input.scheduledFrom??null,input.scheduledTo??null,input.now,input.now);
    return this.database.first(
      "SELECT id,fulfillment_id AS fulfillmentId,fulfillment_item_id AS fulfillmentItemId,task_type AS taskType,status,priority,assigned_actor_ref AS assignedActorRef,scheduled_from AS scheduledFrom,scheduled_to AS scheduledTo,started_at AS startedAt,completed_at AS completedAt,failure_reason_code AS failureReasonCode,created_at AS createdAt,updated_at AS updatedAt FROM fulfillment_tasks WHERE id=? LIMIT 1",
      input.id);
  }

  async assignTask(context:RequestContext,input:{
    readonly id:EntityId;readonly fulfillmentTaskId:EntityId;readonly actorRef:string;readonly actorType:string;readonly assignedBy:string;readonly now:string;
  }){
    await this.getTaskRequired(context,input.fulfillmentTaskId);
    if(!input.actorRef.trim()||!input.actorType.trim()||!input.assignedBy.trim())throw new DatabaseError("Fulfillment assignment fields are required");
    await this.database.transaction([
      {sql:"UPDATE fulfillment_assignments SET status='ended',unassigned_at=? WHERE fulfillment_task_id=? AND status IN ('assigned','active')",params:[input.now,input.fulfillmentTaskId]},
      {sql:"UPDATE fulfillment_tasks SET assigned_actor_ref=?,status=CASE WHEN status='pending' THEN 'assigned' ELSE status END,updated_at=? WHERE id=?",params:[input.actorRef.trim(),input.now,input.fulfillmentTaskId]},
      {sql:"INSERT INTO fulfillment_assignments (id,fulfillment_task_id,actor_ref,actor_type,assigned_by,assigned_at,status) VALUES (?,?,?,?,?,?,'active')",params:[input.id,input.fulfillmentTaskId,input.actorRef.trim(),input.actorType.trim(),input.assignedBy.trim(),input.now]}
    ]);
  }

  async setTaskStatus(context:RequestContext,taskId:EntityId,status:"pending"|"ready"|"assigned"|"in_progress"|"completed"|"failed"|"cancelled"|"blocked",now:string,reasonCode?:string){
    const task=await this.getTaskRequired(context,taskId);
    if(task.status===status)return task;
    if(!canTransitionTask(task.status,status))throw new DatabaseError("Invalid FulfillmentTask status transition");
    await this.database.run(
      "UPDATE fulfillment_tasks SET status=?,started_at=CASE WHEN ?='in_progress' AND started_at IS NULL THEN ? ELSE started_at END,completed_at=CASE WHEN ?='completed' THEN ? ELSE completed_at END,failure_reason_code=COALESCE(?,failure_reason_code),updated_at=? WHERE id=? AND status=?",
      status,status,now,status,now,reasonCode??null,now,taskId,task.status);
    const result=await this.getTaskRequired(context,taskId);
    await this.database.run(
      "INSERT INTO fulfillment_status_history (id,aggregate_type,aggregate_id,from_status,to_status,changed_by,changed_at,reason_code,correlation_id,policy_version) VALUES (?,?,?,?,?,?,?,?,?,?)",
      taskId+":status:"+status+":"+now,"task",taskId,task.status,status,context.actorId??"system",now,reasonCode??null,context.correlationId,null);
    return result;
  }

  async setShipmentStatus(context:RequestContext,input:{
    readonly shipmentId:EntityId;readonly status:ShipmentStatus;readonly now:string;readonly proofOfDeliveryRef?:string;readonly reasonCode?:string;
  }){
    const shipment=await this.getShipmentRequired(context,input.shipmentId);
    if(shipment.status===input.status)return shipment;
    if(!canTransitionShipment(shipment.status,input.status))throw new DatabaseError("Invalid Shipment status transition");
    const dispatchedAt=input.status==="dispatched"&&!shipment.dispatchedAt?input.now:shipment.dispatchedAt;
    const deliveredAt=input.status==="delivered"&&!shipment.deliveredAt?input.now:shipment.deliveredAt;
    await this.database.transaction([
      {sql:"UPDATE shipments SET status=?,dispatched_at=?,delivered_at=?,proof_of_delivery_ref=COALESCE(?,proof_of_delivery_ref),updated_at=? WHERE id=? AND status=?",params:[input.status,dispatchedAt,deliveredAt,input.proofOfDeliveryRef??null,input.now,input.shipmentId,shipment.status]},
      {sql:"INSERT INTO fulfillment_status_history (id,aggregate_type,aggregate_id,from_status,to_status,changed_by,changed_at,reason_code,correlation_id,policy_version) VALUES (?,?,?,?,?,?,?,?,?,?)",params:[input.shipmentId+":status:"+input.status+":"+input.now,"shipment",input.shipmentId,shipment.status,input.status,context.actorId??"system",input.now,input.reasonCode??null,context.correlationId,null]},
      {sql:"INSERT OR IGNORE INTO outbox_events (id,event_type,event_version,aggregate_type,aggregate_id,organization_id,workspace_id,payload_json,status,attempts,available_at,occurred_at,published_at) SELECT ?, ?, 1, 'shipment', ?, fo.organization_id, fo.workspace_id, ?, 'pending', 0, ?, ?, NULL FROM fulfillment_items fi INNER JOIN fulfillment_orders fo ON fo.id=fi.fulfillment_id WHERE fi.id=?",params:[input.shipmentId+":event:"+input.status+":"+input.now,"shipment."+input.status,input.shipmentId,JSON.stringify({shipmentId:input.shipmentId,status:input.status}),input.now,input.now,shipment.fulfillmentItemId]}
    ]);
    return this.getShipmentRequired(context,input.shipmentId);
  }

  async recordDeliveryAttempt(context:RequestContext,input:{
    readonly id:EntityId;readonly shipmentId:EntityId;readonly attemptNumber:number;readonly attemptedAt:string;readonly actorRef?:string;
    readonly status:string;readonly failureReasonCode?:string;readonly evidenceRef?:string;readonly nextActionRef?:string;readonly now:string;
  }){
    await this.getShipmentRequired(context,input.shipmentId);
    if(!Number.isSafeInteger(input.attemptNumber)||input.attemptNumber<1)throw new DatabaseError("Delivery attempt number must be positive");
    await this.database.run(
      "INSERT INTO delivery_attempts (id,shipment_id,attempt_number,attempted_at,actor_ref,status,failure_reason_code,evidence_ref,next_action_ref,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      input.id,input.shipmentId,input.attemptNumber,input.attemptedAt,input.actorRef??null,input.status.trim(),input.failureReasonCode??null,input.evidenceRef??null,input.nextActionRef??null,input.now);
  }

  async createDigitalDelivery(context:RequestContext,input:{
    readonly id:EntityId;readonly fulfillmentItemId:EntityId;readonly entitlementRef?:string;readonly deliveryChannel:string;readonly recipientScopeRef:string;
    readonly issuedAt:string;readonly expiresAt?:string;readonly deliveryStatus:string;readonly evidenceRef?:string;readonly now:string;
  }){
    const item=await this.getItemRequired(context,input.fulfillmentItemId);
    if(item.fulfillmentType!=="digital")throw new DatabaseError("Digital delivery requires a digital fulfillment item");
    await this.database.run(
      "INSERT INTO digital_deliveries (id,fulfillment_item_id,entitlement_ref,delivery_channel,recipient_scope_ref,issued_at,expires_at,delivery_status,evidence_ref,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      input.id,input.fulfillmentItemId,input.entitlementRef??null,input.deliveryChannel.trim(),input.recipientScopeRef.trim(),input.issuedAt,input.expiresAt??null,input.deliveryStatus.trim(),input.evidenceRef??null,input.now,input.now);
    return this.database.first(
      "SELECT id,fulfillment_item_id AS fulfillmentItemId,entitlement_ref AS entitlementRef,delivery_channel AS deliveryChannel,recipient_scope_ref AS recipientScopeRef,issued_at AS issuedAt,expires_at AS expiresAt,delivery_status AS deliveryStatus,evidence_ref AS evidenceRef,created_at AS createdAt,updated_at AS updatedAt FROM digital_deliveries WHERE id=? LIMIT 1",
      input.id);
  }

  async createException(context:RequestContext,input:{
    readonly id:EntityId;readonly fulfillmentId:EntityId;readonly fulfillmentItemId?:EntityId;readonly exceptionType:string;readonly severity:"low"|"medium"|"high"|"critical";
    readonly reasonCode:string;readonly detectedAt:string;readonly detectedBy:string;readonly now:string;
  }){
    await this.getRequired(context,input.fulfillmentId);
    if(input.fulfillmentItemId)await this.getItemRequired(context,input.fulfillmentItemId);
    await this.database.run(
      "INSERT INTO fulfillment_exceptions (id,fulfillment_id,fulfillment_item_id,exception_type,severity,status,reason_code,detected_at,detected_by,created_at,updated_at) VALUES (?,?,?,?,?,'open',?,?,?,?,?)",
      input.id,input.fulfillmentId,input.fulfillmentItemId??null,input.exceptionType.trim(),input.severity,input.reasonCode.trim(),input.detectedAt,input.detectedBy.trim(),input.now,input.now);
    return this.database.first(
      "SELECT id,fulfillment_id AS fulfillmentId,fulfillment_item_id AS fulfillmentItemId,exception_type AS exceptionType,severity,status,reason_code AS reasonCode,detected_at AS detectedAt,detected_by AS detectedBy,resolution_code AS resolutionCode,resolved_at AS resolvedAt,resolved_by AS resolvedBy,rework_task_ref AS reworkTaskRef,created_at AS createdAt,updated_at AS updatedAt FROM fulfillment_exceptions WHERE id=? LIMIT 1",
      input.id);
  }

  async resolveException(context:RequestContext,input:{
    readonly id:EntityId;readonly resolutionCode:string;readonly resolvedBy:string;readonly reworkTaskRef?:string;readonly now:string;
  }){
    const exception=await this.database.first<{id:EntityId;fulfillmentId:EntityId;status:string}>(
      "SELECT id,fulfillment_id AS fulfillmentId,status FROM fulfillment_exceptions WHERE id=? LIMIT 1",input.id);
    if(!exception)throw new DatabaseError("Fulfillment exception not found");
    await this.getRequired(context,exception.fulfillmentId);
    if(exception.status!=="open"&&exception.status!=="investigating")throw new DatabaseError("Fulfillment exception is not open");
    await this.database.run(
      "UPDATE fulfillment_exceptions SET status='resolved',resolution_code=?,resolved_at=?,resolved_by=?,rework_task_ref=?,updated_at=? WHERE id=?",
      input.resolutionCode.trim(),input.now,input.resolvedBy.trim(),input.reworkTaskRef??null,input.now,input.id);
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


  private async getShipmentRequired(context:RequestContext,id:EntityId):Promise<ShipmentRecord>{
    const row=await this.database.first<ShipmentRecord>(
      "SELECT s.id,s.fulfillment_item_id AS fulfillmentItemId,s.carrier_ref AS carrierRef,s.service_level AS serviceLevel,s.tracking_reference AS trackingReference,s.origin_ref AS originRef,s.destination_ref AS destinationRef,s.status,s.dispatched_at AS dispatchedAt,s.delivered_at AS deliveredAt,s.proof_of_delivery_ref AS proofOfDeliveryRef,s.created_at AS createdAt,s.updated_at AS updatedAt FROM shipments s INNER JOIN fulfillment_items fi ON fi.id=s.fulfillment_item_id INNER JOIN fulfillment_orders fo ON fo.id=fi.fulfillment_id WHERE s.id=? AND fo.organization_id=? AND fo.workspace_id=? LIMIT 1",
      id,this.requireOrganization({organizationId:context.tenantId}),this.requireWorkspace({workspaceId:context.workspaceId}));
    if(!row)throw new DatabaseError("Shipment not found"); return row;
  }

  private async getTaskRequired(context:RequestContext,id:EntityId){
    const row=await this.database.first<{
      id:EntityId;fulfillmentId:EntityId;fulfillmentItemId:EntityId|null;taskType:string;status:string;priority:number;assignedActorRef:string|null;
      scheduledFrom:string|null;scheduledTo:string|null;startedAt:string|null;completedAt:string|null;failureReasonCode:string|null;createdAt:string;updatedAt:string;
    }>(
      "SELECT t.id,t.fulfillment_id AS fulfillmentId,t.fulfillment_item_id AS fulfillmentItemId,t.task_type AS taskType,t.status,t.priority,t.assigned_actor_ref AS assignedActorRef,t.scheduled_from AS scheduledFrom,t.scheduled_to AS scheduledTo,t.started_at AS startedAt,t.completed_at AS completedAt,t.failure_reason_code AS failureReasonCode,t.created_at AS createdAt,t.updated_at AS updatedAt FROM fulfillment_tasks t INNER JOIN fulfillment_orders fo ON fo.id=t.fulfillment_id WHERE t.id=? AND fo.organization_id=? AND fo.workspace_id=? LIMIT 1",
      id,this.requireOrganization({organizationId:context.tenantId}),this.requireWorkspace({workspaceId:context.workspaceId}));
    if(!row)throw new DatabaseError("Fulfillment task not found"); return row;
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

function canTransitionTask(from:string,to:string):boolean{
  const allowed:Record<string,readonly string[]>={
    pending:["ready","assigned","blocked","cancelled"],
    ready:["assigned","in_progress","blocked","cancelled"],
    assigned:["ready","in_progress","cancelled"],
    in_progress:["completed","failed","blocked","cancelled"],
    completed:[],
    failed:["ready","cancelled"],
    cancelled:[],
    blocked:["ready","cancelled"],
  };
  return allowed[from]?.includes(to)??false;
}

function canTransitionShipment(from:ShipmentStatus,to:ShipmentStatus):boolean{
  const allowed:Record<ShipmentStatus,readonly ShipmentStatus[]>={
    draft:["ready","cancelled","failed"],
    ready:["dispatched","cancelled","failed"],
    dispatched:["in_transit","cancelled","failed"],
    in_transit:["out_for_delivery","delivered","returned","lost","failed"],
    out_for_delivery:["delivered","returned","lost","failed"],
    delivered:["returned"],
    cancelled:[],
    returned:[],
    lost:[],
    failed:["ready","cancelled"],
  };
  return allowed[from].includes(to);
}

function canTransitionFulfillment(from:FulfillmentOrderStatus,to:FulfillmentOrderStatus):boolean{
  const allowed:Record<FulfillmentOrderStatus,readonly FulfillmentOrderStatus[]>={
    pending:["planned","cancelled","failed"],planned:["ready","cancelled","failed"],ready:["in_progress","cancelled","failed"],
    in_progress:["partially_completed","completed","cancelled","failed"],partially_completed:["in_progress","completed","failed"],
    completed:["closed"],cancelled:["closed"],failed:["closed"],closed:[]
  };
  return allowed[from].includes(to);
}
