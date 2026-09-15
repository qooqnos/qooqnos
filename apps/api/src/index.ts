import { BusinessService, BusinessRepository } from "@qooqnos/business";
import { CatalogService, CatalogRepository } from "@qooqnos/catalog";
import { AppError, brandId } from "@qooqnos/core";
import { AuthorizationRepository, CatalogCommandRepository } from "@qooqnos/database";
import type { D1Database } from "@qooqnos/database";
import { SessionRepository, sha256Hex } from "@qooqnos/database";
import { createAuthorizationService } from "@qooqnos/runtime";
import { ApiRouter } from "./router";
import { createRequestContext } from "./context";
import { html, json } from "./http";
import type { ApiEnv } from "./env";
import { getDatabase } from "./database";
import { checkDatabase } from "./readiness";
import { createApiAuthorizationRegistry, ensureRuntimeBoot } from "./runtime";

const homePage = (version: string): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Qooqnos — Phoenix AI Marketplace" />
    <title>Qooqnos — Phoenix AI Marketplace</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: #080b12; color: #f5f7fb; }
      main { width: min(960px, calc(100% - 40px)); margin: 0 auto; padding: 96px 0; }
      .badge { display: inline-block; padding: 7px 12px; border: 1px solid #293246; border-radius: 999px; color: #aeb9ce; font-size: 13px; }
      h1 { max-width: 760px; margin: 24px 0 16px; font-size: clamp(44px, 8vw, 76px); line-height: .98; letter-spacing: -.04em; }
      p { max-width: 680px; color: #aeb9ce; font-size: 18px; line-height: 1.7; }
      .actions { display: flex; gap: 12px; margin-top: 32px; flex-wrap: wrap; }
      a { display: inline-block; padding: 12px 18px; border-radius: 10px; text-decoration: none; font-weight: 650; }
      .primary { background: #f5f7fb; color: #080b12; }
      .secondary { border: 1px solid #293246; color: #f5f7fb; }
      footer { margin-top: 80px; color: #66738b; font-size: 13px; }
    </style>
  </head>
  <body>
    <main>
      <span class="badge">Phoenix AI Marketplace</span>
      <h1>Qooqnos is coming to life.</h1>
      <p>
        The Phoenix platform foundation is online. This deployment currently exposes
        the API boundary and its health/readiness services while the marketplace
        experience is being built.
      </p>
      <div class="actions">
        <a class="primary" href="/health">System health</a>
        <a class="secondary" href="/ready">Readiness</a>
      </div>
      <footer>Qooqnos · Phoenix · v${version}</footer>
    </main>
  </body>
</html>`;

function createRouter(version: string, database: D1Database | undefined): ApiRouter {
  const authorization = createApiAuthorizationRegistry();
  const router = new ApiRouter({ authorization, ...(database ? { database } : {}) });

  router.register({
    method: "GET",
    path: "/health",
    module: "platform",
    operation: "health.read",
    handler: ({ context }) =>
      json({ status: "healthy", timestamp: new Date().toISOString(), version }, 200, context.requestId),
  });

  router.register({
    method: "GET",
    path: "/ready",
    module: "platform",
    operation: "readiness.read",
    handler: async ({ context }) => {
      try {
        await ensureRuntimeBoot(envForRuntime(version, database));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Runtime boot failed.";
        return json({ status: "not_ready", checks: { runtime: "unavailable", reason: message }, timestamp: new Date().toISOString() }, 503, context.requestId);
      }
      const checks = await checkDatabase(database);
      const ready = checks.database === "ok" && checks.migrationRegistry === "ok";
      return json({ status: ready ? "ready" : "not_ready", checks, timestamp: new Date().toISOString(), version }, ready ? 200 : 503, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/context",
    module: "platform",
    operation: "context.read",
    permission: "context:read",
    requireAuthentication: true,
    handler: ({ context }) => json({ context }, 200, context.requestId),
  });

  router.register({
    method: "GET",
    path: "/api/v1/session",
    module: "auth",
    operation: "session.read",
    requireAuthentication: true,
    handler: ({ context }) =>
      json({
        session: {
          id: context.authenticatedSessionId,
          actorId: context.actorId,
          tenantId: context.tenantId,
          workspaceId: context.workspaceId,
        },
      }, 200, context.requestId),
  });

  router.register({
    method: "POST",
    path: "/api/v1/session/revoke",
    module: "auth",
    operation: "session.revoke",
    requireAuthentication: true,
    handler: async ({ context, authenticatedSessionId }) => {
      if (!database || !authenticatedSessionId) throw new AppError("DATABASE_UNAVAILABLE", "Database is unavailable", { status: 503 });
      const sessionRepository = new SessionRepository(database);
      await sessionRepository.revokeById(context, authenticatedSessionId, new Date().toISOString());
      return json({ revoked: true, sessionId: authenticatedSessionId }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/businesses",
    module: "business",
    operation: "business.create",
    permission: "business.create",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ request, context }) => {
      if (!database || !context.tenantId || !context.workspaceId) throw new AppError("DATABASE_UNAVAILABLE", "Database is unavailable", { status: 503 });
      const idempotencyKey = requiredIdempotencyKey(request);
      const payload = await parseJsonCommand(request);
      if (!isCreateBusinessCommand(payload)) throw new AppError("VALIDATION_ERROR", "Invalid business command", { status: 400 });
      const service = new BusinessService({
        repository: new BusinessRepository(database),
        id: () => brandId<"EntityId">(crypto.randomUUID()),
        now: () => new Date().toISOString(),
      });
      const command = {
        ...payload,
        idempotencyKey,
        requestFingerprint: await sha256Hex(stableStringify(payload)),
      };
      const result = await service.createAtomic(context, command);
      return json({ business: result.business, auditId: result.auditId }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/catalog/products",
    module: "catalog",
    operation: "catalog.product.create",
    permission: "catalog.product.create",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ request, context }) => {
      if (!database || !context.tenantId || !context.workspaceId) throw new AppError("DATABASE_UNAVAILABLE", "Database is unavailable", { status: 503 });
      const idempotencyKey = requiredIdempotencyKey(request);
      const payload = await parseJsonCommand(request);
      if (!isCreateProductCommand(payload)) throw new AppError("VALIDATION_ERROR", "Invalid product command", { status: 400 });
      const authorization = createAuthorizationService(new AuthorizationRepository(database), createApiAuthorizationRegistry());
      const service = new CatalogService({
        repository: new CatalogRepository(database),
        commands: new CatalogCommandRepository(database),
        authorization,
        id: () => brandId<"EntityId">(crypto.randomUUID()),
        now: () => new Date().toISOString(),
      });
      const result = await service.createProduct(context, {
        businessId: brandId<"EntityId">(payload.businessId),
        name: payload.name,
        ...(payload.description !== undefined ? { description: payload.description } : {}),
        idempotencyKey,
        requestFingerprint: await sha256Hex(stableStringify(payload)),
      });
      return json({ product: result }, 201, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/business-access",
    module: "business",
    operation: "business.access.read",
    permission: "business.create",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: ({ context }) => json({ tenantId: context.tenantId, workspaceId: context.workspaceId, actorId: context.actorId }, 200, context.requestId),
  });

  router.register({
    method: "GET",
    path: "/",
    module: "platform",
    operation: "platform.home",
    handler: () => html(homePage(version), 200),
  });

  return router;
}

function requiredIdempotencyKey(request: Request): string {
  const value = request.headers.get("idempotency-key")?.trim();
  if (!value) throw new AppError("IDEMPOTENCY_REQUIRED", "Idempotency-Key header is required", { status: 400 });
  if (value.length > 200) throw new AppError("VALIDATION_ERROR", "Idempotency-Key is too long", { status: 400 });
  return value;
}

async function parseJsonCommand(request: Request): Promise<Record<string, unknown>> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON", { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new AppError("VALIDATION_ERROR", "Request body must be a JSON object", { status: 400 });
  return payload as Record<string, unknown>;
}

function isCreateBusinessCommand(payload: Record<string, unknown>): payload is { name: string; slug?: string; description?: string } {
  return typeof payload.name === "string" && payload.name.trim().length > 0 && (payload.slug === undefined || typeof payload.slug === "string") && (payload.description === undefined || typeof payload.description === "string");
}

function isCreateProductCommand(payload: Record<string, unknown>): payload is { businessId: string; name: string; description?: string } {
  return typeof payload.businessId === "string" && payload.businessId.trim().length > 0 && typeof payload.name === "string" && payload.name.trim().length > 0 && (payload.description === undefined || typeof payload.description === "string");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
}

function envForRuntime(version: string, database: D1Database | undefined): ApiEnv {
  return {
    APP_VERSION: version,
    DB: database?.raw,
  };
}

export default {
  async fetch(request: Request, env: ApiEnv): Promise<Response> {
    const database = getDatabase(env.DB);
    const router = createRouter(env.APP_VERSION ?? "0.1.0", database);
    const requestId = request.headers.get("x-request-id")?.trim() ?? crypto.randomUUID();
    const correlationId = request.headers.get("x-correlation-id")?.trim() ?? requestId;
    const workspaceId = request.headers.get("x-workspace-id")?.trim();
    const context = createRequestContext({
      requestId,
      correlationId,
      workspaceId,
      module: "platform",
      operation: "request.handle",
      authenticated: false,
    });
    return router.handle(request, context);
  },
};
