import { brandId, type EntityId, type RequestContext } from "@qooqnos/core";
import { CommunicationRepository, type NotificationRecord } from "./repository";
import type { CommunicationProviderRegistry, CommunicationDeliveryResult } from "./adapter";
import { CommunicationRateLimiter, type CommunicationRateLimitKey } from "./rate-limit";

export interface CommunicationDispatchResult {
  readonly processed: number;
  readonly delivered: number;
  readonly failed: number;
  readonly skipped: number;
}

export async function dispatchQueuedNotifications(
  repository: CommunicationRepository,
  registry: CommunicationProviderRegistry,
  now: string,
  limit = 50,
  rateLimiter?: CommunicationRateLimiter,
): Promise<CommunicationDispatchResult> {
  const notifications = await repository.listDispatchableNotifications(now, limit);
  let delivered = 0;
  let failed = 0;
  let skipped = 0;

  for (const notification of notifications) {
    const claimed = await repository.claimQueuedNotification(
      notification.id,
      notification.organizationId,
      notification.workspaceId,
      now,
    );
    if (!claimed) {
      skipped += 1;
      continue;
    }

    const adapter = registry.resolve(notification.channel);
    if (!adapter) {
      await repository.appendDeliveryAttempt(
        systemContext(notification),
        {
          id: ("delivery:" + notification.id + ":" + now) as EntityId,
          notificationId: notification.id,
          provider: "unconfigured",
          channel: notification.channel,
          status: "failed",
          attemptedAt: now,
          failureCode: "provider_adapter_unconfigured",
          failureClass: "permanent",
          now,
        },
      );
      await repository.markDispatchResult(notification.id, notification.organizationId, notification.workspaceId, "failed", now);
      failed += 1;
      continue;
    }

    if (rateLimiter) {
      const rateKey: CommunicationRateLimitKey = {
        tenantReference: notification.organizationId,
        recipientReference: notification.recipientReference,
        channel: notification.channel,
        intent: notification.intent,
        provider: adapter.providerId,
      };
      const decision = rateLimiter.checkAndConsume(rateKey);
      if (!decision.allowed) {
        await repository.appendDeliveryAttempt(systemContext(notification), {
          id: ("delivery:" + notification.id + ":rate:" + now) as EntityId,
          notificationId: notification.id,
          provider: adapter.providerId,
          channel: notification.channel,
          status: "failed",
          attemptedAt: now,
          failureCode: decision.anomalyDetected ? "communication_burst_anomaly_" + decision.scope : "platform_rate_limited_" + decision.scope,
          failureClass: "transient",
          nextRetryAt: new Date(Date.parse(now) + decision.retryAfterSeconds * 1000).toISOString(),
          now,
        });
        await repository.requeueNotification(notification.id, notification.organizationId, notification.workspaceId, new Date(Date.parse(now) + decision.retryAfterSeconds * 1000).toISOString(), now);
        failed += 1;
        continue;
      }
    }

    let result: CommunicationDeliveryResult;
    try {
      result = await adapter.deliver({ notification, now });
    } catch {
      result = {
        status: "failed",
        provider: adapter.providerId,
        failureCode: "provider_adapter_error",
        failureClass: "transient",
      };
    }

    registry.report?.(adapter.providerId, result, now);

    await repository.appendDeliveryAttempt(
      systemContext(notification),
      {
        id: ("delivery:" + notification.id + ":" + now) as EntityId,
        notificationId: notification.id,
        provider: result.provider,
        channel: notification.channel,
        status: result.status === "delivered" ? "delivered" : result.status === "sent" ? "sent" : "failed",
        attemptedAt: now,
        ...(result.providerReference ? { providerReference: result.providerReference } : {}),
        ...(result.failureCode ? { failureCode: result.failureCode } : {}),
        ...(result.failureClass ? { failureClass: result.failureClass } : {}),
        now,
      },
    );

    if (result.status === "failed" && result.failureClass === "transient") {
      await repository.requeueNotification(
        notification.id,
        notification.organizationId,
        notification.workspaceId,
        result.retryAfterSeconds ? new Date(Date.parse(now) + result.retryAfterSeconds * 1000).toISOString() : retryAt(now, notification.priority),
        now,
      );
      failed += 1;
    } else {
      await repository.markDispatchResult(
        notification.id,
        notification.organizationId,
        notification.workspaceId,
        result.status === "failed" ? "failed" : result.status === "delivered" ? "delivered" : "sent",
        now,
      );
      if (result.status === "failed") failed += 1;
      else delivered += 1;
    }
  }

  return { processed: notifications.length, delivered, failed, skipped };
}

function systemContext(notification: NotificationRecord): RequestContext {
  return {
    requestId: brandId<"RequestId">("communication:" + notification.id),
    correlationId: brandId<"CorrelationId">("communication:" + notification.id),
    actorId: brandId<"EntityId">("system:" + notification.organizationId),
    tenantId: notification.organizationId,
    ...(notification.workspaceId ? { workspaceId: notification.workspaceId } : {}),
    module: "communication",
    operation: "communication.delivery.dispatch",
    locale: notification.locale ?? "en",
    timezone: "UTC",
    authenticated: true,
  };
}


function retryAt(now: string, priority: NotificationRecord["priority"]): string {
  const baseMinutes = priority === "urgent" ? 1 : priority === "high" ? 2 : priority === "normal" ? 5 : 10;
  return new Date(Date.parse(now) + baseMinutes * 60_000).toISOString();
}
