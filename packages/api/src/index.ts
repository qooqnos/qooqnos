import {
  ApiResponse,
  AuthContext,
  createApiResponse,
  createApiError,
  createCorrelationId,
  createRequestId,
  createUserId,
  createWorkspaceId,
  CorrelationId,
  RequestId,
  UserId,
  WorkspaceId,
  ValidationResult,
  Ok,
  Err,
} from "@qooqnos/core";
import {
  InMemoryDatabase,
  Booking,
  Service,
  User,
  Workspace,
  createUser,
  createWorkspace,
  createService,
  createBooking,
} from "@qooqnos/database";

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface ApiRequest {
  readonly method: string;
  readonly path: string;
  readonly headers: Record<string, string>;
  readonly body?: unknown;
  readonly query?: Record<string, string>;
}

export interface ApiRequestContext extends ApiRequest {
  readonly requestId: RequestId;
  readonly correlationId: CorrelationId;
  readonly auth?: AuthContext;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const ApiErrors = {
  UNAUTHORIZED: () =>
    new ApiError("UNAUTHORIZED", 401, "Authentication required"),
  FORBIDDEN: () =>
    new ApiError("FORBIDDEN", 403, "Access denied"),
  NOT_FOUND: (resource: string) =>
    new ApiError("NOT_FOUND", 404, `${resource} not found`),
  VALIDATION_ERROR: (message: string) =>
    new ApiError("VALIDATION_ERROR", 400, message),
  INTERNAL_ERROR: () =>
    new ApiError("INTERNAL_ERROR", 500, "Internal server error"),
} as const;

// ============================================================================
// REQUEST HANDLERS
// ============================================================================

export type HandlerFunction<T = unknown> = (
  ctx: ApiRequestContext,
  db: InMemoryDatabase
) => Promise<ApiResponse<T>>;

export type RouteHandler = {
  readonly method: string;
  readonly path: string;
  readonly handler: HandlerFunction;
  readonly requiresAuth?: boolean;
};

// ============================================================================
// HANDLER IMPLEMENTATIONS
// ============================================================================

export class ApiHandlers {
  private db: InMemoryDatabase;

  constructor(db: InMemoryDatabase) {
    this.db = db;
  }

  // ========== USERS ==========

  async createUserHandler(
    ctx: ApiRequestContext
  ): Promise<ApiResponse<User>> {
    if (!ctx.body || typeof ctx.body !== "object") {
      return createApiError(
        "VALIDATION_ERROR",
        "Request body is required",
        ctx.requestId
      );
    }

    const body = ctx.body as Record<string, unknown>;
    const email = body.email as string | undefined;
    const name = body.name as string | undefined;

    if (!email || !name) {
      return createApiError(
        "VALIDATION_ERROR",
        "Email and name are required",
        ctx.requestId
      );
    }

    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const user = createUser(userId, email, name);

    try {
      await this.db.getUserRepository().create(user);
      return createApiResponse(user, ctx.requestId);
    } catch (error) {
      return createApiError(
        "INTERNAL_ERROR",
        "Failed to create user",
        ctx.requestId,
        error instanceof Error ? error.message : undefined
      );
    }
  }

  async getUserHandler(ctx: ApiRequestContext): Promise<ApiResponse<User>> {
    const userId = ctx.path.split("/").pop();
    if (!userId) {
      return createApiError(
        "VALIDATION_ERROR",
        "User ID is required",
        ctx.requestId
      );
    }

    try {
      const user = await this.db
        .getUserRepository()
        .read(userId as any);
      if (!user) {
        return createApiError(
          "NOT_FOUND",
          "User not found",
          ctx.requestId
        );
      }
      return createApiResponse(user, ctx.requestId);
    } catch (error) {
      return createApiError(
        "INTERNAL_ERROR",
        "Failed to fetch user",
        ctx.requestId,
        error instanceof Error ? error.message : undefined
      );
    }
  }

  // ========== WORKSPACES ==========

