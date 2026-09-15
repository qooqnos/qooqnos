import type { RequestId } from "@qooqnos/core";
import type { AuthorizationRegistry, AuthorizationSubject } from "@qooqnos/runtime";
import type { D1Database } from "@qooqnos/database";
import type { ApiRequestContext } from "./context";
import { createRequestContext, getCorrelationId, getRequestId } from "./context";
import { resolveRequestAuth } from "./auth-context";
import { errorResponse, json } from "./http";

export interface ApiRouteContext {
  readonly request: Request;
  readonly context: ApiRequestContext;
  readonly subject: AuthorizationSubject;
}

export type ApiRouteHandler = (input: ApiRouteContext) => Response | Promise<Response>;

export interface ApiRoute {
  readonly method: string;
  readonly path: string;
  readonly module: string;
  readonly operation: string;
  readonly permission?: string;
  readonly requireAuthentication?: boolean;
  readonly requireWorkspace?: boolean;
  readonly handler: ApiRouteHandler;
}

export interface ApiRouterOptions {
  readonly database?: D1Database;
  readonly authorization?: AuthorizationRegistry;
}

export class ApiRouter {
  private readonly routes: ApiRoute[] = [];

  constructor(private readonly options: ApiRouterOptions = {}) {}

  register(route: ApiRoute): void {
    const method = route.method.toUpperCase();
    if (!method || !route.path.startsWith("/")) throw new Error("Invalid API route");
    if (this.routes.some((item) => item.method === method && item.path === route.path)) {
      throw new Error(`Duplicate API route: ${method} ${route.path}`);
    }
    this.routes.push({ ...route, method });
  }

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const route = this.routes.find(
      (item) => item.method === request.method.toUpperCase() && item.path === url.pathname,
    );
    const requestId = getRequestId(request) as RequestId;

    if (!route) {
      return json({ error: { code: "NOT_FOUND", message: "Route not found." } }, 404, requestId);
    }

    const initialContext = createRequestContext({
      requestId,
      correlationId: getCorrelationId(request, requestId),
      module: route.module,
      operation: route.operation,
      authenticated: false,
    });

    try {
      const workspaceHeader = request.headers.get("x-workspace-id")?.trim();
      const authOptions = {
        ...(this.options.database ? { database: this.options.database } : {}),
        ...(workspaceHeader ? { workspaceId: workspaceHeader } : {}),
      };
      const auth = this.options.authorization
        ? await resolveRequestAuth(initialContext, request, authOptions)
        : {
            context: initialContext,
            subject: { roles: [], permissions: [], authenticated: false } as AuthorizationSubject,
          };

      const context = { ...auth.context, authenticated: auth.subject.authenticated };
      if (route.requireAuthentication || route.permission) {
        if (!this.options.authorization) throw new Error("Authorization registry is required for protected routes");
        this.options.authorization.assert({
          context,
          permission: route.permission ?? `${route.module}:access`,
          subject: auth.subject,
          requireAuthentication: route.requireAuthentication ?? true,
          ...(route.requireWorkspace !== undefined ? { requireWorkspace: route.requireWorkspace } : {}),
        });
      }

      const response = await route.handler({ request, context, subject: auth.subject });
      const headers = new Headers(response.headers);
      headers.set("x-request-id", context.requestId);
      headers.set("x-correlation-id", context.correlationId);
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      return errorResponse(error, initialContext.requestId);
    }
  }
}
