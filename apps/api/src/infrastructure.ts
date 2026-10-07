import type { CloudflareAIBinding } from "@qooqnos/runtime";

export interface CloudflareQueueBinding {
  send(message: unknown): Promise<void>;
  sendBatch?(messages: readonly unknown[]): Promise<void>;
}

export interface CloudflareR2Binding {
  head(key: string): Promise<unknown>;
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown, options?: Record<string, unknown>): Promise<unknown>;
  delete(keys: string | readonly string[]): Promise<void>;
}

export interface RuntimeInfrastructureStatus {
  readonly environment: string;
  readonly production: boolean;
  readonly d1: "ok" | "missing";
  readonly r2: "ok" | "missing";
  readonly queue: "ok" | "missing";
  readonly ai: "ok" | "missing";
  readonly aiProvider: "cloudflare-workers-ai" | "arvan-aiaas" | "missing";
  readonly aiModel: "ok" | "missing";
  readonly aiGateway: "configured" | "not_configured";
  readonly ready: boolean;
}

export function checkRuntimeInfrastructure(env: {
  readonly ENVIRONMENT?: string;
  readonly DB?: unknown;
  readonly MEDIA_BUCKET?: unknown;
  readonly OUTBOX_QUEUE?: unknown;
  readonly AI?: CloudflareAIBinding;
  readonly AI_PROVIDER_ID?: string;
  readonly AI_SELLER_EXTRACT_MODEL_ID?: string;
  readonly AI_GATEWAY_ID?: string;
  readonly ARVAN_AI_ENDPOINT?: string;
  readonly ARVAN_AI_API_KEY?: string;
}): RuntimeInfrastructureStatus {
  const environment = env.ENVIRONMENT?.trim().toLowerCase() || "development";
  const production = environment === "production";
  const d1 = env.DB ? "ok" : "missing";
  const r2 = env.MEDIA_BUCKET ? "ok" : "missing";
  const queue = env.OUTBOX_QUEUE ? "ok" : "missing";
  const explicitProvider = env.AI_PROVIDER_ID?.trim();
  const arvanConfigured = Boolean(env.ARVAN_AI_ENDPOINT?.trim() && env.ARVAN_AI_API_KEY?.trim());
  const providerId = explicitProvider || (arvanConfigured ? "arvan-aiaas" : "cloudflare-workers-ai");
  const ai = providerId === "arvan-aiaas"
    ? (arvanConfigured ? "ok" : "missing")
    : (env.AI ? "ok" : "missing");
  const aiProvider = ai === "ok"
    ? (providerId === "arvan-aiaas" ? "arvan-aiaas" : "cloudflare-workers-ai")
    : "missing";
  const aiModel = env.AI_SELLER_EXTRACT_MODEL_ID?.trim() ? "ok" : "missing";
  const aiGateway = env.AI_GATEWAY_ID?.trim() ? "configured" : "not_configured";
  return {
    environment, production, d1, r2, queue, ai, aiProvider, aiModel, aiGateway,
    ready: production
      ? d1 === "ok" && r2 === "ok" && queue === "ok" && ai === "ok" && aiModel === "ok"
      : d1 === "ok",
  };
}

export function assertProductionInfrastructure(env: {
  readonly ENVIRONMENT?: string;
  readonly DB?: unknown;
  readonly MEDIA_BUCKET?: unknown;
  readonly OUTBOX_QUEUE?: unknown;
  readonly AI?: CloudflareAIBinding;
  readonly AI_PROVIDER_ID?: string;
  readonly AI_SELLER_EXTRACT_MODEL_ID?: string;
  readonly AI_GATEWAY_ID?: string;
  readonly ARVAN_AI_ENDPOINT?: string;
  readonly ARVAN_AI_API_KEY?: string;
}): RuntimeInfrastructureStatus {
  const status = checkRuntimeInfrastructure(env);
  if (!status.production) return status;
  if (!status.ready) {
    const missing = [
      status.d1 === "missing" ? "D1" : null,
      status.r2 === "missing" ? "R2" : null,
      status.queue === "missing" ? "Queue" : null,
      status.ai === "missing" ? `AI provider (${status.aiProvider === "missing" ? env.AI_PROVIDER_ID?.trim() || "unconfigured" : status.aiProvider})` : null,
      status.aiModel === "missing" ? "AI seller-extraction model" : null,
    ].filter((value): value is string => value !== null);
    throw new Error("Production infrastructure gate failed: missing " + missing.join(", "));
  }
  return status;
}
