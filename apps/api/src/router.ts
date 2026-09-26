import type { RequestId } from "@qooqnos/core";
import type { AuthorizationRegistry, AuthorizationSubject } from "@qooqnos/runtime";
import type { D1Database } from "@qooqnos/database";
import type { ApiEnv } from "./env";
import type { ApiRequestContext } from "./context";
import { createRequestContext, getCorrelationId, getRequestId } from "./context";
import { resolveRequestAuth } from "./auth-context";
import { errorResponse, json } from "./http";
import { registerDiscoveryRoutes } from "./discovery-routes";
import { registerMatchingRoutes } from "./matching-routes";
import { registerBookingRoutes } from "./booking-routes";
import { registerCommerceRoutes } from "./commerce-routes";
import { registerCommunicationRoutes } from "./communication-routes";
import { registerTrustRoutes } from "./trust-routes";
import { registerPrivacyRoutes } from "./privacy-routes";
import { registerAutomationRoutes } from "./automation-routes";
import { registerIntegrationRoutes } from "./integration-routes";
import { registerFulfillmentRoutes } from "./fulfillment-routes";
import { registerBillingRoutes } from "./billing-routes";
import { registerCaseSupportRoutes } from "./case-support-routes";
import { registerCustomerRoutes } from "./customer-routes";
import { registerSeoRoutes } from "./seo-routes";
import { registerSocialEngagementRoutes } from "./social-engagement-routes";

export interface ApiRouteContext {
  readonly request: Request;
  readonly context: ApiRequestContext;
  readonly subject: AuthorizationSubject;
  readonly params: Readonly<Record<string, string>>;
  readonly authenticatedSessionId?: string | undefined;
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
  readonly seoCanonicalBaseUrl?: string;
  readonly seoEnvironment?: ApiEnv;
}

interface MatchedRoute {
  readonly route: ApiRoute;
  readonly params: Readonly<Record<string, string>>;
}

export class ApiRouter {
  private readonly routes: ApiRoute[] = [];

  constructor(private readonly options: ApiRouterOptions = {}) {
    registerDiscoveryRoutes(this, options.database);
    registerMatchingRoutes(this, options.database, options.authorization);
    registerBookingRoutes(this, options.database, options.authorization);
    registerCommerceRoutes(this, options.database, options.authorization);
    registerCommunicationRoutes(this, options.database, options.authorization);
    registerTrustRoutes(this, options.database, options.authorization);
    registerPrivacyRoutes(this, options.database, options.authorization);
    registerAutomationRoutes(this, options.database, options.authorization);
    registerIntegrationRoutes(this, options.database, options.authorization);
    registerFulfillmentRoutes(this, options.database, options.authorization);
    registerBillingRoutes(this, options.database, options.authorization);
    registerCaseSupportRoutes(this, options.database, options.authorization);
    registerCustomerRoutes(this, options.database, options.authorization);
    registerSeoRoutes(this, options.database, options.seoCanonicalBaseUrl ?? "https://qooqnos.com", options.seoEnvironment);
    registerSocialEngagementRoutes(this, options.database);
  }

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
    const match = this.routes
      .filter((item) => item.method === request.method.toUpperCase())
      .map((route) => matchPath(route, url.pathname))
      .find((candidate): candidate is MatchedRoute => candidate !== null);
    const requestId = getRequestId(request) as RequestId;

    if (!match) {
      return json({ error: { code: "NOT_FOUND", message: "Route not found." } }, 404, requestId);
    }

    const { route, params } = match;
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

      const response = await route.handler({
        request,
        context,
        subject: auth.subject,
        params,
        ...(auth.authenticatedSessionId ? { authenticatedSessionId: auth.authenticatedSessionId } : {}),
      });
      const headers = new Headers(response.headers);
      headers.set("x-request-id", context.requestId);
      headers.set("x-correlation-id", context.correlationId);
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      return errorResponse(error, initialContext.requestId);
    }
  }
}

function matchPath(route: ApiRoute, pathname: string): MatchedRoute | null {
  const routeSegments = splitPath(route.path);
  const requestSegments = splitPath(pathname);
  if (routeSegments.length !== requestSegments.length) return null;

  const params: Record<string, string> = {};
  for (let index = 0; index < routeSegments.length; index += 1) {
    const routeSegment = routeSegments[index]!;
    const requestSegment = requestSegments[index]!;
    if (routeSegment.startsWith(":")) {
      const name = routeSegment.slice(1);
      if (!name || name.includes(":")) return null;
      try {
        params[name] = decodeURIComponent(requestSegment);
      } catch {
        return null;
      }
      continue;
    }
    if (routeSegment !== requestSegment) return null;
  }

  return { route, params };
}

function splitPath(pathname: string): string[] {
  if (pathname === "/") return [];
  return pathname.replace(/^\/+|\/+$/g, "").split("/");
}
