import type { EntityId, RequestContext } from "@qooqnos/core";

export interface ApiRequestContext extends RequestContext {
  readonly authenticated: boolean;
}

export interface RequestContextInput {
  readonly requestId?: string | undefined;
  readonly correlationId?: string | undefined;
  readonly causationId?: string | undefined;
  readonly actorId?: string | undefined;
  readonly tenantId?: string | undefined;
  readonly workspaceId?: string | undefined;
  readonly locale?: string | undefined;
  readonly timezone?: string | undefined;
  readonly module: string;
  readonly operation: string;
  readonly authenticated: boolean;
}

export function createRequestContext(input: RequestContextInput): ApiRequestContext {
  const requestId = input.requestId ?? crypto.randomUUID();
  const correlationId = input.correlationId ?? requestId;

  return {
    requestId: requestId as RequestContext["requestId"],
    correlationId: correlationId as RequestContext["correlationId"],
    ...(input.causationId ? { causationId: input.causationId as RequestContext["causationId"] } : {}),
    ...(input.actorId ? { actorId: input.actorId as EntityId } : {}),
    ...(input.tenantId ? { tenantId: input.tenantId as EntityId } : {}),
    ...(input.workspaceId ? { workspaceId: input.workspaceId as EntityId } : {}),
    module: input.module,
    operation: input.operation,
    locale: input.locale ?? "en",
    timezone: input.timezone ?? "UTC",
    authenticated: input.authenticated,
  };
}

export function getRequestId(request: Request): string {
  return request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
}

export function getCorrelationId(request: Request, requestId: string): string {
  return request.headers.get("x-correlation-id")?.trim() || requestId;
}
