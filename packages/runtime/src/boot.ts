import type { RequestContext } from "@phoenix/core";
import { MigrationRunner, type MigrationDefinition, type MigrationResult } from "@phoenix/database";
import type { D1Database } from "@phoenix/database";
import { createRuntime, type ModuleManifest, type RuntimeHealth } from "./index";
import type { AuthorizationRegistry } from "./authorization";

export type BootPhase = "database" | "migrations" | "modules" | "authorization" | "ready";

export interface RuntimeModule extends ModuleManifest {
  readonly boot?: (context: RuntimeBootContext) => Promise<void> | void;
  readonly shutdown?: (context: RuntimeBootContext) => Promise<void> | void;
}

export interface RuntimeBootContext {
  readonly phase: BootPhase;
  readonly requestContext: RequestContext;
}

export interface RuntimeBootOptions {
  readonly database: D1Database;
  readonly migrations: readonly MigrationDefinition[];
  readonly modules: readonly RuntimeModule[];
  readonly authorization?: AuthorizationRegistry;
  readonly requestContext: RequestContext;
}

export interface RuntimeBootResult {
  readonly status: "ready";
  readonly phase: "ready";
  readonly migrations: readonly MigrationResult[];
  readonly modules: readonly string[];
  readonly health: RuntimeHealth;
}

export class RuntimeBootError extends Error {
  readonly phase: BootPhase;
  readonly cause?: unknown;

  constructor(phase: BootPhase, message: string, cause?: unknown) {
    super(message);
    this.name = "RuntimeBootError";
    this.phase = phase;
    this.cause = cause;
  }
}

export class RuntimeBoot {
  private readonly runtime;
  private readonly startedModules: RuntimeModule[] = [];

  constructor(private readonly options: RuntimeBootOptions) {
    this.runtime = createRuntime(options.modules);
  }

  async start(): Promise<RuntimeBootResult> {
    let phase: BootPhase = "database";

    try {
      assertDatabase(this.options.database);

      phase = "migrations";
      const migrations = await new MigrationRunner(this.options.database, this.options.migrations).run();

      phase = "modules";
      for (const module of this.options.modules) {
        if (module.boot) {
          await module.boot({ phase, requestContext: this.options.requestContext });
        }
        this.startedModules.push(module);
      }

      phase = "authorization";
      // Authorization is constructed before boot; this phase is an explicit readiness boundary.
      if (this.options.authorization) {
        for (const module of this.options.modules) {
          for (const permission of module.permissions) {
            if (!this.options.authorization.hasPermission(permission)) {
              throw new Error(`Module ${module.id} references unregistered permission: ${permission}`);
            }
          }
        }
      }

      phase = "ready";
      return {
        status: "ready",
        phase,
        migrations,
        modules: this.options.modules.map((module) => module.id),
        health: { ...this.runtime.health(), status: "ok" },
      };
    } catch (error) {
      await this.rollback({ phase, requestContext: this.options.requestContext });
      throw new RuntimeBootError(phase, `Runtime boot failed during ${phase}`, error);
    }
  }

  async stop(): Promise<void> {
    const context: RuntimeBootContext = {
      phase: "ready",
      requestContext: this.options.requestContext,
    };

    for (const module of [...this.startedModules].reverse()) {
      if (module.shutdown) await module.shutdown(context);
    }
    this.startedModules.length = 0;
  }

  private async rollback(context: RuntimeBootContext): Promise<void> {
    for (const module of [...this.startedModules].reverse()) {
      try {
        if (module.shutdown) await module.shutdown(context);
      } catch {
        // Preserve the original boot failure; shutdown is best-effort during rollback.
      }
    }
    this.startedModules.length = 0;
  }
}

function assertDatabase(database: D1Database): void {
  if (!database) throw new Error("Database runtime is required");
}
