export type Brand<T, B extends string> = T & { readonly __brand: B };

export type EntityId = Brand<string, "EntityId">;
export type RequestId = Brand<string, "RequestId">;
export type CorrelationId = Brand<string, "CorrelationId">;
export type CausationId = Brand<string, "CausationId">;

export interface RequestContext {
  readonly requestId: RequestId;
  readonly correlationId: CorrelationId;
  readonly causationId?: CausationId;
  readonly actorId?: EntityId;
  readonly tenantId?: EntityId;
  readonly workspaceId?: EntityId;
  readonly module: string;
  readonly operation: string;
  readonly locale: string;
  readonly timezone: string;
}

export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface AppErrorShape {
  readonly code: AppErrorCode;
  readonly message: string;
  readonly requestId?: RequestId;
  readonly details?: Record<string, unknown>;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly requestId?: RequestId;
  readonly details?: Record<string, unknown>;

  constructor(shape: AppErrorShape) {
    super(shape.message);
    this.name = "AppError";
    this.code = shape.code;
    this.requestId = shape.requestId;
    this.details = shape.details;
  }
}

export interface PageCursor {
  readonly value: string;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor?: PageCursor;
}

export interface Money {
  readonly amountMinor: number;
  readonly currency: string;
}

export function brandId<T extends string>(value: string): Brand<string, T> {
  return value as Brand<string, T>;
}
