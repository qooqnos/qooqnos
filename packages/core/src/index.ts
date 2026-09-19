// ============================================================================
// BRANDED TYPES - Strict entity identifiers
// ============================================================================

export type EntityId = string & { readonly __entityId: true };
export type UserId = EntityId & { readonly __userId: true };
export type WorkspaceId = EntityId & { readonly __workspaceId: true };
export type ServiceId = EntityId & { readonly __serviceId: true };
export type BookingId = EntityId & { readonly __bookingId: true };

export type RequestId = string & { readonly __requestId: true };
export type CorrelationId = string & { readonly __correlationId: true };

export function createEntityId(id: string): EntityId {
  if (!id || id.length === 0) throw new Error("Invalid entity ID");
  return id as EntityId;
}

export function createUserId(id: string): UserId {
  if (!id || id.length === 0) throw new Error("Invalid user ID");
  return id as UserId;
}

export function createWorkspaceId(id: string): WorkspaceId {
  if (!id || id.length === 0) throw new Error("Invalid workspace ID");
  return id as WorkspaceId;
}

export function createServiceId(id: string): ServiceId {
  if (!id || id.length === 0) throw new Error("Invalid service ID");
  return id as ServiceId;
}

export function createBookingId(id: string): BookingId {
  if (!id || id.length === 0) throw new Error("Invalid booking ID");
  return id as BookingId;
}

export function createRequestId(id: string): RequestId {
  if (!id || id.length === 0) throw new Error("Invalid request ID");
  return id as RequestId;
}

export function createCorrelationId(id: string): CorrelationId {
  if (!id || id.length === 0) throw new Error("Invalid correlation ID");
  return id as CorrelationId;
}

// ============================================================================
// DOMAIN EVENTS
// ============================================================================

export interface DomainEvent {
  readonly id: RequestId;
  readonly aggregateId: EntityId;
  readonly aggregateType: string;
  readonly eventType: string;
  readonly timestamp: Date;
  readonly version: number;
  readonly payload: unknown;
}

// ============================================================================
// REPOSITORY INTERFACE
// ============================================================================

export interface Repository<T> {
  create(entity: T): Promise<void>;
  read(id: EntityId): Promise<T | null>;
  update(entity: T): Promise<void>;
  delete(id: EntityId): Promise<void>;
}

// ============================================================================
// AUTHORIZATION
// ============================================================================

export type Permission = "read" | "write" | "delete" | "admin";

export interface AuthContext {
  readonly userId: UserId;
  readonly workspaceId: WorkspaceId;
  readonly permissions: readonly Permission[];
  readonly requestId: RequestId;
  readonly correlationId: CorrelationId;
}

// ============================================================================
// VERIFICATION STATUS
// ============================================================================

export type VerificationStatus = "pending" | "verified" | "rejected";
export type OnboardingStatus = "incomplete" | "complete" | "cancelled";

// ============================================================================
// RESULT TYPE - Error handling
// ============================================================================

export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function Ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function Err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// ============================================================================
// API CONTRACTS
// ============================================================================

export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
  };
  readonly requestId: RequestId;
  readonly timestamp: string;
}

export function createApiResponse<T>(
  data: T,
  requestId: RequestId
): ApiResponse<T> {
  return {
    success: true,
    data,
    requestId,
    timestamp: new Date().toISOString(),
  };
}

export function createApiError(
  code: string,
  message: string,
  requestId: RequestId,
  details?: unknown
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    requestId,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

export type ValidationError = {
  readonly field: string;
  readonly message: string;
};

export type ValidationResult<T> = Result<T, ValidationError[]>;

export function validateEmail(email: string): ValidationResult<string> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return Err([{ field: "email", message: "Invalid email format" }]);
  }
  return Ok(email);
}

export function validatePhoneNumber(phone: string): ValidationResult<string> {
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  if (!phoneRegex.test(phone) || phone.replace(/\D/g, "").length < 10) {
    return Err([{ field: "phone", message: "Invalid phone number format" }]);
  }
  return Ok(phone);
}

// ============================================================================
// TIMESTAMPS
// ============================================================================

export interface TimestampedEntity {
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt?: Date;
}
