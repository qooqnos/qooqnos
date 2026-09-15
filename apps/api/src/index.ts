export interface ApiEnv {
  readonly APP_VERSION?: string;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });

export default {
  async fetch(request: Request, env: ApiEnv): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: env.APP_VERSION ?? "development",
      });
    }

    if (request.method === "GET" && url.pathname === "/ready") {
      return json({
        status: "ready",
        timestamp: new Date().toISOString(),
      });
    }

    return json(
      {
        error: "not_found",
        message: "Route not found",
      },
      404,
    );
  },
};
