import type { D1DatabaseLike } from "@qooqnos/database";
import type { CloudflareAIBinding } from "@qooqnos/runtime";
import type { CloudflareQueueBinding, CloudflareR2Binding } from "./infrastructure";

export interface ApiAssetsBinding { fetch(request: Request): Promise<Response>; }

export interface ApiEnv {
  readonly APP_VERSION?: string;
  readonly ASSETS?: ApiAssetsBinding;
  readonly SEO_CANONICAL_BASE_URL?: string;
  readonly SEO_CRAWLER_SAMPLE_LIMIT?: string;
  readonly SEO_MEASUREMENT_SAMPLE_LIMIT?: string;
  readonly SEO_GSC_SITE_URL?: string;
  readonly SEO_GSC_ACCESS_TOKEN?: string;
  readonly SEO_GSC_SERVICE_ACCOUNT_EMAIL?: string;
  readonly SEO_GSC_PRIVATE_KEY?: string;
  readonly SEO_GSC_LOOKBACK_DAYS?: string;
  readonly SEO_GSC_END_LAG_DAYS?: string;
  readonly SEO_BING_SITE_URL?: string;
  readonly SEO_BING_API_KEY?: string;
  readonly SEO_AI_CITATION_ENDPOINT?: string;
  readonly SEO_AI_CITATION_API_KEY?: string;
  readonly SEO_AI_CITATION_MODEL?: string;
  readonly SEO_AI_CITATION_AUTH_MODE?: "bearer" | "api-key";
  readonly SEO_COMPETITIVE_LOGIN?: string;
  readonly SEO_COMPETITIVE_PASSWORD?: string;
  readonly SEO_COMPETITIVE_ENDPOINT?: string;
  readonly SEO_COMPETITIVE_LOCATION_CODE?: string;
  readonly SEO_COMPETITIVE_LOCATION_NAME?: string;
  readonly SEO_COMPETITIVE_LANGUAGE_CODE?: string;
  readonly SEO_COMPETITIVE_DEVICE?: "desktop" | "mobile";
  readonly SEO_COMPETITIVE_DEPTH?: string;
  readonly SEO_COMPETITIVE_SAMPLE_LIMIT?: string;
  readonly SEO_COMPETITIVE_PAGE_SAMPLE_LIMIT?: string;
  readonly SEO_COMPETITIVE_KEYWORD_GAP_COMPETITOR_LIMIT?: string;
  readonly SEO_COMPETITIVE_KEYWORD_GAP_LIMIT?: string;
  readonly SEO_COMPETITIVE_LINK_GAP_COMPETITOR_LIMIT?: string;
  readonly SEO_COMPETITIVE_LINK_GAP_LIMIT?: string;
  readonly SEO_INDEXNOW_KEY?: string;
  readonly SEO_INDEXNOW_KEY_LOCATION?: string;
  readonly SEO_INDEXNOW_ENDPOINT?: string;
  readonly SEO_INDEXNOW_BATCH_LIMIT?: string;
  readonly SEO_ALLOW_OAI_SEARCHBOT?: string;
  readonly SEO_ALLOW_GPTBOT?: string;
  readonly SEO_ALLOW_GOOGLE_EXTENDED?: string;
  readonly SEO_ALLOW_CLAUDEBOT?: string;
  readonly SEO_ALLOW_PERPLEXITYBOT?: string;
  readonly SEO_CRAWL_DELAY_SECONDS?: string;
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
