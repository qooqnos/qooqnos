import type { IntegrationCredentialResolver } from "./credential";
import type {
  IntegrationAdapterResult,
  IntegrationProviderAdapter,
  IntegrationSyncRequest,
  IntegrationWebhookRequest,
} from "./adapter";

export interface HttpIntegrationProviderConfig {
  readonly providerId: string;
  readonly baseUrl: string;
  readonly syncPath: string;
  readonly webhookPath?: string;
  readonly credentialReference: string;
  readonly credentialResolver: IntegrationCredentialResolver;
  readonly fetchImpl?: typeof fetch;
  readonly authorizationScheme?: "Bearer" | "ApiKey";
  readonly webhookSecret?: string;
  readonly webhookMaxAgeSeconds?: number;
}

export class IntegrationProviderError extends Error {
  readonly failureClass: "transient" | "permanent";
  readonly failureCode: string;

  constructor(message: string, failureCode: string, failureClass: "transient" | "permanent") {
    super(message);
    this.name = "IntegrationProviderError";
    this.failureClass = failureClass;
    this.failureCode = failureCode;
  }
}

export function createHttpIntegrationProviderAdapter(
  config: HttpIntegrationProviderConfig,
): IntegrationProviderAdapter {
  if (!config.providerId.trim()) throw new Error("Integration providerId is required");
  if (!config.baseUrl.trim()) throw new Error("Integration provider baseUrl is required");
  if (!config.syncPath.trim()) throw new Error("Integration provider syncPath is required");
  if (!config.credentialReference.trim()) throw new Error("Integration credentialReference is required");

  const fetcher = config.fetchImpl ?? fetch;
  const authorizationScheme = config.authorizationScheme ?? "Bearer";

  async function request(path: string, body: unknown, correlationId: string): Promise<Record<string, unknown>> {
    const credential = await config.credentialResolver.resolve(config.credentialReference, config.providerId);
    if (!credential) {
      throw new IntegrationProviderError(
        "Integration provider credential is unavailable",
        "credential_unavailable",
        "permanent",
      );
    }

    let response: Response;
    try {
      response = await fetcher(new URL(path, config.baseUrl).toString(), {
        method: "POST",
        headers: {
          authorization: `${authorizationScheme} ${credential.secret}`,
          "content-type": "application/json",
          "x-correlation-id": correlationId,
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new IntegrationProviderError(
        "Integration provider network failure",
        "provider_network_error",
        "transient",
      );
    }

    const raw = await response.text();
    let payload: Record<string, unknown> = {};
    if (raw) {
      try {
        payload = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        throw new IntegrationProviderError(
          "Integration provider returned invalid JSON",
          "provider_invalid_response",
          "transient",
        );
      }
    }

    if (!response.ok) {
      const failureClass = response.status >= 500 || response.status === 429 ? "transient" : "permanent";
      throw new IntegrationProviderError(
        typeof payload.error === "string" ? payload.error : "Integration provider request failed",
        typeof payload.code === "string" ? payload.code : "provider_request_failed",
        failureClass,
      );
    }

    return payload;
  }

  return {
    providerId: config.providerId,
    supportedWebhookTypes: config.webhookPath ? ["*"] : [],
    supportedSyncTypes: ["*"],

    async processWebhook(
      request: IntegrationWebhookRequest,
    ): Promise<IntegrationAdapterResult> {
      if (!config.webhookPath) return { status: "ignored" };

      const payload = await requestToPayload(request);
      const result = await requestFn(config.webhookPath, payload, request.correlationId);
      return normalizeResult(result);
    },

    async processSync(request: IntegrationSyncRequest): Promise<IntegrationAdapterResult> {
      const result = await requestFn(config.syncPath, {
        accountType: request.account.accountType,
        externalAccountReference: request.account.externalAccountReference,
        syncType: request.syncType,
        direction: request.direction,
        cursorReference: request.cursorReference,
        checkpointReference: request.checkpointReference,
      }, request.correlationId);
      return normalizeResult(result);
    },
  };

  async function requestFn(path: string, body: unknown, correlationId: string): Promise<Record<string, unknown>> {
    return request(path, body, correlationId);
  }
}

async function requestToPayload(request: IntegrationWebhookRequest): Promise<Record<string, unknown>> {
  return {
    eventId: request.eventId,
    eventType: request.eventType,
    payloadReference: request.payloadReference,
    accountType: request.account.accountType,
    externalAccountReference: request.account.externalAccountReference,
  };
}

function normalizeResult(payload: Record<string, unknown>): IntegrationAdapterResult {
  const references = Array.isArray(payload.externalReferences)
    ? payload.externalReferences.flatMap((item) => normalizeReference(item))
    : [];

  return {
    status: payload.status === "ignored" ? "ignored" : "processed",
    ...(typeof payload.cursorReference === "string" ? { cursorReference: payload.cursorReference } : {}),
    ...(typeof payload.checkpointReference === "string" ? { checkpointReference: payload.checkpointReference } : {}),
    ...(typeof payload.itemCount === "number" ? { itemCount: Math.max(0, Math.trunc(payload.itemCount)) } : {}),
    ...(typeof payload.errorCount === "number" ? { errorCount: Math.max(0, Math.trunc(payload.errorCount)) } : {}),
    externalReferences: references,
  };
}

function normalizeReference(value: unknown): NonNullable<IntegrationAdapterResult["externalReferences"]>[number][] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const item = value as Record<string, unknown>;
  if (
    typeof item.resourceType !== "string" ||
    typeof item.resourceId !== "string" ||
    typeof item.externalType !== "string" ||
    typeof item.externalReference !== "string"
  ) return [];
  return [{
    resourceType: item.resourceType,
    resourceId: item.resourceId,
    externalType: item.externalType,
    externalReference: item.externalReference,
    ...(typeof item.status === "string" ? { status: item.status } : {}),
    ...(isObject(item.metadata) ? { metadata: item.metadata } : {}),
  }];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export interface IntegrationWebhookVerificationResult {
  readonly verified: boolean;
  readonly eventId?: string;
  readonly eventType?: string;
  readonly payload: string;
}

export async function verifyHttpIntegrationWebhook(
  payload: string,
  signature: string | null,
  timestamp: string | null,
  secret: string,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
  maxAgeSeconds = 300,
): Promise<IntegrationWebhookVerificationResult> {
  if (!signature || !secret) return { verified: false, payload };
  if (timestamp && !/^\d+$/.test(timestamp)) return { verified: false, payload };

  const timestampSeconds = timestamp ? Number(timestamp) : null;
  if (timestampSeconds !== null && Math.abs(nowEpochSeconds - timestampSeconds) > maxAgeSeconds) {
    return { verified: false, payload };
  }

  const signedPayload = timestamp ? timestamp + "." + payload : payload;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  let signatureBytes: Uint8Array;
  try {
    signatureBytes = hexOrBase64ToBytes(signature);
  } catch {
    return { verified: false, payload };
  }
  const verified = await globalThis.crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    new TextEncoder().encode(signedPayload),
  );
  if (!verified) return { verified: false, payload };

  try {
    const event = JSON.parse(payload) as Record<string, unknown>;
    return {
      verified: true,
      payload,
      ...(typeof event.id === "string" ? { eventId: event.id } : {}),
      ...(typeof event.type === "string" ? { eventType: event.type } : {}),
    };
  } catch {
    return { verified: true, payload };
  }
}

function hexOrBase64ToBytes(value: string): Uint8Array {
  const clean = value.trim();
  if (/^[0-9a-fA-F]+$/.test(clean) && clean.length % 2 === 0) {
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
