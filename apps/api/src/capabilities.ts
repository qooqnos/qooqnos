import type { EntityId } from "@qooqnos/core";
import {
  AuthorizationRepository,
} from "@qooqnos/database";
import {
  BookingRepository,
  BookingService,
  AvailabilityRepository,
  AvailabilityService,
} from "@qooqnos/booking";
import {
  CommerceRepository,
  CommerceService,
} from "@qooqnos/commerce";
import {
  CaseSupportRepository,
  CaseSupportService,
} from "@qooqnos/case-support";
import {
  CommunicationRepository,
  CommunicationService,
} from "@qooqnos/communication";
import {
  FulfillmentRepository,
  FulfillmentService,
} from "@qooqnos/fulfillment";
import {
  AuthorizationRegistry,
  CapabilityRegistry,
  createAuthorizationService,
} from "@qooqnos/runtime";
import type { D1Database } from "@qooqnos/database";

export interface CapabilityCompositionOptions {
  readonly database: D1Database;
  readonly authorization: AuthorizationRegistry;
}

export function createApiCapabilityRegistry(
  options: CapabilityCompositionOptions,
): CapabilityRegistry {
  const registry = new CapabilityRegistry();
  const authorization = createAuthorizationService(
    new AuthorizationRepository(options.database),
    options.authorization,
  );

  const booking = new BookingService({
    repository: new BookingRepository(options.database),
    authorization,
    id: () => entityId(crypto.randomUUID()),
    now: () => new Date().toISOString(),
  });

  const commerce = new CommerceService({
    repository: new CommerceRepository(options.database),
    authorization,
    id: () => entityId(crypto.randomUUID()),
    now: () => new Date().toISOString(),
  });

  const availability = new AvailabilityService({
    repository: new AvailabilityRepository(options.database),
    authorization,
    id: () => entityId(crypto.randomUUID()),
    now: () => new Date().toISOString(),
  });

  const caseSupport = new CaseSupportService({
    repository: new CaseSupportRepository(options.database),
    authorization,
    id: () => entityId(crypto.randomUUID()),
    now: () => new Date().toISOString(),
  });

  const communication = new CommunicationService({
    repository: new CommunicationRepository(options.database),
    authorization,
    id: () => entityId(crypto.randomUUID()),
    now: () => new Date().toISOString(),
  });

  const fulfillment = new FulfillmentService({
    repository: new FulfillmentRepository(options.database),
    authorization,
    id: () => entityId(crypto.randomUUID()),
    now: () => new Date().toISOString(),
  });

  registerAliases(registry, [
    {
      ids: ["CAP.BOOKING.CREATE", "booking.create"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Booking create input");
        return booking.create(requestContext, {
          businessId: requireId(body.businessId, "businessId"),
          customerId: requireId(body.customerId, "customerId"),
          currency: requireString(body.currency, "currency"),
          ...(body.totalAmountMinor !== undefined
            ? { totalAmountMinor: requireInteger(body.totalAmountMinor, "totalAmountMinor") }
            : {}),
          ...(body.policySnapshot !== undefined
            ? { policySnapshot: requireString(body.policySnapshot, "policySnapshot") }
            : {}),
          idempotencyKey: requireString(
            body.idempotencyKey ?? ("capability:" + requestContext.correlationId),
            "idempotencyKey",
          ),
        });
      },
    },
    {
      ids: ["CAP.BOOKING.CHECK_AVAILABILITY", "booking.check_availability"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Availability check input");
        return availability.checkAvailability(requestContext, {
          scheduleId: requireId(body.scheduleId, "scheduleId"),
          startsAt: requireString(body.startsAt, "startsAt"),
          endsAt: requireString(body.endsAt, "endsAt"),
          durationSeconds: requireInteger(body.durationSeconds, "durationSeconds"),
          ...(body.resourceId !== undefined ? { resourceId: requireId(body.resourceId, "resourceId") } : {}),
        });
      },
    },
    {
      ids: ["CAP.BOOKING.GET_SLOTS", "booking.get_slots"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Availability slots input");
        return availability.getSlots(requestContext, {
          scheduleId: requireId(body.scheduleId, "scheduleId"),
          from: requireString(body.from, "from"),
          to: requireString(body.to, "to"),
          durationSeconds: requireInteger(body.durationSeconds, "durationSeconds"),
          ...(body.resourceId !== undefined ? { resourceId: requireId(body.resourceId, "resourceId") } : {}),
        });
      },
    },
    {
      ids: ["CAP.BOOKING.RESCHEDULE", "booking.reschedule"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Booking reschedule input");
        return booking.setStatus(requestContext, requireId(body.bookingId ?? body.targetReference, "bookingId"), "rescheduled");
      },
    },
    {
      ids: ["CAP.COMMERCE.CREATE_CART", "commerce.cart.create"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Commerce cart input");
        return commerce.createCart(requestContext, {
          ...(body.customerId !== undefined ? { customerId: requireId(body.customerId, "customerId") } : {}),
          actorReference: requireString(body.actorReference ?? requestContext.actorId, "actorReference"),
          currency: requireString(body.currency, "currency"),
          ...(body.expiresAt !== undefined ? { expiresAt: requireString(body.expiresAt, "expiresAt") } : {}),
        });
      },
    },
    {
      ids: ["CAP.COMMERCE.ADD_ITEM", "commerce.cart.add_item"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Commerce cart line input");
        return commerce.addCartLine(requestContext, {
          cartId: requireId(body.cartId, "cartId"),
          resourceType: requireEnum(body.resourceType, "resourceType", ["offering", "product_variant", "service"] as const),
          resourceId: requireId(body.resourceId, "resourceId"),
          ...(body.variantReference !== undefined ? { variantReference: requireString(body.variantReference, "variantReference") } : {}),
          quantity: requireInteger(body.quantity, "quantity"),
          ...(body.selectedOptions !== undefined ? { selectedOptions: requireObject(body.selectedOptions, "selectedOptions") } : {}),
          ...(body.sourceReference !== undefined ? { sourceReference: requireString(body.sourceReference, "sourceReference") } : {}),
        });
      },
    },
    {
      ids: ["CAP.COMMERCE.CREATE_ORDER", "commerce.order.create"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Commerce order input");
        return commerce.createOrder(requestContext, {
          businessId: requireId(body.businessId, "businessId"),
          customerId: requireId(body.customerId, "customerId"),
          ...(body.priceSnapshotId !== undefined ? { priceSnapshotId: requireId(body.priceSnapshotId, "priceSnapshotId") } : {}),
          currency: requireString(body.currency, "currency"),
          subtotalMinor: requireInteger(body.subtotalMinor, "subtotalMinor"),
          adjustmentTotalMinor: requireInteger(body.adjustmentTotalMinor ?? 0, "adjustmentTotalMinor"),
          taxTotalMinor: requireInteger(body.taxTotalMinor ?? 0, "taxTotalMinor"),
          feeTotalMinor: requireInteger(body.feeTotalMinor ?? 0, "feeTotalMinor"),
          grandTotalMinor: requireInteger(body.grandTotalMinor, "grandTotalMinor"),
          sourceChannel: requireEnum(body.sourceChannel, "sourceChannel", ["web", "app", "agent", "api", "ai_tool"] as const),
          policyVersion: requireString(body.policyVersion, "policyVersion"),
          idempotencyKey: requireString(body.idempotencyKey ?? ("capability:" + requestContext.correlationId), "idempotencyKey"),
        });
      },
    },
    {
      ids: ["CAP.CASE.CREATE", "case.create"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Case create input");
        return caseSupport.create(requestContext, {
          caseTypeId: requireId(body.caseTypeId, "caseTypeId"),
          priority: requireEnum(body.priority, "priority", ["low", "normal", "high", "urgent"] as const),
          severity: requireString(body.severity, "severity"),
          subjectType: requireString(body.subjectType, "subjectType"),
          subjectId: requireId(body.subjectId, "subjectId"),
          requesterType: requireString(body.requesterType, "requesterType"),
          requesterId: requireId(body.requesterId, "requesterId"),
          sourceType: requireString(body.sourceType, "sourceType"),
          ...(body.sourceReference !== undefined ? { sourceReference: requireString(body.sourceReference, "sourceReference") } : {}),
          ...(body.queueId !== undefined ? { queueId: requireId(body.queueId, "queueId") } : {}),
          ...(body.slaId !== undefined ? { slaId: requireId(body.slaId, "slaId") } : {}),
        });
      },
    },
    {
      ids: ["CAP.CASE.GET", "case.get"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Case get input");
        return caseSupport.get(requestContext, requireId(body.caseId ?? body.targetReference, "caseId"));
      },
    },
    {
      ids: ["CAP.CASE.TRIAGE", "case.triage"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Case triage input");
        return caseSupport.transition(requestContext, {
          id: requireId(body.caseId, "caseId"),
          status: "triaged",
          expectedVersion: requireInteger(body.expectedVersion, "expectedVersion"),
          ...(body.reason !== undefined ? { reason: requireString(body.reason, "reason") } : {}),
        });
      },
    },
    {
      ids: ["CAP.CASE.ASSIGN", "case.assign"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Case assignment input");
        return caseSupport.assign(requestContext, {
          id: requireId(body.caseId, "caseId"),
          ...(body.queueId !== undefined ? { queueId: requireId(body.queueId, "queueId") } : {}),
          assigneeType: requireString(body.assigneeType, "assigneeType"),
          assigneeId: requireString(body.assigneeId, "assigneeId"),
          assignedBy: requireString(body.assignedBy, "assignedBy"),
          ...(body.reason !== undefined ? { reason: requireString(body.reason, "reason") } : {}),
          expectedVersion: requireInteger(body.expectedVersion, "expectedVersion"),
        });
      },
    },
    {
      ids: ["CAP.CASE.ESCALATE", "case.escalate"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Case escalation input");
        return caseSupport.escalate(requestContext, {
          caseId: requireId(body.caseId, "caseId"),
          escalationType: requireString(body.escalationType, "escalationType"),
          reason: requireString(body.reason, "reason"),
          ...(body.targetQueueId !== undefined ? { targetQueueId: requireId(body.targetQueueId, "targetQueueId") } : {}),
          ...(body.targetActorId !== undefined ? { targetActorId: requireString(body.targetActorId, "targetActorId") } : {}),
          policyVersion: requireString(body.policyVersion, "policyVersion"),
          requestedBy: requireString(body.requestedBy, "requestedBy"),
          expectedVersion: requireInteger(body.expectedVersion, "expectedVersion"),
        });
      },
    },
    {
      ids: ["CAP.CASE.RESOLVE", "case.resolve"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Case resolve input");
        return caseSupport.resolve(requestContext, {
          caseId: requireId(body.caseId, "caseId"),
          outcomeCode: requireString(body.outcomeCode, "outcomeCode"),
          summaryReference: requireString(body.summaryReference, "summaryReference"),
          resolverId: requireString(body.resolverId, "resolverId"),
          authoritativeReferences: requireStringArray(body.authoritativeReferences, "authoritativeReferences"),
          followUpRequired: requireBoolean(body.followUpRequired, "followUpRequired"),
          expectedVersion: requireInteger(body.expectedVersion, "expectedVersion"),
        });
      },
    },
    {
      ids: ["CAP.FULFILLMENT.CREATE", "fulfillment.create"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Fulfillment create input");
        return fulfillment.create(requestContext, {
          sourceType: requireEnum(body.sourceType, "sourceType", ["commerce_order", "booking"] as const),
          sourceId: requireId(body.sourceId, "sourceId"),
          businessId: requireId(body.businessId, "businessId"),
          fulfillmentType: requireEnum(body.fulfillmentType, "fulfillmentType", ["physical", "digital", "service", "hybrid"] as const),
        });
      },
    },
    {
      ids: ["CAP.FULFILLMENT.PLAN", "fulfillment.plan"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Fulfillment plan input");
        return fulfillment.createPlan(requestContext, {
          fulfillmentId: requireId(body.fulfillmentId, "fulfillmentId"),
          version: requireInteger(body.version, "version"),
          strategy: requireString(body.strategy, "strategy"),
          createdBy: requireString(body.createdBy, "createdBy"),
          ...(body.supersedesPlanId !== undefined ? { supersedesPlanId: requireId(body.supersedesPlanId, "supersedesPlanId") } : {}),
        });
      },
    },
    {
      ids: ["CAP.FULFILLMENT.ASSIGN", "fulfillment.assign"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Fulfillment assign input");
        return fulfillment.assignTask(requestContext, {
          fulfillmentTaskId: requireId(body.fulfillmentTaskId, "fulfillmentTaskId"),
          actorRef: requireString(body.actorRef, "actorRef"),
          actorType: requireString(body.actorType, "actorType"),
          assignedBy: requireString(body.assignedBy, "assignedBy"),
        });
      },
    },
    {
      ids: ["CAP.FULFILLMENT.START", "fulfillment.start"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Fulfillment task start input");
        return fulfillment.setTaskStatus(requestContext, {
          fulfillmentTaskId: requireId(body.fulfillmentTaskId, "fulfillmentTaskId"),
          status: "in_progress",
          ...(body.reasonCode !== undefined ? { reasonCode: requireString(body.reasonCode, "reasonCode") } : {}),
        });
      },
    },
    {
      ids: ["CAP.FULFILLMENT.CREATE_EXCEPTION", "fulfillment.create_exception"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Fulfillment exception input");
        return fulfillment.createException(requestContext, {
          fulfillmentId: requireId(body.fulfillmentId, "fulfillmentId"),
          ...(body.fulfillmentItemId !== undefined ? { fulfillmentItemId: requireId(body.fulfillmentItemId, "fulfillmentItemId") } : {}),
          exceptionType: requireString(body.exceptionType, "exceptionType"),
          severity: requireEnum(body.severity, "severity", ["low", "medium", "high", "critical"] as const),
          reasonCode: requireString(body.reasonCode, "reasonCode"),
          detectedAt: requireString(body.detectedAt, "detectedAt"),
          detectedBy: requireString(body.detectedBy, "detectedBy"),
        });
      },
    },
    {
      ids: ["CAP.FULFILLMENT.RESOLVE_EXCEPTION", "fulfillment.resolve_exception"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Fulfillment exception resolution input");
        return fulfillment.resolveException(requestContext, {
          id: requireId(body.exceptionId, "exceptionId"),
          resolutionCode: requireString(body.resolutionCode, "resolutionCode"),
          resolvedBy: requireString(body.resolvedBy, "resolvedBy"),
          ...(body.reworkTaskRef !== undefined ? { reworkTaskRef: requireString(body.reworkTaskRef, "reworkTaskRef") } : {}),
        });
      },
    },

    {
      ids: ["CAP.BOOKING.CONFIRM", "booking.confirm"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Booking confirmation input");
        const bookingId = requireId(body.bookingId ?? body.targetReference, "bookingId");
        return booking.setStatus(requestContext, bookingId, "confirmed");
      },
    },
    {
      ids: ["CAP.BOOKING.CANCEL", "booking.cancel"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Booking cancellation input");
        const bookingId = requireId(body.bookingId ?? body.targetReference, "bookingId");
        return booking.setStatus(requestContext, bookingId, "cancelled");
      },
    },
    {
      ids: ["CAP.BOOKING.COMPLETE", "booking.complete"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Booking completion input");
        const bookingId = requireId(body.bookingId ?? body.targetReference, "bookingId");
        return booking.setStatus(requestContext, bookingId, "completed");
      },
    },
    {
      ids: ["CAP.BOOKING.HOLD_SLOT", "booking.hold_slot"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Booking hold input");
        return booking.createHold(requestContext, {
          businessId: requireId(body.businessId, "businessId"),
          ...(body.resourceId !== undefined ? { resourceId: requireId(body.resourceId, "resourceId") } : {}),
          slotReference: requireString(body.slotReference, "slotReference"),
          ...(body.actorReference !== undefined ? { actorReference: requireString(body.actorReference, "actorReference") } : {}),
          expiresAt: requireString(body.expiresAt, "expiresAt"),
        });
      },
    },
    {
      ids: ["CAP.BOOKING.RELEASE_SLOT", "booking.release_slot"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Booking release input");
        const holdId = requireId(body.holdId ?? body.targetReference, "holdId");
        return booking.releaseHold(
          requestContext,
          holdId,
          body.status === "expired" || body.status === "consumed" ? body.status : "released",
        );
      },
    },
    {
      ids: ["CAP.COMMERCE.ORDER.CANCEL", "commerce.order.cancel"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Commerce cancellation input");
        return commerce.setOrderStatus(
          requestContext,
          requireId(body.orderId ?? body.targetReference, "orderId"),
          "cancelled",
        );
      },
    },
    {
      ids: ["CAP.COMMERCE.ORDER.COMPLETE", "commerce.order.complete"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Commerce completion input");
        return commerce.setOrderStatus(
          requestContext,
          requireId(body.orderId ?? body.targetReference, "orderId"),
          "completed",
        );
      },
    },
    {
      ids: ["CAP.COMMERCE.ORDER.REQUEST_REFUND", "commerce.order.request_refund"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Commerce refund input");
        return commerce.setOrderStatus(
          requestContext,
          requireId(body.orderId ?? body.targetReference, "orderId"),
          "refund_pending",
        );
      },
    },
    {
      ids: ["CAP.COMMUNICATION.CREATE_CONVERSATION", "communication.conversation.create"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Conversation input");
        return communication.createConversation(requestContext, {
          ...(body.customerId !== undefined
            ? { customerId: requireId(body.customerId, "customerId") }
            : {}),
        });
      },
    },
    {
      ids: ["CAP.COMMUNICATION.SEND_MESSAGE", "communication.message.send"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Communication message input");
        return communication.sendMessage(requestContext, {
          conversationId: requireId(body.conversationId, "conversationId"),
          content: requireString(body.content, "content"),
          classification: requireString(body.classification, "classification"),
        });
      },
    },
    {
      ids: ["CAP.COMMUNICATION.SEND_NOTIFICATION", "communication.notification.send"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Communication notification input");
        return communication.sendNotification(requestContext, {
          recipientReference: requireString(body.recipientReference, "recipientReference"),
          intent: requireString(body.intent, "intent"),
          channel: requireEnum(body.channel, "channel", ["in_app", "whatsapp", "sms", "email", "push"] as const),
          ...(body.templateReference !== undefined ? { templateReference: requireString(body.templateReference, "templateReference") } : {}),
          ...(body.templateVersion !== undefined ? { templateVersion: requireString(body.templateVersion, "templateVersion") } : {}),
          ...(body.locale !== undefined ? { locale: requireString(body.locale, "locale") } : {}),
          ...(body.variables !== undefined ? { variables: requireObject(body.variables, "variables") } : {}),
          ...(body.priority !== undefined ? { priority: requireEnum(body.priority, "priority", ["low", "normal", "high", "urgent"] as const) } : {}),
          idempotencyKey: requireString(
            body.idempotencyKey ?? ("capability:" + requestContext.correlationId + ":" + requestContext.operation),
            "idempotencyKey",
          ),
          ...(body.scheduledAt !== undefined ? { scheduledAt: requireString(body.scheduledAt, "scheduledAt") } : {}),
          ...(body.expiresAt !== undefined ? { expiresAt: requireString(body.expiresAt, "expiresAt") } : {}),
        });
      },
    },
    {
      ids: ["CAP.FULFILLMENT.UPDATE_STATUS", "fulfillment.update_status"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Fulfillment status input");
        return fulfillment.setStatus(
          requestContext,
          requireId(body.fulfillmentId ?? body.targetReference, "fulfillmentId"),
          requireString(body.status, "status") as Parameters<FulfillmentService["setStatus"]>[2],
          body.reasonCode !== undefined ? requireString(body.reasonCode, "reasonCode") : undefined,
        );
      },
    },
    {
      ids: ["CAP.FULFILLMENT.CONFIRM_DELIVERY", "fulfillment.confirm_delivery"],
      handler: async ({ requestContext, input }) => {
        const body = requireObject(input, "Fulfillment delivery input");
        return fulfillment.setShipmentStatus(requestContext, {
          shipmentId: requireId(body.shipmentId ?? body.targetReference, "shipmentId"),
          status: "delivered",
          ...(body.proofOfDeliveryRef !== undefined
            ? { proofOfDeliveryRef: requireString(body.proofOfDeliveryRef, "proofOfDeliveryRef") }
            : {}),
          ...(body.reasonCode !== undefined ? { reasonCode: requireString(body.reasonCode, "reasonCode") } : {}),
        });
      },
    },
  ]);

  return registry;
}

interface AliasDefinition {
  readonly ids: readonly string[];
  readonly handler: Parameters<CapabilityRegistry["register"]>[0]["handler"];
}

function registerAliases(registry: CapabilityRegistry, definitions: readonly AliasDefinition[]): void {
  for (const definition of definitions) {
    for (const id of definition.ids) {
      registry.register({ id, handler: definition.handler });
    }
  }
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(label + " must be an object");
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(name + " is required");
  return value.trim();
}

function requireId(value: unknown, name: string): EntityId {
  return entityId(requireString(value, name));
}

function requireInteger(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value)) throw new Error(name + " must be an integer");
  return value as number;
}

function requireBoolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") throw new Error(name + " must be boolean");
  return value;
}

function requireStringArray(value: unknown, name: string): readonly string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.trim())) {
    throw new Error(name + " must be a non-empty string array");
  }
  return value.map((item) => String(item).trim());
}


function requireEnum<T extends string>(
  value: unknown,
  name: string,
  values: readonly T[],
): T {
  const normalized = requireString(value, name);
  if (!values.includes(normalized as T)) throw new Error(name + " is invalid");
  return normalized as T;
}

function entityId(value: string): EntityId {
  return value as EntityId;
}
