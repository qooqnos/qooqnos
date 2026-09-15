import type { D1Database } from "@qooqnos/database";
import { SessionRepository } from "@qooqnos/database";
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
  const router = new ApiRouter({
    authorization,
    ...(database ? { database } : {}),
  });

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
        return json(
          {
            status: "not_ready",
            checks: { runtime: "unavailable", reason: message },
            timestamp: new Date().toISOString(),
          },
          503,
          context.requestId,
        );
      }

      const result = await checkDatabase(database?.raw());
      const ready = result.database === "ok" && result.migrationRegistry === "ok";
      return json(
        { status: ready ? "ready" : "not_ready", checks: { runtime: "ok", ...result }, timestamp: new Date().toISOString() },
        ready ? 200 : 503,
        context.requestId,
      );
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/context",
    module: "platform",
    operation: "context.read",
    permission: "context:read",
    requireAuthentication: true,
    handler: ({ context, subject }) =>
      json(
        {
          requestId: context.requestId,
          correlationId: context.correlationId,
          actorId: context.actorId,
          tenantId: context.tenantId,
          workspaceId: context.workspaceId,
          module: context.module,
          operation: context.operation,
          authenticated: context.authenticated,
          roles: subject.roles,
          permissions: subject.permissions,
        },
        200,
        context.requestId,
      ),
  });

  router.register({
    method: "GET",
    path: "/api/v1/session",
    module: "identity",
    operation: "session.read",
    requireAuthentication: true,
    handler: ({ context, authenticatedSessionId }) =>
      json(
        {
          session: {
            id: authenticatedSessionId,
            actorId: context.actorId,
            tenantId: context.tenantId,
            workspaceId: context.workspaceId,
            authenticated: context.authenticated,
          },
        },
        200,
        context.requestId,
      ),
  });

  router.register({
    method: "POST",
    path: "/api/v1/session/revoke",
    module: "identity",
    operation: "session.revoke",
    requireAuthentication: true,
    handler: async ({ context, authenticatedSessionId }) => {
      if (!database || !authenticatedSessionId) {
        return json({ revoked: false }, 400, context.requestId);
      }
      const revoked = await new SessionRepository(database).revoke(authenticatedSessionId);
      return json({ revoked }, 200, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/business-access",
    module: "business",
    operation: "business.access",
    permission: "business:create",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: ({ context }) =>
      json({ status: "authorized", tenantId: context.tenantId, workspaceId: context.workspaceId }, 200, context.requestId),
  });

  return router;
}

function envForRuntime(version: string, database: D1Database | undefined): ApiEnv {
  if (!database) return { APP_VERSION: version };
  return {
    APP_VERSION: version,
    DB: database.raw(),
  };
}

export default {
  async fetch(request: Request, env: ApiEnv): Promise<Response> {
    const url = new URL(request.url);
    const version = env.APP_VERSION ?? "development";
    const database = getDatabase(env);

    if (request.method === "GET" && url.pathname === "/") {
      return html(homePage(version));
    }

    return createRouter(version, database ?? undefined).handle(request);
  },
};

export { createRequestContext };
