import {
  SellerProductService,
  AiRuntimeRepository,
  createSellerProductSessionRepository,
  createAIRuntimeClient,
  createPersistentAIRuntimeClient,
  createSellerProductAIRuntimeInputResolver,
  processAIRuntimeWork,
  type AIRuntimeWorkerResult,
} from "@qooqnos/ai";
import type { BillingAIEntitlementService } from "@qooqnos/billing";
import { brandId, type EntityId } from "@qooqnos/core";
import type { D1Database } from "@qooqnos/database";
import type {
  AIEconomicsSink,
  AIRuntimePolicy,
  AuthorizationService,
} from "@qooqnos/runtime";
import { createApiAIRuntime } from "./ai-runtime";
import { createSellerProductAIRuntimePolicy } from "./ai-runtime-policy";
import type { ApiEnv } from "./env";

export interface SellerProductAIRuntimeWorkerOptions {
  readonly env: ApiEnv;
  readonly database: D1Database;
  readonly authorization: AuthorizationService;
  readonly billing: BillingAIEntitlementService;
  readonly validateOutput: AIRuntimePolicy["validateOutput"];
  readonly validateSafety: AIRuntimePolicy["validateSafety"];
  readonly workerId: string;
  readonly limit?: number;
  readonly now?: () => string;
}

export async function processSellerProductAIRuntimeWork(
  options: SellerProductAIRuntimeWorkerOptions,
): Promise<AIRuntimeWorkerResult> {
  const id = () => brandId<"EntityId">(crypto.randomUUID());
  const now = options.now ?? (() => new Date().toISOString());

  const policy = createSellerProductAIRuntimePolicy({
    authorization: options.authorization,
    billing: options.billing,
    validateOutput: options.validateOutput,
    validateSafety: options.validateSafety,
  });
  const runtime = createApiAIRuntime(options.env, policy);
  const persistentRuntime = createPersistentAIRuntimeClient(
    createAIRuntimeClient(runtime.execute),
    new AiRuntimeRepository(options.database),
    { id, now },
  );

  const resolver = createSellerProductAIRuntimeInputResolver({
    repository: createSellerProductSessionRepository(options.database),
  });

  return processAIRuntimeWork(
    {
      repository: new AiRuntimeRepository(options.database),
      runtime: persistentRuntime,
      resolver,
      workerId: options.workerId,
      id,
      now,
    },
    options.limit ?? 10,
  );
}

export interface SellerProductServiceCompositionOptions {
  readonly env: ApiEnv;
  readonly database: D1Database;
  readonly authorization: AuthorizationService;
  readonly billing: BillingAIEntitlementService;
  readonly validateOutput: AIRuntimePolicy["validateOutput"];
  readonly validateSafety: AIRuntimePolicy["validateSafety"];
  readonly economics?: AIEconomicsSink | undefined;
  readonly id?: (() => EntityId) | undefined;
  readonly now?: (() => string) | undefined;
}

/** Single composition boundary for seller AI: Billing → policy → Runtime → SellerProductService. */
export function createSellerProductService(
  options: SellerProductServiceCompositionOptions,
): SellerProductService {
  const policy = createSellerProductAIRuntimePolicy({
    authorization: options.authorization,
    billing: options.billing,
    validateOutput: options.validateOutput,
    validateSafety: options.validateSafety,
  });
  const runtime = createApiAIRuntime(options.env, policy, options.economics);

  const id = options.id ?? (() => brandId<"EntityId">(crypto.randomUUID()));
  const now = options.now ?? (() => new Date().toISOString());
  const persistentRuntime = createPersistentAIRuntimeClient(
    createAIRuntimeClient(runtime.execute),
    new AiRuntimeRepository(options.database),
    { id, now },
  );

  return new SellerProductService({
    repository: createSellerProductSessionRepository(options.database),
    runtime: persistentRuntime,
    id,
    now,
  });
}
