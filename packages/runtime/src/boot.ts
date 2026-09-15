import type { RequestContext } from "@qooqnos/core";
import { loadMigrationCatalog, MigrationRunner, type MigrationDefinition, type MigrationResult, type MigrationSource, type D1Database } from "@qooqnos/database";
import { createRuntime, orderManifestsByDependencies, type ModuleManifest, type RuntimeHealth } from "./runtime";
import type { AuthorizationRegistry } from "./authorization";

export type BootPhase = "database" | "migrations" | "modules" | "authorization" | "ready";
export interface RuntimeModule extends ModuleManifest { readonly registerAuthorization?: (registry: AuthorizationRegistry) => void; readonly boot?: (context: RuntimeBootContext) => Promise<void> | void; readonly shutdown?: (context: RuntimeBootContext) => Promise<void> | void; }
export interface RuntimeBootContext { readonly phase: BootPhase; readonly requestContext: RequestContext; }
export interface RuntimeBootOptions { readonly database: D1Database; readonly migrations?: readonly MigrationDefinition[]; readonly migrationSources?: readonly MigrationSource[]; readonly modules: readonly RuntimeModule[]; readonly authorization?: AuthorizationRegistry; readonly requestContext: RequestContext; }
export interface RuntimeBootResult { readonly status: "ready"; readonly phase: "ready"; readonly migrations: readonly MigrationResult[]; readonly modules: readonly string[]; readonly health: RuntimeHealth; }
export class RuntimeBootError extends Error { readonly phase: BootPhase; override readonly cause?: unknown; constructor(phase: BootPhase, message: string, cause?: unknown) { super(message); this.name = "RuntimeBootError"; this.phase = phase; this.cause = cause; } }
export class RuntimeBoot {
  private readonly runtime;
  private readonly modules: readonly RuntimeModule[];
  private readonly startedModules: RuntimeModule[] = [];
  constructor(private readonly options: RuntimeBootOptions) { this.modules = orderManifestsByDependencies(options.modules); this.runtime = createRuntime(this.modules); }
  async start(): Promise<RuntimeBootResult> { let phase: BootPhase = "database"; try { assertDatabase(this.options.database); phase = "migrations"; const migrationDefinitions = await this.resolveMigrations(); const migrations = await new MigrationRunner(this.options.database, migrationDefinitions).run(); phase = "authorization"; if (this.options.authorization) for (const module of this.modules) module.registerAuthorization?.(this.options.authorization); phase = "modules"; for (const module of this.modules) { if (module.boot) await module.boot({ phase, requestContext: this.options.requestContext }); this.startedModules.push(module); } phase = "authorization"; if (this.options.authorization) for (const module of this.modules) for (const permission of module.permissions) if (!this.options.authorization.hasPermission(permission)) throw new Error(`Module ${module.id} references unregistered permission: ${permission}`); phase = "ready"; return { status: "ready", phase, migrations, modules: this.modules.map((module) => module.id), health: { ...this.runtime.health(), database: "ok", status: "ok" } }; } catch (error) { await this.rollback({ phase, requestContext: this.options.requestContext }); throw new RuntimeBootError(phase, `Runtime boot failed during ${phase}`, error); } }
  async stop(): Promise<void> { const context: RuntimeBootContext = { phase: "ready", requestContext: this.options.requestContext }; for (const module of [...this.startedModules].reverse()) if (module.shutdown) await module.shutdown(context); this.startedModules.length = 0; }
  private async resolveMigrations(): Promise<readonly MigrationDefinition[]> { if (this.options.migrationSources) return loadMigrationCatalog(this.options.migrationSources); if (this.options.migrations) return this.options.migrations; throw new Error("Runtime boot requires migrationSources or migrations"); }
  private async rollback(context: RuntimeBootContext): Promise<void> { for (const module of [...this.startedModules].reverse()) try { if (module.shutdown) await module.shutdown(context); } catch {} this.startedModules.length = 0; }
}
function assertDatabase(database: D1Database): void { if (!database) throw new Error("Database runtime is required"); }
