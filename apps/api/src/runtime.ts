import { AI_MODULE } from "@qooqnos/ai";
import { CATALOG_MODULE } from "@qooqnos/catalog";
import { BUSINESS_MODULE } from "@qooqnos/business";
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
  onboardingModule,
  AI_MODULE,
];

const bootPromises = new WeakMap<D1Database, Promise<RuntimeBootResult>>();
let authorizationRegistry: AuthorizationRegistry | undefined;
