import { RuntimeBoot, type RuntimeBootResult } from "@qooqnos/runtime";
import { createRequestContext } from "./context";
import { getDatabase } from "./database";
import type { ApiEnv } from "./env";
import { migrationSources } from "./migrations";
import migrationLockJson from "../../migrations/migration-lock.json";
import type { MigrationLockManifest } from "@qooqnos/database";

let bootPromise: Promise<RuntimeBootResult> | undefined;

export function ensureRuntimeBoot(env: ApiEnv): Promise<RuntimeBootResult> {
  const database = getDatabase(env);
  if (!database) return Promise.reject(new Error("D1 database binding is not configured"));
  if (bootPromise) return bootPromise;

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

  bootPromise = boot.start().catch((error) => {
    bootPromise = undefined;
    throw error;
  });

  return bootPromise;
}
