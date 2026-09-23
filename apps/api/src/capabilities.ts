import type { EntityId } from "@qooqnos/core";
import {
  AuthorizationRepository,
} from "@qooqnos/database";
import {
  BookingRepository,
  BookingService,
} from "@qooqnos/booking";
import {
  CommerceRepository,
  CommerceService,
} from "@qooqnos/commerce";
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
          channel: requireEnum(body.channel, "channel", ["in_app", "whatsapp", "sms", "email"] as const),
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
