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
}

export interface CommunicationProviderAdapter {
  readonly providerId: string;
  readonly channels: readonly NotificationRecord["channel"][];
  deliver(request: CommunicationDeliveryRequest): Promise<CommunicationDeliveryResult>;
}

export interface CommunicationProviderRegistry {
  resolve(channel: NotificationRecord["channel"]): CommunicationProviderAdapter | null;
}

export function createCommunicationProviderRegistry(
  adapters: readonly CommunicationProviderAdapter[] = [],
): CommunicationProviderRegistry {
  const channelMap = new Map<NotificationRecord["channel"], CommunicationProviderAdapter>();

  for (const adapter of adapters) {
    if (!adapter.providerId.trim()) throw new Error("Communication providerId is required");
    for (const channel of adapter.channels) {
      if (channelMap.has(channel)) throw new Error("Communication provider already registered for channel " + channel);
      channelMap.set(channel, adapter);
    }
  }

  return {
    resolve(channel) {
      return channelMap.get(channel) ?? null;
    },
  };
}

export const inAppCommunicationProvider: CommunicationProviderAdapter = {
  providerId: "in_app",
  channels: ["in_app"],
  async deliver({ notification }) {
    return {
      status: "delivered",
      provider: "in_app",
      providerReference: "in_app:" + notification.id,
    };
  },
};
