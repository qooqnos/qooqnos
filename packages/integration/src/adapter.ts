import type { RequestContext } from "@qooqnos/core";
import type { IntegrationAccountRecord, IntegrationRepository } from "./repository";

export interface IntegrationWebhookRequest {
  readonly account: IntegrationAccountRecord;
  readonly eventId: string;
  readonly eventType: string;
  readonly payloadReference: string | null;
  readonly correlationId: string;
  readonly now: string;
  readonly context: RequestContext;
}

export interface IntegrationSyncRequest {
  readonly account: IntegrationAccountRecord;
  readonly syncType: string;
  readonly direction: "inbound" | "outbound" | "bidirectional";
  readonly cursorReference: string | null;
  readonly checkpointReference: string | null;
  readonly correlationId: string;
  readonly now: string;
  readonly context: RequestContext;
}

export interface IntegrationAdapterResult {
  readonly status: "processed" | "ignored";
  readonly cursorReference?: string;
  readonly checkpointReference?: string;
  readonly itemCount?: number;
  readonly errorCount?: number;
  readonly externalReferences?: readonly {
    readonly resourceType: string;
    readonly resourceId: string;
    readonly externalType: string;
    readonly externalReference: string;
    readonly status?: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }[];
}

export interface IntegrationProviderAdapter {
  readonly providerId: string;
  readonly supportedWebhookTypes: readonly string[];
  readonly supportedSyncTypes: readonly string[];
  processWebhook(
    request: IntegrationWebhookRequest,
    repository: IntegrationRepository,
  ): Promise<IntegrationAdapterResult>;
  processSync(
    request: IntegrationSyncRequest,
    repository: IntegrationRepository,
  ): Promise<IntegrationAdapterResult>;
}

export interface IntegrationProviderRegistry {
  resolve(providerId: string): IntegrationProviderAdapter | null;
}

export function createIntegrationProviderRegistry(
  adapters: readonly IntegrationProviderAdapter[] = [],
): IntegrationProviderRegistry {
  const map = new Map<string, IntegrationProviderAdapter>();

  for (const adapter of adapters) {
    if (!adapter.providerId.trim()) throw new Error("Integration providerId is required");
    if (map.has(adapter.providerId)) {
      throw new Error("Integration provider already registered: " + adapter.providerId);
    }
    map.set(adapter.providerId, adapter);
  }

  return {
    resolve(providerId) {
      return map.get(providerId) ?? null;
    },
  };
}
