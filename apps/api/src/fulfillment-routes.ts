import { FulfillmentRepository, FulfillmentService } from "@qooqnos/fulfillment";
import { AuthorizationRepository } from "@qooqnos/database";
import { createAuthorizationService, type AuthorizationRegistry } from "@qooqnos/runtime";
import { AppError, brandId, type EntityId } from "@qooqnos/core";
import type { D1Database } from "@qooqnos/database";
import type { ApiRouter } from "./router";
import { json } from "./http";

export function registerFulfillmentRoutes(
  router: ApiRouter,
  database: D1Database | undefined,
  authorization: AuthorizationRegistry | undefined,
): void {
  router.register({
    method: "POST",
    path: "/api/v1/fulfillment",
    module: "fulfillment",
    operation: "fulfillment.create",
    permission: "fulfillment.create",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const result = await service.create(context, {
        sourceType: requiredEnum(body.sourceType, "sourceType", ["commerce_order", "booking"], context.requestId),
        sourceId: requiredId(body.sourceId, "sourceId", context.requestId),
        businessId: requiredId(body.businessId, "businessId", context.requestId),
        fulfillmentType: requiredEnum(body.fulfillmentType, "fulfillmentType", ["physical", "digital", "service", "hybrid"], context.requestId),
      });
      return json({ data: result }, 201, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/fulfillment/:fulfillmentId",
    module: "fulfillment",
    operation: "fulfillment.get",
    permission: "fulfillment.get",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, params }) => {
      if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId: context.requestId });
      const repository = new FulfillmentRepository(database);
      const fulfillmentId = brandId<"EntityId">(requiredParam(params.fulfillmentId, context.requestId));
      const fulfillment = await repository.get(context, fulfillmentId);
      if (!fulfillment) throw new AppError({ code: "NOT_FOUND", message: "Fulfillment order not found.", requestId: context.requestId });
      const items = await repository.listItems(context, fulfillmentId);
      return json({ data: { fulfillment, items } }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/fulfillment/:fulfillmentId/status",
    module: "fulfillment",
    operation: "fulfillment.update_status",
    permission: "fulfillment.update_status",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const fulfillmentId = brandId<"EntityId">(requiredParam(params.fulfillmentId, context.requestId));
      const result = await service.setStatus(
        context,
        fulfillmentId,
        requiredEnum(body.status, "status", [
          "pending", "planned", "ready", "in_progress", "partially_completed",
          "completed", "cancelled", "failed", "closed",
        ], context.requestId),
        body.reasonCode === undefined ? undefined : requiredString(body.reasonCode, "reasonCode", context.requestId),
      );
      return json({ data: result }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/fulfillment/items",
    module: "fulfillment",
    operation: "fulfillment.plan",
    permission: "fulfillment.plan",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId: context.requestId });
      const body = await bodyObject(request, context.requestId);
      const repository = new FulfillmentRepository(database);
      const item = await repository.addItem(context, {
        id: brandId<"EntityId">(crypto.randomUUID()),
        fulfillmentId: requiredId(body.fulfillmentId, "fulfillmentId", context.requestId),
        sourceType: requiredString(body.sourceType, "sourceType", context.requestId),
        sourceId: requiredId(body.sourceId, "sourceId", context.requestId),
        ...(body.sourceLineId !== undefined ? { sourceLineId: requiredString(body.sourceLineId, "sourceLineId", context.requestId) } : {}),
        quantity: requiredPositiveInteger(body.quantity, "quantity", context.requestId),
        fulfillmentType: requiredEnum(body.fulfillmentType, "fulfillmentType", ["physical", "digital", "service"], context.requestId),
        ...(body.promisedFrom !== undefined ? { promisedFrom: requiredString(body.promisedFrom, "promisedFrom", context.requestId) } : {}),
        ...(body.promisedTo !== undefined ? { promisedTo: requiredString(body.promisedTo, "promisedTo", context.requestId) } : {}),
        ...(body.destinationRef !== undefined ? { destinationRef: requiredString(body.destinationRef, "destinationRef", context.requestId) } : {}),
        ...(body.serviceLocationRef !== undefined ? { serviceLocationRef: requiredString(body.serviceLocationRef, "serviceLocationRef", context.requestId) } : {}),
        ...(body.assignedActorRef !== undefined ? { assignedActorRef: requiredString(body.assignedActorRef, "assignedActorRef", context.requestId) } : {}),
        now: new Date().toISOString(),
      });
      return json({ data: item }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/fulfillment/items/:itemId/shipment",
    module: "fulfillment",
    operation: "fulfillment.plan",
    permission: "fulfillment.plan",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const shipment = await service.createShipment(context, {
        fulfillmentItemId: brandId<"EntityId">(requiredParam(params.itemId, context.requestId)),
        ...(body.carrierRef !== undefined ? { carrierRef: requiredString(body.carrierRef, "carrierRef", context.requestId) } : {}),
        ...(body.serviceLevel !== undefined ? { serviceLevel: requiredString(body.serviceLevel, "serviceLevel", context.requestId) } : {}),
        ...(body.trackingReference !== undefined ? { trackingReference: requiredString(body.trackingReference, "trackingReference", context.requestId) } : {}),
        ...(body.originRef !== undefined ? { originRef: requiredString(body.originRef, "originRef", context.requestId) } : {}),
        ...(body.destinationRef !== undefined ? { destinationRef: requiredString(body.destinationRef, "destinationRef", context.requestId) } : {}),
      });
      return json({ data: shipment }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/fulfillment/shipments/:shipmentId/tracking",
    module: "fulfillment",
    operation: "fulfillment.update_status",
    permission: "fulfillment.update_status",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      await service.recordTracking(context, {
        shipmentId: brandId<"EntityId">(requiredParam(params.shipmentId, context.requestId)),
        eventType: requiredString(body.eventType, "eventType", context.requestId),
        occurredAt: requiredString(body.occurredAt, "occurredAt", context.requestId),
        source: requiredString(body.source, "source", context.requestId),
        ...(body.externalEventId !== undefined ? { externalEventId: requiredString(body.externalEventId, "externalEventId", context.requestId) } : {}),
        ...(body.locationRef !== undefined ? { locationRef: requiredString(body.locationRef, "locationRef", context.requestId) } : {}),
        normalizedStatus: requiredString(body.normalizedStatus, "normalizedStatus", context.requestId),
        ...(body.providerPayloadRef !== undefined ? { providerPayloadRef: requiredString(body.providerPayloadRef, "providerPayloadRef", context.requestId) } : {}),
        ...(body.eventVersion !== undefined ? { eventVersion: requiredPositiveInteger(body.eventVersion, "eventVersion", context.requestId) } : {}),
        deduplicationKey: requiredString(body.deduplicationKey, "deduplicationKey", context.requestId),
      });
      return json({ accepted: true }, 202, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/fulfillment/service-deliveries",
    module: "fulfillment",
    operation: "fulfillment.plan",
    permission: "fulfillment.plan",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const result = await service.createServiceDelivery(context, {
        fulfillmentItemId: requiredId(body.fulfillmentItemId, "fulfillmentItemId", context.requestId),
        bookingRef: requiredId(body.bookingRef, "bookingRef", context.requestId),
        ...(body.providerRef !== undefined ? { providerRef: requiredString(body.providerRef, "providerRef", context.requestId) } : {}),
        ...(body.serviceLocationRef !== undefined ? { serviceLocationRef: requiredString(body.serviceLocationRef, "serviceLocationRef", context.requestId) } : {}),
        ...(body.scheduledFrom !== undefined ? { scheduledFrom: requiredString(body.scheduledFrom, "scheduledFrom", context.requestId) } : {}),
        ...(body.scheduledTo !== undefined ? { scheduledTo: requiredString(body.scheduledTo, "scheduledTo", context.requestId) } : {}),
      });
      return json({ data: result }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/fulfillment/service-deliveries/:serviceDeliveryId/complete",
    module: "fulfillment",
    operation: "fulfillment.confirm_service_completion",
    permission: "fulfillment.confirm_service_completion",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      await service.completeService(context, {
        serviceDeliveryId: brandId<"EntityId">(requiredParam(params.serviceDeliveryId, context.requestId)),
        completedByActorRef: requiredString(body.completedByActorRef, "completedByActorRef", context.requestId),
        completedAt: requiredString(body.completedAt, "completedAt", context.requestId),
        confirmationType: requiredString(body.confirmationType, "confirmationType", context.requestId),
        ...(body.customerConfirmationRef !== undefined ? { customerConfirmationRef: requiredString(body.customerConfirmationRef, "customerConfirmationRef", context.requestId) } : {}),
        ...(body.providerConfirmationRef !== undefined ? { providerConfirmationRef: requiredString(body.providerConfirmationRef, "providerConfirmationRef", context.requestId) } : {}),
        ...(body.evidenceRef !== undefined ? { evidenceRef: requiredString(body.evidenceRef, "evidenceRef", context.requestId) } : {}),
      });
      return json({ accepted: true }, 202, context.requestId);
    },
  });
}

function createService(database:D1Database|undefined, authorization:AuthorizationRegistry|undefined, requestId:EntityId):FulfillmentService{
  if(!database)throw new AppError({code:"INTERNAL_ERROR",message:"Database is not configured.",requestId});
  if(!authorization)throw new AppError({code:"INTERNAL_ERROR",message:"Authorization registry is not configured.",requestId});
  return new FulfillmentService({
    repository:new FulfillmentRepository(database),
    authorization:createAuthorizationService(new AuthorizationRepository(database),authorization),
    id:()=>brandId<"EntityId">(crypto.randomUUID()),
    now:()=>new Date().toISOString(),
  });
}
async function bodyObject(request:Request,requestId:EntityId):Promise<Record<string,unknown>>{
  let value:unknown;
  try{value=await request.json();}catch{throw new AppError({code:"VALIDATION_ERROR",message:"Request body must be valid JSON.",requestId});}
  if(!value||typeof value!=="object"||Array.isArray(value))throw new AppError({code:"VALIDATION_ERROR",message:"Request body must be an object.",requestId});
  return value as Record<string,unknown>;
}
function requiredString(value:unknown,field:string,requestId:EntityId):string{
  if(typeof value!=="string"||!value.trim())throw new AppError({code:"VALIDATION_ERROR",message:field+" is required.",requestId});
  return value.trim();
}
function requiredId(value:unknown,field:string,requestId:EntityId):EntityId{return brandId<"EntityId">(requiredString(value,field,requestId));}
function requiredPositiveInteger(value:unknown,field:string,requestId:EntityId):number{
  if(!Number.isSafeInteger(value)||(value as number)<=0)throw new AppError({code:"VALIDATION_ERROR",message:field+" must be a positive integer.",requestId});
  return value as number;
}
function requiredEnum<T extends string>(value:unknown,field:string,values:readonly T[],requestId:EntityId):T{
  const parsed=requiredString(value,field,requestId) as T;
  if(!values.includes(parsed))throw new AppError({code:"VALIDATION_ERROR",message:field+" is invalid.",requestId});
  return parsed;
}
function requiredParam(value:string|undefined,requestId:EntityId):string{
  if(!value)throw new AppError({code:"NOT_FOUND",message:"Route parameter is missing.",requestId});
  return value;
}
