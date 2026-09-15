import { RuntimeBoot, type RuntimeBootResult } from "@qooqnos/runtime";
import { createRequestContext } from "./context";
import { getDatabase } from "./database";
import type { ApiEnv } from "./env";
import { migrationSources } from "./migrations";
import migrationLockJson from "../../migrations/migration-lock.json";
import type { D1Database, MigrationLockManifest } from "@qooqnos/database";

const bootPromises = new WeakMap<D1Database, Promise<RuntimeBootResult>>();

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
    modules: [],
    requestContext,
  });

  const promise = boot.start().catch((error) => {
    bootPromises.delete(database);
    throw error;
  });

  bootPromises.set(database, promise);
  return promise;
}
