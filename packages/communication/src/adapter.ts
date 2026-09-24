import type { NotificationRecord } from "./repository";

export interface CommunicationDeliveryRequest {
  readonly notification: NotificationRecord;
  readonly now: string;
}

export interface CommunicationDeliveryResult {
  readonly status: "delivered" | "sent" | "failed";
  readonly provider: string;
  readonly providerReference?: string;
  readonly failureCode?: string;
  readonly failureClass?: "transient" | "permanent";
  readonly retryAfterSeconds?: number;
}

export interface CommunicationProviderAdapter {
  readonly providerId: string;
  readonly channels: readonly NotificationRecord["channel"][];
  deliver(request: CommunicationDeliveryRequest): Promise<CommunicationDeliveryResult>;
}

export interface CommunicationProviderRegistry {
  resolve(channel: NotificationRecord["channel"]): CommunicationProviderAdapter | null;
}

export interface HttpCommunicationProviderConfig {
  readonly providerId: string;
  readonly channels: readonly NotificationRecord["channel"][];
  readonly endpoint: string;
  readonly authorization?: { readonly scheme: string; readonly credential: string };
  readonly headers?: Readonly<Record<string, string>>;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  readonly buildPayload?: (notification: NotificationRecord) => unknown;
  readonly parseResponse?: (payload: unknown, response: Response, notification: NotificationRecord) => CommunicationDeliveryResult;
}

export function createCommunicationProviderRegistry(
  adapters: readonly CommunicationProviderAdapter[] = [],
): CommunicationProviderRegistry {
  const channelMap = new Map<NotificationRecord["channel"], CommunicationProviderAdapter>();
  for (const adapter of adapters) {
    if (!adapter.providerId.trim()) throw new Error("Communication providerId is required");
    if (adapter.channels.length === 0) throw new Error("Communication provider must declare channels");
    for (const channel of adapter.channels) {
      if (channelMap.has(channel)) throw new Error("Communication provider already registered for channel " + channel);
      channelMap.set(channel, adapter);
    }
  }
  return { resolve: (channel) => channelMap.get(channel) ?? null };
}

export function createHttpCommunicationProviderAdapter(
  config: HttpCommunicationProviderConfig,
): CommunicationProviderAdapter {
  if (!config.providerId.trim()) throw new Error("Communication providerId is required");
  if (!config.endpoint.startsWith("https://")) throw new Error("Communication provider endpoint must use HTTPS");
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = Math.min(Math.max(config.timeoutMs ?? 15000, 1000), 60000);

  return {
    providerId: config.providerId,
    channels: config.channels,
    async deliver({ notification, now }) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const headers: Record<string, string> = {
          "content-type": "application/json",
          "x-phoenix-idempotency-key": notification.idempotencyKey,
          "x-phoenix-notification-id": notification.id,
          ...(config.headers ?? {}),
        };
        if (config.authorization) {
          headers.authorization = config.authorization.scheme + " " + config.authorization.credential;
        }
        const response = await fetchImpl(config.endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(config.buildPayload?.(notification) ?? {
            notificationId: notification.id,
            recipient: notification.recipientReference,
            intent: notification.intent,
            channel: notification.channel,
            template: notification.templateReference,
            templateVersion: notification.templateVersion,
            locale: notification.locale,
            variables: notification.variables,
            priority: notification.priority,
            scheduledAt: notification.scheduledAt,
            expiresAt: notification.expiresAt,
          }),
          signal: controller.signal,
        });

        let payload: unknown = null;
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("json")) {
          try { payload = await response.json(); } catch { payload = null; }
        } else {
          try { payload = await response.text(); } catch { payload = null; }
        }

        if (!response.ok) {
          const retryAfter = parseRetryAfter(response.headers.get("retry-after"), now);
          return {
            status: "failed",
            provider: config.providerId,
            failureCode: response.status === 429 ? "provider_rate_limited" : "provider_request_failed",
            failureClass: response.status === 429 || response.status >= 500 ? "transient" : "permanent",
            ...(retryAfter !== undefined ? { retryAfterSeconds: retryAfter } : {}),
          };
        }

        return config.parseResponse?.(payload, response, notification) ?? {
          status: "sent",
          provider: config.providerId,
          providerReference: extractProviderReference(payload) ?? config.providerId + ":" + notification.id,
        };
      } catch (error) {
        return {
          status: "failed",
          provider: config.providerId,
          failureCode: error instanceof DOMException && error.name === "AbortError" ? "provider_timeout" : "provider_network_error",
          failureClass: "transient",
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function extractProviderReference(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const value = (payload as Record<string, unknown>).id ?? (payload as Record<string, unknown>).message_id;
  return typeof value === "string" && value.trim() ? value : undefined;
}

function parseRetryAfter(value: string | null, now: string): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(Math.ceil(seconds), 86400);
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return undefined;
  return Math.min(Math.max(Math.ceil((date - Date.parse(now)) / 1000), 0), 86400);
}

export const inAppCommunicationProvider: CommunicationProviderAdapter = {
  providerId: "in_app",
  channels: ["in_app"],
  async deliver({ notification }) {
    return { status: "delivered", provider: "in_app", providerReference: "in_app:" + notification.id };
  },
};
