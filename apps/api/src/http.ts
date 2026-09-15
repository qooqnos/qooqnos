import { AppError, type RequestContext } from "@qooqnos/core";

export function json(body: unknown, status = 200, requestId?: RequestContext["requestId"]): Response {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
  if (requestId) headers.set("x-request-id", requestId);
  return new Response(JSON.stringify(body), { status, headers });
}

export function errorResponse(error: unknown, requestId: RequestContext["requestId"]): Response {
  if (error instanceof AppError) {
    const status = appErrorStatus(error.code);
    return json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      status,
      requestId,
    );
  }

  return json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      },
    },
    500,
    requestId,
  );
}

function appErrorStatus(code: AppError["code"]): number {
  switch (code) {
    case "VALIDATION_ERROR":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "UNPROCESSABLE":
      return 422;
    case "RATE_LIMITED":
      return 429;
    case "INTERNAL_ERROR":
      return 500;
  }
}