  async createWorkspaceHandler(
    ctx: ApiRequestContext
  ): Promise<ApiResponse<Workspace>> {
    if (!ctx.auth) {
      return createApiError(
        "UNAUTHORIZED",
        "Authentication required",
        ctx.requestId
      );
    }

    if (!ctx.body || typeof ctx.body !== "object") {
      return createApiError(
        "VALIDATION_ERROR",
        "Request body is required",
        ctx.requestId
      );
    }

    const body = ctx.body as Record<string, unknown>;
    const name = body.name as string | undefined;

    if (!name) {
      return createApiError(
        "VALIDATION_ERROR",
        "Workspace name is required",
        ctx.requestId
      );
    }

    const workspaceId = `workspace_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const workspace = createWorkspace(workspaceId, name, ctx.auth.userId);

    try {
      await this.db.getWorkspaceRepository().create(workspace);
      return createApiResponse(workspace, ctx.requestId);
    } catch (error) {
      return createApiError(
        "INTERNAL_ERROR",
        "Failed to create workspace",
        ctx.requestId,
        error instanceof Error ? error.message : undefined
      );
    }
  }

  async getWorkspaceHandler(
    ctx: ApiRequestContext
  ): Promise<ApiResponse<Workspace>> {
    const workspaceId = ctx.path.split("/").pop();
    if (!workspaceId) {
      return createApiError(
        "VALIDATION_ERROR",
        "Workspace ID is required",
        ctx.requestId
      );
    }

    try {
      const workspace = await this.db
        .getWorkspaceRepository()
        .read(workspaceId as any);
      if (!workspace) {
        return createApiError(
          "NOT_FOUND",
          "Workspace not found",
          ctx.requestId
        );
      }
      return createApiResponse(workspace, ctx.requestId);
    } catch (error) {
      return createApiError(
        "INTERNAL_ERROR",
        "Failed to fetch workspace",
        ctx.requestId,
        error instanceof Error ? error.message : undefined
      );
    }
  }

  // ========== SERVICES ==========

  async createServiceHandler(
    ctx: ApiRequestContext
  ): Promise<ApiResponse<Service>> {
    if (!ctx.auth) {
      return createApiError(
        "UNAUTHORIZED",
        "Authentication required",
        ctx.requestId
      );
    }

    if (!ctx.body || typeof ctx.body !== "object") {
      return createApiError(
        "VALIDATION_ERROR",
        "Request body is required",
        ctx.requestId
      );
    }

    const body = ctx.body as Record<string, unknown>;
    const { workspaceId, name, description, price, currency } = body;

    if (
      !workspaceId ||
      !name ||
      !description ||
      price === undefined ||
      !currency
    ) {
      return createApiError(
        "VALIDATION_ERROR",
        "All service fields are required",
        ctx.requestId
      );
    }

    const serviceId = `service_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const service = createService(
      serviceId,
      workspaceId as WorkspaceId,
      name as string,
      description as string,
      price as number,
      currency as string,
      ctx.auth.userId
    );

    try {
      await this.db.getServiceRepository().create(service);
      return createApiResponse(service, ctx.requestId);
    } catch (error) {
      return createApiError(
        "INTERNAL_ERROR",
        "Failed to create service",
        ctx.requestId,
        error instanceof Error ? error.message : undefined
      );
    }
  }

  async getServiceHandler(
    ctx: ApiRequestContext
  ): Promise<ApiResponse<Service>> {
    const serviceId = ctx.path.split("/").pop();
    if (!serviceId) {
      return createApiError(
        "VALIDATION_ERROR",
        "Service ID is required",
        ctx.requestId
      );
    }

    try {
      const service = await this.db
        .getServiceRepository()
        .read(serviceId as any);
      if (!service) {
        return createApiError(
          "NOT_FOUND",
          "Service not found",
          ctx.requestId
        );
      }
      return createApiResponse(service, ctx.requestId);
    } catch (error) {
      return createApiError(
        "INTERNAL_ERROR",
        "Failed to fetch service",
        ctx.requestId,
        error instanceof Error ? error.message : undefined
      );
    }
  }

  async listWorkspaceServicesHandler(
    ctx: ApiRequestContext
  ): Promise<ApiResponse<readonly Service[]>> {
    const workspaceId = ctx.path.split("/")[2];
    if (!workspaceId) {
      return createApiError(
        "VALIDATION_ERROR",
        "Workspace ID is required",
        ctx.requestId
      );
    }

    try {
      const services = await this.db.findServicesByWorkspace(
        workspaceId as WorkspaceId
      );
      return createApiResponse(services, ctx.requestId);
    } catch (error) {
      return createApiError(
        "INTERNAL_ERROR",
        "Failed to fetch services",
        ctx.requestId,
        error instanceof Error ? error.message : undefined
      );
    }
  }

  // ========== BOOKINGS ==========

  async createBookingHandler(
    ctx: ApiRequestContext
  ): Promise<ApiResponse<Booking>> {
    if (!ctx.auth) {
      return createApiError(
        "UNAUTHORIZED",
        "Authentication required",
        ctx.requestId
      );
    }

    if (!ctx.body || typeof ctx.body !== "object") {
      return createApiError(
        "VALIDATION_ERROR",
        "Request body is required",
        ctx.requestId
      );
    }

    const body = ctx.body as Record<string, unknown>;
    const {
      serviceId,
      workspaceId,
      providerId,
      startTime,
      endTime,
      totalPrice,
    } = body;

    if (
      !serviceId ||
      !workspaceId ||
      !providerId ||
      !startTime ||
      !endTime ||
      totalPrice === undefined
    ) {
      return createApiError(
        "VALIDATION_ERROR",
        "All booking fields are required",
        ctx.requestId
      );
    }

    const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const booking = createBooking(
      bookingId,
      serviceId as any,
      ctx.auth.userId,
      providerId as UserId,
      workspaceId as WorkspaceId,
      new Date(startTime as string),
      new Date(endTime as string),
      totalPrice as number
    );

    try {
      await this.db.getBookingRepository().create(booking);
      return createApiResponse(booking, ctx.requestId);
    } catch (error) {
      return createApiError(
        "INTERNAL_ERROR",
        "Failed to create booking",
        ctx.requestId,
        error instanceof Error ? error.message : undefined
      );
    }
  }

