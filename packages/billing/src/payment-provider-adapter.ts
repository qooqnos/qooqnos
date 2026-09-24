import type { EntityId } from "@qooqnos/core";

export type PaymentProviderFailureClass = "transient" | "permanent";

export interface PaymentCreateRequest {
  readonly paymentId: EntityId;
  readonly amountMinor: number;
  readonly currency: string;
  readonly customerReference?: string;
  readonly returnUrl?: string;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly idempotencyKey: string;
}

export interface PaymentCaptureRequest {
  readonly paymentId: EntityId;
  readonly providerReference: string;
  readonly amountMinor?: number;
  readonly idempotencyKey: string;
}

export interface PaymentRefundRequest {
  readonly paymentId: EntityId;
  readonly providerReference: string;
  readonly amountMinor: number;
  readonly idempotencyKey: string;
  readonly reason?: string;
}

export interface PaymentProviderResult {
  readonly status: "created" | "authorized" | "captured" | "refunded" | "pending" | "failed";
  readonly provider: string;
  readonly providerReference?: string;
  readonly providerStatus?: string;
  readonly failureCode?: string;
  readonly failureClass?: PaymentProviderFailureClass;
  readonly rawReference?: string;
}

export interface PaymentWebhookVerificationRequest {
  readonly payload: string;
  readonly signature: string | null;
  readonly timestamp?: string | null;
}

export interface PaymentWebhookEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly providerReference: string;
  readonly status: PaymentProviderResult["status"];
  readonly occurredAt: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface PaymentProviderAdapter {
  readonly providerId: string;
  createPayment(request: PaymentCreateRequest): Promise<PaymentProviderResult>;
  capturePayment(request: PaymentCaptureRequest): Promise<PaymentProviderResult>;
  refundPayment(request: PaymentRefundRequest): Promise<PaymentProviderResult>;
  verifyWebhook(request: PaymentWebhookVerificationRequest): Promise<PaymentWebhookEvent | null>;
}

export interface PaymentProviderRegistry {
  resolve(providerId: string): PaymentProviderAdapter | null;
}

export function createPaymentProviderRegistry(
  adapters: readonly PaymentProviderAdapter[] = [],
): PaymentProviderRegistry {
  const map = new Map<string, PaymentProviderAdapter>();
  for (const adapter of adapters) {
    const id = adapter.providerId.trim();
    if (!id) throw new Error("Payment providerId is required");
    if (map.has(id)) throw new Error("Payment provider already registered: " + id);
    map.set(id, adapter);
  }
  return { resolve: (providerId) => map.get(providerId) ?? null };
}

export function classifyPaymentProviderError(error: unknown): PaymentProviderFailureClass {
  if (error instanceof PaymentProviderError) return error.failureClass;
  return "transient";
}

export class PaymentProviderError extends Error {
  readonly failureClass: PaymentProviderFailureClass;
  readonly failureCode: string;
  constructor(message: string, failureCode: string, failureClass: PaymentProviderFailureClass) {
    super(message);
    this.name = "PaymentProviderError";
    this.failureCode = failureCode;
    this.failureClass = failureClass;
  }
}

export interface HttpPaymentProviderConfig {
  readonly providerId: string;
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly createPath: string;
  readonly capturePath: string;
  readonly refundPath: string;
  readonly webhookSecret: string;
  readonly webhookMaxAgeSeconds?: number;
  readonly fetchImpl?: typeof fetch;
}

export function createHttpPaymentProviderAdapter(config: HttpPaymentProviderConfig): PaymentProviderAdapter {
  if (!config.providerId.trim()) throw new Error("Payment providerId is required");
  if (!config.baseUrl.trim()) throw new Error("Payment provider baseUrl is required");
  if (!config.apiKey) throw new Error("Payment provider API key is required");
  if (!config.webhookSecret) throw new Error("Payment provider webhook secret is required");

  const fetcher = config.fetchImpl ?? fetch;
  const request = async (path: string, body: unknown, idempotencyKey: string): Promise<PaymentProviderResult> => {
    let response: Response;
    try {
      response = await fetcher(new URL(path, config.baseUrl).toString(), {
        method: "POST",
        headers: {
          "authorization": "Bearer " + config.apiKey,
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new PaymentProviderError("Payment provider network failure", "provider_network_error", "transient");
    }

    const raw = await response.text();
    let payload: Record<string, unknown> = {};
    if (raw) {
      try { payload = JSON.parse(raw) as Record<string, unknown>; }
      catch { throw new PaymentProviderError("Payment provider returned invalid JSON", "provider_invalid_response", "transient"); }
    }
    if (!response.ok) {
      const failureClass: PaymentProviderFailureClass = response.status >= 500 || response.status === 429 ? "transient" : "permanent";
      throw new PaymentProviderError(
        typeof payload.error === "string" ? payload.error : "Payment provider request failed",
        typeof payload.code === "string" ? payload.code : "provider_request_failed",
        failureClass,
      );
    }
    return normalizeProviderResult(config.providerId, payload);
  };

  return {
    providerId: config.providerId,
    createPayment: (input) => request(config.createPath, input, input.idempotencyKey),
    capturePayment: (input) => request(config.capturePath, input, input.idempotencyKey),
    refundPayment: (input) => request(config.refundPath, input, input.idempotencyKey),
    async verifyWebhook(input) {
      if (!input.signature) return null;
      const timestamp = input.timestamp?.trim();
      if (timestamp && !/^\d+$/.test(timestamp)) return null;
      const signedPayload = timestamp ? timestamp + "." + input.payload : input.payload;
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(config.webhookSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"],
      );
      const signatureBytes = hexOrBase64ToBytes(input.signature);
      const valid = await crypto.subtle.verify("HMAC", key, signatureBytes, new TextEncoder().encode(signedPayload));
      if (!valid) return null;
      let event: Record<string, unknown>;
      try { event = JSON.parse(input.payload) as Record<string, unknown>; } catch { return null; }
      if (typeof event.id !== "string" || typeof event.type !== "string" || typeof event.providerReference !== "string" || typeof event.status !== "string" || typeof event.occurredAt !== "string") {
        return null;
      }
      return {
        eventId: event.id,
        eventType: event.type,
        providerReference: event.providerReference,
        status: normalizeStatus(event.status),
        occurredAt: event.occurredAt,
        ...(isStringRecord(event.metadata) ? { metadata: event.metadata } : {}),
      };
    },
  };
}

function normalizeProviderResult(provider: string, payload: Record<string, unknown>): PaymentProviderResult {
  return {
    status: normalizeStatus(typeof payload.status === "string" ? payload.status : "pending"),
    provider,
    ...(typeof payload.providerReference === "string" ? { providerReference: payload.providerReference } : {}),
    ...(typeof payload.providerStatus === "string" ? { providerStatus: payload.providerStatus } : {}),
    ...(typeof payload.failureCode === "string" ? { failureCode: payload.failureCode } : {}),
  };
}

function normalizeStatus(value: string): PaymentProviderResult["status"] {
  if (value === "created" || value === "authorized" || value === "captured" || value === "refunded" || value === "pending" || value === "failed") return value;
  return "pending";
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return !!value && typeof value === "object" && Object.values(value).every((item) => typeof item === "string");
}

function hexOrBase64ToBytes(value: string): Uint8Array {
  const clean = value.trim();
  if (/^[0-9a-fA-F]+$/.test(clean) && clean.length % 2 === 0) {
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    return bytes;
  }
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
