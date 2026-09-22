import { createServer, IncomingMessage, ServerResponse } from "http";
import { URL } from "url";
import { InMemoryDatabase } from "@qooqnos/database/legacy";
import { ApiRouter } from "@qooqnos/api";
import {
} from "@qooqnos/core";

// ============================================================================
// HTTP SERVER IMPLEMENTATION
// ============================================================================

export interface ServerConfig {
  readonly port: number;
  readonly hostname?: string;
  readonly logLevel?: "debug" | "info" | "warn" | "error";
}

export class HttpServer {
  private port: number;
  private hostname: string;
  private router: ApiRouter;
  private db: InMemoryDatabase;
  private logLevel: "debug" | "info" | "warn" | "error";

  constructor(db: InMemoryDatabase, config: ServerConfig) {
    this.port = config.port;
    this.hostname = config.hostname ?? "0.0.0.0";
    this.logLevel = config.logLevel ?? "info";
    this.db = db;
    this.router = new ApiRouter(db);
    this.router.registerHandlers();
  }

  private log(level: string, message: string, data?: unknown): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = levels[this.logLevel];
    const msgLevel = levels[level as keyof typeof levels] ?? 1;

    if (msgLevel >= currentLevel) {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] ${level.toUpperCase()}`;
      if (data) {
        console.log(prefix, message, JSON.stringify(data, null, 2));
      } else {
        console.log(prefix, message);
      }
    }
  }

  async start(): Promise<void> {
    const server = createServer(
      async (
        req: IncomingMessage,
        res: ServerResponse
      ): Promise<void> => {
        // Parse URL
        const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
        const path = url.pathname;
        const method = req.method ?? "GET";

        this.log("debug", `${method} ${path}`);

        // Parse body
        let body: unknown;
        if (method !== "GET" && method !== "HEAD") {
          body = await this.parseRequestBody(req);
        }

        // Extract headers
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(req.headers)) {
          if (typeof value === "string") {
            headers[key] = value;
          }
        }

        // Handle request through router
        try {
          const response = await this.router.handleRequest({
            method,
            path,
            headers,
            body,
            query: Object.fromEntries(url.searchParams),
          });

          // Send response
          res.writeHead(response.success ? 200 : 400, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          });

          res.end(JSON.stringify(response, null, 2));

          this.log("debug", `Response sent`, {
            success: response.success,
            requestId: response.requestId,
          });
        } catch (error) {
          this.log("error", "Request handling failed", error);

          res.writeHead(500, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          });

          res.end(
            JSON.stringify({
              success: false,
              error: {
                code: "INTERNAL_ERROR",
                message: "Internal server error",
              },
              requestId: `error_${Date.now()}`,
              timestamp: new Date().toISOString(),
            })
          );
        }
      }
    );

    // Handle OPTIONS requests
    server.on("request", (req, res) => {
      if (req.method === "OPTIONS") {
        res.writeHead(200, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        });
        res.end();
      }
    });

    server.listen(this.port, this.hostname, () => {
      this.log("info", `🚀 HTTP Server started`, {
        url: `http://${this.hostname}:${this.port}`,
        port: this.port,
        hostname: this.hostname,
      });
    });

    server.on("error", (error) => {
      this.log("error", "Server error", error);
    });

    // Graceful shutdown
    process.on("SIGTERM", () => {
      this.log("warn", "SIGTERM received, shutting down gracefully...");
      server.close(() => {
        this.log("info", "Server closed");
        process.exit(0);
      });
    });

    process.on("SIGINT", () => {
      this.log("warn", "SIGINT received, shutting down gracefully...");
      server.close(() => {
        this.log("info", "Server closed");
        process.exit(0);
      });
    });
  }

  private parseRequestBody(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let data = "";

      req.on("data", (chunk) => {
        data += chunk.toString();
      });

      req.on("end", () => {
        if (!data) {
          resolve(undefined);
          return;
        }

        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(
            new Error(
              `Failed to parse JSON body: ${error instanceof Error ? error.message : "unknown error"}`
            )
          );
        }
      });

      req.on("error", reject);
    });
  }
}

// ============================================================================
// SERVER FACTORY
// ============================================================================

export async function createHttpServer(
  db: InMemoryDatabase,
  config: ServerConfig
): Promise<HttpServer> {
  return new HttpServer(db, config);
}
