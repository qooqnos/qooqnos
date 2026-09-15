import type { ApiRequestContext } from "./context";
import { createRequestContext, getCorrelationId, getRequestId } from "./context";
import { errorResponse, json } from "./http";

export interface ApiRouteContext {
  readonly request: Request;
  readonly context: ApiRequestContext;
}

export type ApiRouteHandler = (input: ApiRouteContext) => Response | Promise<Response>;

export interface ApiRoute {
  readonly method: string;
  readonly path: string;
  readonly module: string;
  readonly operation: string;
  readonly handler: ApiRouteHandler;
}

export class ApiRouter {
  private readonly routes: ApiRoute[] = [];

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
    const requestId = getRequestId(request);

    if (!route) {
      return json({ error: { code: "NOT_FOUND", message: "Route not found." } }, 404, requestId as never);
    }

    const context = createRequestContext({
      requestId,
      correlationId: getCorrelationId(request, requestId),
      module: route.module,
      operation: route.operation,
      authenticated: false,
    });

    try {
      const response = await route.handler({ request, context });
      const headers = new Headers(response.headers);
      headers.set("x-request-id", context.requestId);
      headers.set("x-correlation-id", context.correlationId);
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      return errorResponse(error, context.requestId);
    }
  }
}