  async getBookingHandler(
    ctx: ApiRequestContext
  ): Promise<ApiResponse<Booking>> {
    const bookingId = ctx.path.split("/").pop();
    if (!bookingId) {
      return createApiError(
        "VALIDATION_ERROR",
        "Booking ID is required",
        ctx.requestId
      );
    }

    try {
      const booking = await this.db
        .getBookingRepository()
        .read(bookingId as any);
      if (!booking) {
        return createApiError(
          "NOT_FOUND",
          "Booking not found",
          ctx.requestId
        );
      }
      return createApiResponse(booking, ctx.requestId);
    } catch (error) {
      return createApiError(
        "INTERNAL_ERROR",
        "Failed to fetch booking",
        ctx.requestId,
        error instanceof Error ? error.message : undefined
      );
    }
  }

  async listUserBookingsHandler(
    ctx: ApiRequestContext
  ): Promise<ApiResponse<readonly Booking[]>> {
    if (!ctx.auth) {
      return createApiError(
        "UNAUTHORIZED",
        "Authentication required",
        ctx.requestId
      );
    }

    try {
      const bookings = await this.db.findBookingsByUser(ctx.auth.userId);
      return createApiResponse(bookings, ctx.requestId);
    } catch (error) {
      return createApiError(
        "INTERNAL_ERROR",
        "Failed to fetch bookings",
        ctx.requestId,
        error instanceof Error ? error.message : undefined
      );
    }
  }

  // ========== HEALTH ==========

  async healthHandler(
    ctx: ApiRequestContext
  ): Promise<
    ApiResponse<{ readonly status: string; readonly timestamp: string }>
  > {
    return createApiResponse(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
      },
      ctx.requestId
    );
  }
}

// ============================================================================
// ROUTER
// ============================================================================

export class ApiRouter {
  private routes: RouteHandler[] = [];

  constructor(private db: InMemoryDatabase) {}

  registerHandlers(): void {
    const handlers = new ApiHandlers(this.db);

    // Health check
    this.routes.push({
      method: "GET",
      path: "/health",
      handler: handlers.healthHandler.bind(handlers),
    });

    // Users
    this.routes.push({
      method: "POST",
      path: "/users",
      handler: handlers.createUserHandler.bind(handlers),
    });
    this.routes.push({
      method: "GET",
      path: "/users/:id",
      handler: handlers.getUserHandler.bind(handlers),
    });

    // Workspaces
    this.routes.push({
      method: "POST",
      path: "/workspaces",
      handler: handlers.createWorkspaceHandler.bind(handlers),
      requiresAuth: true,
    });
    this.routes.push({
      method: "GET",
      path: "/workspaces/:id",
      handler: handlers.getWorkspaceHandler.bind(handlers),
    });

    // Services
    this.routes.push({
      method: "POST",
      path: "/services",
      handler: handlers.createServiceHandler.bind(handlers),
      requiresAuth: true,
    });
    this.routes.push({
      method: "GET",
      path: "/services/:id",
      handler: handlers.getServiceHandler.bind(handlers),
    });
    this.routes.push({
      method: "GET",
      path: "/workspaces/:workspaceId/services",
      handler: handlers.listWorkspaceServicesHandler.bind(handlers),
    });

    // Bookings
    this.routes.push({
      method: "POST",
      path: "/bookings",
      handler: handlers.createBookingHandler.bind(handlers),
      requiresAuth: true,
    });
    this.routes.push({
      method: "GET",
      path: "/bookings/:id",
      handler: handlers.getBookingHandler.bind(handlers),
    });
    this.routes.push({
      method: "GET",
      path: "/bookings",
      handler: handlers.listUserBookingsHandler.bind(handlers),
      requiresAuth: true,
    });
  }

  async handleRequest(req: ApiRequest): Promise<ApiResponse<unknown>> {
    const requestId = createRequestId(
      `req_${Date.now()}_${Math.random().toString(36).substring(7)}`
    );
    const correlationId = createCorrelationId(
      req.headers["x-correlation-id"] ||
      `corr_${Date.now()}_${Math.random().toString(36).substring(7)}`
    );

    const ctx: ApiRequestContext = {
      ...req,
      requestId,
      correlationId,
    };

    const route = this.routes.find(
      (r) => r.method === req.method && this.matchPath(r.path, req.path)
    );

    if (!route) {
      return createApiError("NOT_FOUND", "Route not found", requestId);
    }

    if (route.requiresAuth && !ctx.auth) {
      return createApiError("UNAUTHORIZED", "Authentication required", requestId);
    }

    try {
      return await route.handler(ctx, this.db);
    } catch (error) {
      return createApiError(
        "INTERNAL_ERROR",
        "Internal server error",
        requestId,
        error instanceof Error ? error.message : undefined
      );
    }
  }

  private matchPath(pattern: string, path: string): boolean {
    const patternParts = pattern.split("/");
    const pathParts = path.split("/");

    if (patternParts.length !== pathParts.length) {
      return false;
    }

    return patternParts.every(
      (part, idx) => !part.startsWith(":") || Boolean(pathParts[idx])
    );
  }
}
