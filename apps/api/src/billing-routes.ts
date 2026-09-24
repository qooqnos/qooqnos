import { BillingInvoiceRepository, BillingRepository, BillingService } from "@qooqnos/billing";
import type { AuthorizationRegistry } from "@qooqnos/runtime";
import { AppError, type EntityId } from "@qooqnos/core";
import type { D1Database } from "@qooqnos/database";
import type { ApiRouter } from "./router";
import { json } from "./http";

export function registerBillingRoutes(
  router: ApiRouter,
  database: D1Database | undefined,
  _authorization: AuthorizationRegistry | undefined,
): void {
  router.register({
    method: "GET",
    path: "/api/v1/billing/invoices",
    module: "billing",
    operation: "billing.invoice.read",
    permission: "billing.invoice.read",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request }) => {
      const url = new URL(request.url);
      const limitValue = Number(url.searchParams.get("limit") ?? "50");
      const businessId = url.searchParams.get("business_id")?.trim() || undefined;
      const customerId = url.searchParams.get("customer_id")?.trim() || undefined;
      const repository = new BillingInvoiceRepository(requireDatabase(database, context.requestId));
      const invoices = await repository.list(context, {
        limit: Number.isFinite(limitValue) ? limitValue : 50,
        ...(businessId ? { businessId: businessId as EntityId } : {}),
        ...(customerId ? { customerId: customerId as EntityId } : {}),
      });
      return json({ data: invoices }, 200, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/billing/plans",
    module: "billing",
    operation: "billing.plan.read",
    permission: "billing.plan.read",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request }) => {
      void request;
      const service = createService(database, _authorization, context.requestId);
      const plans = await service.listPlans(context);
      return json({ data: plans }, 200, context.requestId);
    },
  });
}

function requireDatabase(database: D1Database | undefined, requestId: EntityId): D1Database {
  if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId });
  return database;
}

function createService(
  database: D1Database | undefined,
  authorization: AuthorizationRegistry | undefined,
  requestId: EntityId,
): BillingService {
  if (!database) {
    throw new AppError({
      code: "INTERNAL_ERROR",
      message: "Database is not configured.",
      requestId,
    });
  }
  if (!authorization) {
    throw new AppError({
      code: "INTERNAL_ERROR",
      message: "Authorization registry is not configured.",
      requestId,
    });
  }
  return new BillingService({
    repository: new BillingRepository(database),
    id: () => crypto.randomUUID(),
    now: () => new Date().toISOString(),
  });
}
