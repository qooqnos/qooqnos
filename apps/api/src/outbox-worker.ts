import { OutboxService, type OutboxEventRecord } from "@qooqnos/database";
import { getDatabase } from "./database";
import type { ApiEnv, CloudflareQueueBinding } from "./env";

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
  const processed = batch.messages.length;
  for (const message of batch.messages) {
    try {
      // Downstream consumers are intentionally not coupled here. Queue delivery is
      // only the transport boundary; domain-specific consumers process the event
      // through their owning capability.
      message.ack();
    } catch {
      message.retry();
    }
  }
  return { processed };
}

function retryAt(attempt: number, now: string): string {
  const boundedAttempt = Math.min(Math.max(attempt, 1), 10);
  const delayMs = Math.min(5 * 60_000, 1_000 * 2 ** boundedAttempt);
  return new Date(Date.parse(now) + delayMs).toISOString();
}
