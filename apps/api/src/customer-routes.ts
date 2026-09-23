import {
  CustomerAddressRepository,
  CustomerRelationshipRepository,
  CustomerRepository,
  CrmTimelineRepository,
  AuthorizationRepository,
} from "@qooqnos/database";
import { CustomerService } from "@qooqnos/customer";
import { createAuthorizationService, type AuthorizationRegistry } from "@qooqnos/runtime";
import { AppError, brandId, type EntityId } from "@qooqnos/core";
import type { D1Database } from "@qooqnos/database";
import type { ApiRouter } from "./router";
import { json } from "./http";

export function registerCustomerRoutes(
  router: ApiRouter,
  database: D1Database | undefined,
  authorization: AuthorizationRegistry | undefined,
): void {
  router.register({
    method: "POST",
    path: "/api/v1/customers",
    module: "customer",
    operation: "customer.create",
    permission: "customer.create",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const customer = await service.create(context, {
        organizationId: context.tenantId,
        ...(body.userId !== undefined ? { userId: requiredId(body.userId, "userId", context.requestId) } : {}),
        ...(body.locale !== undefined ? { locale: requiredNullableString(body.locale, "locale", context.requestId) } : {}),
        ...(body.timezone !== undefined ? { timezone: requiredNullableString(body.timezone, "timezone", context.requestId) } : {}),
      });
      return json({ data: customer }, 201, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/customers/:customerId",
    module: "customer",
    operation: "customer.get",
    permission: "customer.read",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, params }) => {
      const service = createService(database, authorization, context.requestId);
      const customer = await service.get(context, requiredParam(params.customerId, context.requestId));
      return json({ data: customer }, 200, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/customers/:customerId/profile",
    module: "customer",
    operation: "customer.get_profile",
    permission: "customer.read",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, params }) => {
      const service = createService(database, authorization, context.requestId);
      const profile = await service.getProfile(context, requiredParam(params.customerId, context.requestId));
      return json({ data: profile }, 200, context.requestId);
    },
  });

  router.register({
    method: "PATCH",
    path: "/api/v1/customers/:customerId/profile",
    module: "customer",
    operation: "customer.update_profile",
    permission: "customer.update_profile",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const profile = await service.updateProfile(context, requiredParam(params.customerId, context.requestId), {
        ...(body.locale !== undefined ? { locale: requiredNullableString(body.locale, "locale", context.requestId) } : {}),
        ...(body.timezone !== undefined ? { timezone: requiredNullableString(body.timezone, "timezone", context.requestId) } : {}),
        ...(body.status !== undefined ? { status: requiredCustomerStatus(body.status, context.requestId) } : {}),
      });
      return json({ data: profile }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/customers/:customerId/preferences",
    module: "customer",
    operation: "customer.manage_preferences",
    permission: "customer.manage_preferences",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const preference = await service.setPreference(context, requiredParam(params.customerId, context.requestId), {
        attribute: requiredString(body.attribute, "attribute", context.requestId),
        valueReference: requiredString(body.valueReference, "valueReference", context.requestId),
        source: requiredString(body.source, "source", context.requestId),
        ...(body.confidence !== undefined ? { confidence: requiredConfidence(body.confidence, context.requestId) } : {}),
        persistence: requiredString(body.persistence, "persistence", context.requestId),
        ...(body.consentScope !== undefined ? { consentScope: requiredNullableString(body.consentScope, "consentScope", context.requestId) ?? undefined } : {}),
        ...(body.expiresAt !== undefined ? { expiresAt: requiredNullableString(body.expiresAt, "expiresAt", context.requestId) ?? undefined } : {}),
      });
      return json({ data: preference }, 201, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/customers/:customerId/preferences",
    module: "customer",
    operation: "customer.read",
    permission: "customer.read",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, params }) => {
      const service = createService(database, authorization, context.requestId);
      const preferences = await service.listPreferences(context, requiredParam(params.customerId, context.requestId));
      return json({ data: preferences }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/customers/:customerId/addresses",
    module: "customer",
    operation: "customer.manage_address",
    permission: "customer.manage_address",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const address = await service.addAddress(context, {
        customerId: requiredParam(params.customerId, context.requestId),
        countryCode: requiredString(body.countryCode, "countryCode", context.requestId),
        ...(body.administrativeArea !== undefined ? { administrativeArea: requiredNullableString(body.administrativeArea, "administrativeArea", context.requestId) ?? undefined } : {}),
        ...(body.locality !== undefined ? { locality: requiredNullableString(body.locality, "locality", context.requestId) ?? undefined } : {}),
        ...(body.district !== undefined ? { district: requiredNullableString(body.district, "district", context.requestId) ?? undefined } : {}),
        ...(body.postalCode !== undefined ? { postalCode: requiredNullableString(body.postalCode, "postalCode", context.requestId) ?? undefined } : {}),
        ...(body.streetLine1 !== undefined ? { streetLine1: requiredNullableString(body.streetLine1, "streetLine1", context.requestId) ?? undefined } : {}),
        ...(body.streetLine2 !== undefined ? { streetLine2: requiredNullableString(body.streetLine2, "streetLine2", context.requestId) ?? undefined } : {}),
        ...(body.buildingNumber !== undefined ? { buildingNumber: requiredNullableString(body.buildingNumber, "buildingNumber", context.requestId) ?? undefined } : {}),
        ...(body.unit !== undefined ? { unit: requiredNullableString(body.unit, "unit", context.requestId) ?? undefined } : {}),
        ...(body.formatted !== undefined ? { formatted: requiredNullableString(body.formatted, "formatted", context.requestId) ?? undefined } : {}),
        ...(body.locale !== undefined ? { locale: requiredNullableString(body.locale, "locale", context.requestId) ?? undefined } : {}),
      });
      return json({ data: address }, 201, context.requestId);
    },
  });

  router.register({
    method: "PATCH",
    path: "/api/v1/customers/addresses/:addressId",
    module: "customer",
    operation: "customer.manage_address",
    permission: "customer.manage_address",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const address = await service.updateAddress(context, requiredParam(params.addressId, context.requestId), {
        countryCode: requiredString(body.countryCode, "countryCode", context.requestId),
        ...(body.administrativeArea !== undefined ? { administrativeArea: requiredNullableString(body.administrativeArea, "administrativeArea", context.requestId) ?? undefined } : {}),
        ...(body.locality !== undefined ? { locality: requiredNullableString(body.locality, "locality", context.requestId) ?? undefined } : {}),
        ...(body.district !== undefined ? { district: requiredNullableString(body.district, "district", context.requestId) ?? undefined } : {}),
        ...(body.postalCode !== undefined ? { postalCode: requiredNullableString(body.postalCode, "postalCode", context.requestId) ?? undefined } : {}),
        ...(body.streetLine1 !== undefined ? { streetLine1: requiredNullableString(body.streetLine1, "streetLine1", context.requestId) ?? undefined } : {}),
        ...(body.streetLine2 !== undefined ? { streetLine2: requiredNullableString(body.streetLine2, "streetLine2", context.requestId) ?? undefined } : {}),
        ...(body.buildingNumber !== undefined ? { buildingNumber: requiredNullableString(body.buildingNumber, "buildingNumber", context.requestId) ?? undefined } : {}),
        ...(body.unit !== undefined ? { unit: requiredNullableString(body.unit, "unit", context.requestId) ?? undefined } : {}),
        ...(body.formatted !== undefined ? { formatted: requiredNullableString(body.formatted, "formatted", context.requestId) ?? undefined } : {}),
        ...(body.locale !== undefined ? { locale: requiredNullableString(body.locale, "locale", context.requestId) ?? undefined } : {}),
      });
      return json({ data: address }, 200, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/customers/:customerId/addresses",
    module: "customer",
    operation: "customer.read",
    permission: "customer.read",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, params }) => {
      const service = createService(database, authorization, context.requestId);
      const addresses = await service.listAddresses(context, requiredParam(params.customerId, context.requestId));
      return json({ data: addresses }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/customers/:customerId/relationships",
    module: "customer",
    operation: "customer.manage_relationship",
    permission: "customer.manage_relationship",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const relationship = await service.createRelationship(context, {
        customerId: requiredParam(params.customerId, context.requestId),
        businessId: requiredId(body.businessId, "businessId", context.requestId),
        relationshipType: requiredString(body.relationshipType, "relationshipType", context.requestId),
        source: requiredString(body.source, "source", context.requestId),
        ...(body.firstInteractionAt !== undefined ? { firstInteractionAt: requiredString(body.firstInteractionAt, "firstInteractionAt", context.requestId) } : {}),
        ...(body.lastInteractionAt !== undefined ? { lastInteractionAt: requiredString(body.lastInteractionAt, "lastInteractionAt", context.requestId) } : {}),
      });
      return json({ data: relationship }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/customers/relationships/:relationshipId/status",
    module: "customer",
    operation: "customer.manage_relationship",
    permission: "customer.manage_relationship",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const relationship = await service.setRelationshipStatus(
        context,
        requiredParam(params.relationshipId, context.requestId),
        requiredRelationshipStatus(body.status, context.requestId),
      );
      return json({ data: relationship }, 200, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/customers/relationships/:relationshipId/history",
    module: "customer",
    operation: "customer.get_history",
    permission: "customer.get_history",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const url = new URL(request.url);
      const limitRaw = url.searchParams.get("limit");
      const limit = limitRaw === null ? 100 : Number(limitRaw);
      if (!Number.isSafeInteger(limit) || limit < 1) {
        throw new AppError({ code: "VALIDATION_ERROR", message: "limit must be a positive integer.", requestId: context.requestId });
      }
      const history = await service.getRelationshipHistory(
        context,
        requiredParam(params.relationshipId, context.requestId),
        Math.min(limit, 500),
      );
      return json({ data: history }, 200, context.requestId);
    },
  });
}

function createService(
  database: D1Database | undefined,
  authorization: AuthorizationRegistry | undefined,
  requestId: EntityId,
): CustomerService {
  if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId });
  if (!authorization) throw new AppError({ code: "INTERNAL_ERROR", message: "Authorization registry is not configured.", requestId });
  return new CustomerService({
    repository: new CustomerRepository(database),
    addressRepository: new CustomerAddressRepository(database),
    relationshipRepository: new CustomerRelationshipRepository(database),
    timelineRepository: new CrmTimelineRepository(database),
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
  if (typeof value !== "string" || !value.trim()) throw new AppError({ code: "VALIDATION_ERROR", message: field + " is required.", requestId });
  return value.trim();
}

function requiredNullableString(value: unknown, field: string, requestId: EntityId): string | null {
  if (value === null) return null;
  return requiredString(value, field, requestId);
}

function requiredId(value: unknown, field: string, requestId: EntityId): EntityId {
  return brandId<"EntityId">(requiredString(value, field, requestId));
}

function requiredParam(value: string | undefined, requestId: EntityId): EntityId {
  if (!value) throw new AppError({ code: "NOT_FOUND", message: "Route parameter is missing.", requestId });
  return brandId<"EntityId">(value);
}

function requiredConfidence(value: unknown, requestId: EntityId): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "confidence must be between 0 and 1.", requestId });
  }
  return value;
}

function requiredCustomerStatus(value: unknown, requestId: EntityId): "active" | "suspended" | "deactivated" {
  if (value === "active" || value === "suspended" || value === "deactivated") return value;
  throw new AppError({ code: "VALIDATION_ERROR", message: "status is invalid.", requestId });
}

function requiredRelationshipStatus(value: unknown, requestId: EntityId): "prospect" | "active" | "inactive" {
  if (value === "prospect" || value === "active" || value === "inactive") return value;
  throw new AppError({ code: "VALIDATION_ERROR", message: "status is invalid.", requestId });
}
