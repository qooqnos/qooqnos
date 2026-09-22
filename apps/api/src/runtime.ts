import { AI_MODULE } from "@qooqnos/ai";
import { CATALOG_MODULE } from "@qooqnos/catalog";
import { BUSINESS_MODULE } from "@qooqnos/business";
import { BOOKING_MODULE } from "@qooqnos/booking";
import { COMMERCE_MODULE } from "@qooqnos/commerce";
import { BILLING_MODULE } from "@qooqnos/billing";
import { COMMUNICATION_MODULE } from "@qooqnos/communication";
import { AUTOMATION_MODULE } from "@qooqnos/automation";
import { INTEGRATION_MODULE } from "@qooqnos/integration";
import { onboardingModule } from "@qooqnos/onboarding";
import {
  createAuthorizationRegistry,
  RuntimeBoot,
  type AuthorizationRegistry,
  type RuntimeBootResult,
  type RuntimeModule,
} from "@qooqnos/runtime";
import type { D1Database, MigrationLockManifest } from "@qooqnos/database";
import { createRequestContext } from "./context";
import { getDatabase } from "./database";
import type { ApiEnv } from "./env";
import { migrationSources } from "./migrations";
import migrationLockJson from "../../../migrations/migration-lock.json";

const runtimeModule: RuntimeModule = {
  id: "runtime",
  version: "0.1.0",
  dependencies: [],
  permissions: [],
};

const modules: readonly RuntimeModule[] = [
  runtimeModule,
  BUSINESS_MODULE,
  CATALOG_MODULE,
  BOOKING_MODULE,
  COMMERCE_MODULE,
  BILLING_MODULE,
  COMMUNICATION_MODULE,
  AUTOMATION_MODULE,
  INTEGRATION_MODULE,
  onboardingModule,
  AI_MODULE,
];

const bootPromises = new WeakMap<D1Database, Promise<RuntimeBootResult>>();
let authorizationRegistry: AuthorizationRegistry | undefined;

export function createApiAuthorizationRegistry(): AuthorizationRegistry {
  if (authorizationRegistry) return authorizationRegistry;

  const registry = createAuthorizationRegistry({
    "business:create": undefined,
    "context:read": undefined,
  });

  for (const module of modules) module.registerAuthorization?.(registry);
  authorizationRegistry = registry;
  return registry;
}

export function ensureRuntimeBoot(env: ApiEnv): Promise<RuntimeBootResult> {
  const database = getDatabase(env);
  if (!database) return Promise.reject(new Error("D1 database binding is not configured"));

  const existing = bootPromises.get(database);
  if (existing) return existing;

  const requestContext = createRequestContext({
    module: "platform",
    operation: "runtime.boot",
    authenticated: false,
  });

  const boot = new RuntimeBoot({
    database,
    migrationSources,
    migrationLock: migrationLockJson as MigrationLockManifest,
    modules,
    authorization: createApiAuthorizationRegistry(),
    requestContext,
  });

  const promise = boot.start().catch((error) => {
    bootPromises.delete(database);
    throw error;
  });

  bootPromises.set(database, promise);
  return promise;
}
