import type { D1DatabaseLike } from "@qooqnos/database";
import type { CloudflareAIBinding } from "@qooqnos/runtime";

export interface CloudflareQueueBinding {
  send(message: unknown): Promise<void>;
}

export interface ApiEnv {
  readonly APP_VERSION?: string;
  readonly DB?: D1DatabaseLike;
  readonly AI?: CloudflareAIBinding;
  readonly OUTBOX_QUEUE?: CloudflareQueueBinding;
  readonly AI_GATEWAY_ID?: string;
  readonly AI_SELLER_EXTRACT_MODEL_ID?: string;
  readonly AI_SELLER_EXTRACT_MODEL_VERSION?: string;
}

export function requireDatabase(env: ApiEnv): D1DatabaseLike {
  if (!env.DB) throw new Error("D1 database binding is not configured");
  return env.DB;
}

export function requireAI(env: ApiEnv): CloudflareAIBinding {
  if (!env.AI) throw new Error("Workers AI binding is not configured");
  return env.AI;
}
