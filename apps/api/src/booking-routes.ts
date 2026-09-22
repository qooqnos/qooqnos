import { BookingRepository, BookingService } from "@qooqnos/booking";
import { AuthorizationRepository } from "@qooqnos/database";
import { createAuthorizationService, type AuthorizationRegistry } from "@qooqnos/runtime";
import { AppError, brandId, type EntityId } from "@qooqnos/core";
import type { D1Database } from "@qooqnos/database";
import type { ApiRouter } from "./router";
import { json } from "./http";

export function registerBookingRoutes(
  router: ApiRouter,
  database: D1Database | undefined,
  authorization: AuthorizationRegistry | undefined,
): void {
  router.register({
    method: "POST",
    path: "/api/v1/booking/holds",
    module: "booking",
    operation: "booking.hold.create",
    permission: "booking.create",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const hold = await service.createHold(context, {
        businessId: requiredId(body.businessId, "businessId", context.requestId),
        ...(body.resourceId !== undefined ? { resourceId: requiredId(body.resourceId, "resourceId", context.requestId) } : {}),
        slotReference: requiredString(body.slotReference, "slotReference", context.requestId),
        ...(body.actorReference !== undefined ? { actorReference: requiredString(body.actorReference, "actorReference", context.requestId) } : {}),
        expiresAt: requiredString(body.expiresAt, "expiresAt", context.requestId),
      });
      return json({ data: hold }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/booking/finalize",
    module: "booking",
    operation: "booking.finalize",
    permission: "booking.confirm",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const idempotencyKey = requiredIdempotencyKey(request, context.requestId);
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const booking = await service.finalize(context, {
        bookingId: requiredId(body.bookingId, "bookingId", context.requestId),
        idempotencyKey,
        businessId: requiredId(body.businessId, "businessId", context.requestId),
        customerId: requiredId(body.customerId, "customerId", context.requestId),
        offeringId: requiredId(body.offeringId, "offeringId", context.requestId),
        currency: requiredString(body.currency, "currency", context.requestId),
        quantity: requiredPositiveInteger(body.quantity, "quantity", context.requestId),
        titleSnapshot: requiredString(body.titleSnapshot, "titleSnapshot", context.requestId),
        priceMinorSnapshot: requiredNonNegativeInteger(body.priceMinorSnapshot, "priceMinorSnapshot", context.requestId),
        ...(body.durationSecondsSnapshot !== undefined ? { durationSecondsSnapshot: requiredNonNegativeInteger(body.durationSecondsSnapshot, "durationSecondsSnapshot", context.requestId) } : {}),
        ...(body.policySnapshot !== undefined ? { policySnapshot: requiredString(body.policySnapshot, "policySnapshot", context.requestId) } : {}),
        holdId: requiredId(body.holdId, "holdId", context.requestId),
        startsAt: requiredString(body.startsAt, "startsAt", context.requestId),
        endsAt: requiredString(body.endsAt, "endsAt", context.requestId),
        ...(body.timezone !== undefined ? { timezone: requiredString(body.timezone, "timezone", context.requestId) } : {}),
        ...(body.locationId !== undefined ? { locationId: requiredId(body.locationId, "locationId", context.requestId) } : {}),
        ...(body.resourceId !== undefined ? { resourceId: requiredId(body.resourceId, "resourceId", context.requestId) } : {}),
      });
      return json({ data: booking }, 201, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/booking/:bookingId",
    module: "booking",
    operation: "booking.read",
    permission: "booking.read",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, params }) => {
      const repository = createRepository(database, context.requestId);
      const bookingId = brandId<"EntityId">(requiredParam(params.bookingId, context.requestId));
      const booking = await repository.get(context, bookingId);
      if (!booking) throw new AppError({ code: "NOT_FOUND", message: "Booking not found.", requestId: context.requestId });
      const [items, history] = await Promise.all([
        repository.listItems(context, bookingId),
        repository.listStatusHistory(context, bookingId),
      ]);
      return json({ data: { booking, items, history } }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/booking/:bookingId/cancel",
    module: "booking",
    operation: "booking.cancel",
    permission: "booking.cancel",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, params }) => {
      const service = createService(database, authorization, context.requestId);
      const bookingId = brandId<"EntityId">(requiredParam(params.bookingId, context.requestId));
      const booking = await service.setStatus(context, bookingId, "cancelled");
      return json({ data: booking }, 200, context.requestId);
    },
  });
}

function createRepository(database: D1Database | undefined, requestId: EntityId): BookingRepository {
  if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId });
  return new BookingRepository(database);
}

function createService(
  database: D1Database | undefined,
  authorization: AuthorizationRegistry | undefined,
  requestId: EntityId,
): BookingService {
  if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId });
  if (!authorization) throw new AppError({ code: "INTERNAL_ERROR", message: "Authorization registry is not configured.", requestId });
  return new BookingService({
    repository: new BookingRepository(database),
    authorization: createAuthorizationService(new AuthorizationRepository(database), authorization),
    id: () => brandId<"EntityId">(crypto.randomUUID()),
    now: () => new Date().toISOString(),
  });
}

async function bodyObject(request: Request, requestId: EntityId): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Request body must be valid JSON.", requestId });
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Request body must be an object.", requestId });
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string, requestId: EntityId): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError({ code: "VALIDATION_ERROR", message: field + " is required.", requestId });
  }
  return value.trim();
}

function requiredId(value: unknown, field: string, requestId: EntityId): EntityId {
  return brandId<"EntityId">(requiredString(value, field, requestId));
}

function requiredPositiveInteger(value: unknown, field: string, requestId: EntityId): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new AppError({ code: "VALIDATION_ERROR", message: field + " must be a positive integer.", requestId });
  }
  return value as number;
}

function requiredNonNegativeInteger(value: unknown, field: string, requestId: EntityId): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new AppError({ code: "VALIDATION_ERROR", message: field + " must be a non-negative integer.", requestId });
  }
  return value as number;
}

function requiredParam(value: string | undefined, requestId: EntityId): string {
  if (!value) throw new AppError({ code: "NOT_FOUND", message: "Route parameter is missing.", requestId });
  return value;
}

function requiredIdempotencyKey(request: Request, requestId: EntityId): string {
  const value = request.headers.get("idempotency-key")?.trim();
  if (!value) throw new AppError({ code: "VALIDATION_ERROR", message: "Idempotency-Key header is required.", requestId });
  if (value.length > 200) throw new AppError({ code: "VALIDATION_ERROR", message: "Idempotency-Key header is too long.", requestId });
  return value;
}
