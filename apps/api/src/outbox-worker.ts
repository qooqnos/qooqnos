import { CommunicationRepository } from "@qooqnos/communication";
import { DiscoveryOutboxProcessor, DiscoveryRepository } from "@qooqnos/discovery";
import { brandId } from "@qooqnos/core";
import { OutboxService, type OutboxEventRecord } from "@qooqnos/database";
import { getDatabase } from "./database";
import { createRequestContext } from "./context";
import type { ApiEnv } from "./env";

export interface ScheduledControllerLike {
  readonly scheduledTime: number;
}

export interface QueueMessageLike<T> {
  readonly body: T;
  ack(): void;
  retry(): void;
}

export interface QueueBatchLike<T> {
  readonly messages: readonly QueueMessageLike<T>[];
}

export async function publishPendingOutbox(
  env: ApiEnv,
  now = new Date().toISOString(),
  limit = 50,
): Promise<{ published: number; failed: number }> {
  const database = getDatabase(env);
  const queue = env.OUTBOX_QUEUE;
  if (!database || !queue) return { published: 0, failed: 0 };

  const outbox = new OutboxService(database);
  const events = await outbox.listPending(now, limit);
  let published = 0;
  let failed = 0;

  for (const event of events) {
    const leaseUntil = new Date(Date.parse(now) + 60_000).toISOString();
    const claimed = await outbox.claimPending(event.id, now, leaseUntil);
    if (!claimed) continue;

    try {
      await queue.send(event);
      await outbox.markPublished(event.id, new Date().toISOString());
      published += 1;
    } catch {
      await outbox.scheduleRetry(
        event.id,
        retryAt(event.attempts + 1, now),
      );
      failed += 1;
    }
  }

  return { published, failed };
}

export async function consumeOutbox(
  env: ApiEnv,
  batch: QueueBatchLike<OutboxEventRecord>,
): Promise<{ processed: number }> {
  const database = getDatabase(env);
  const communication = database ? new CommunicationRepository(database) : null;
  const discovery = database ? new DiscoveryOutboxProcessor({ repository: new DiscoveryRepository(database) }) : null;

  for (const message of batch.messages) {
    try {
      const event = message.body;

      if (event.eventType === "communication.notification.created") {
        if (!communication || !event.organizationId) {
          throw new Error("Communication notification event cannot be processed without D1 scope");
        }

        const payload = parsePayload(event.payloadJson);
        const notificationId = payload.notificationId;
        if (typeof notificationId !== "string" || !notificationId) {
          throw new Error("Communication notification event is missing notificationId");
        }

        await communication.queueNotificationFromSystem({
          organizationId: brandId<"EntityId">(event.organizationId),
          workspaceId: event.workspaceId ? brandId<"EntityId">(event.workspaceId) : null,
          notificationId: brandId<"EntityId">(notificationId),
          now: new Date().toISOString(),
        });
      }

      if (
        discovery
        && (
          event.eventType === "catalog.product.created"
          || event.eventType === "business.created.v1"
          || event.eventType === "business.publication.changed.v1"
        )
      ) {
        if (!event.organizationId || !event.workspaceId) {
          throw new Error("Discovery projection event cannot be processed without tenant/workspace scope");
        }
        const context = createRequestContext({
          module: "discovery",
          operation: "discovery.project",
          actorId: "system",
          tenantId: event.organizationId,
          workspaceId: event.workspaceId,
          correlationId: event.id,
          requestId: event.id,
          authenticated: true,
        });
        await discovery.process(context, {
          id: event.id,
          eventType: event.eventType,
          eventVersion: event.eventVersion,
          payloadJson: event.payloadJson,
          occurredAt: event.occurredAt,
        });
      }

      message.ack();
    } catch {
      message.retry();
    }
  }

  return { processed: batch.messages.length };
}

function parsePayload(payloadJson: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(payloadJson);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Outbox payload must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function retryAt(attempt: number, now: string): string {
  const boundedAttempt = Math.min(Math.max(attempt, 1), 10);
  const delayMs = Math.min(5 * 60_000, 1_000 * 2 ** boundedAttempt);
  return new Date(Date.parse(now) + delayMs).toISOString();
}
