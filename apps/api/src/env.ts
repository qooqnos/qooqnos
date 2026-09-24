import type { D1DatabaseLike } from "@qooqnos/database";
import type { CloudflareAIBinding } from "@qooqnos/runtime";
import type { CloudflareQueueBinding, CloudflareR2Binding } from "./infrastructure";

export interface ApiAssetsBinding { fetch(request: Request): Promise<Response>; }

export interface ApiEnv {
  readonly APP_VERSION?: string;
  readonly ASSETS?: ApiAssetsBinding;
  readonly SEO_CANONICAL_BASE_URL?: string;
  readonly ENVIRONMENT?: string;
  readonly DB?: D1DatabaseLike;
  readonly AI?: CloudflareAIBinding;
  readonly MEDIA_BUCKET?: CloudflareR2Binding;
  readonly OUTBOX_QUEUE?: CloudflareQueueBinding;
  readonly AI_GATEWAY_ID?: string;
  readonly AI_SELLER_EXTRACT_MODEL_ID?: string;
  readonly AI_SELLER_EXTRACT_MODEL_VERSION?: string;
  readonly AI_WORKER_ID?: string;
  readonly EMAIL_PROVIDER_ENDPOINT?: string;
  readonly EMAIL_PROVIDER_TOKEN?: string;
  readonly EMAIL_PROVIDER_FALLBACK_ENDPOINT?: string;
  readonly EMAIL_PROVIDER_FALLBACK_TOKEN?: string;
  readonly SMS_PROVIDER_ENDPOINT?: string;
  readonly SMS_PROVIDER_TOKEN?: string;
  readonly SMS_PROVIDER_FALLBACK_ENDPOINT?: string;
  readonly SMS_PROVIDER_FALLBACK_TOKEN?: string;
  readonly WHATSAPP_PROVIDER_ENDPOINT?: string;
  readonly WHATSAPP_PROVIDER_TOKEN?: string;
  readonly WHATSAPP_PROVIDER_FALLBACK_ENDPOINT?: string;
  readonly WHATSAPP_PROVIDER_FALLBACK_TOKEN?: string;
  readonly PUSH_PROVIDER_ENDPOINT?: string;
  readonly PUSH_PROVIDER_TOKEN?: string;
  readonly PUSH_PROVIDER_FALLBACK_ENDPOINT?: string;
  readonly PUSH_PROVIDER_FALLBACK_TOKEN?: string;
  readonly CASE_DISPATCH_PROVIDER_ID?: string;
  readonly CASE_DISPATCH_PROVIDER_ENDPOINT?: string;
  readonly CASE_DISPATCH_PROVIDER_PATH?: string;
  readonly CASE_DISPATCH_PROVIDER_TOKEN?: string;
}

export function requireDatabase(env: ApiEnv): D1DatabaseLike {
  if (!env.DB) throw new Error("D1 database binding is not configured");
  return env.DB;
}

export function requireR2(env: ApiEnv): CloudflareR2Binding {
  if (!env.MEDIA_BUCKET) throw new Error("R2 media bucket binding is not configured");
  return env.MEDIA_BUCKET;
}

export function requireAI(env: ApiEnv): CloudflareAIBinding {
  if (!env.AI) throw new Error("Workers AI binding is not configured");
  return env.AI;
}
