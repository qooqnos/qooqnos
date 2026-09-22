import { describe, expect, it } from "vitest";
import { brandId } from "@qooqnos/core";
import { dispatchQueuedNotifications } from "./dispatch";
import { createCommunicationProviderRegistry, inAppCommunicationProvider } from "./adapter";
import type { NotificationRecord } from "./repository";

function notification(channel: NotificationRecord["channel"] = "in_app"): NotificationRecord {
  return {
    id: brandId<"EntityId">("notification-1"),
    organizationId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    recipientReference: "customer-1",
    intent: "booking.confirmed",
    channel,
    templateReference: null,
    templateVersion: null,
    locale: "en",
    variables: null,
    priority: "normal",
    status: "queued",
    idempotencyKey: "idem-1",
    scheduledAt: null,
    expiresAt: null,
    lastPolicyEvaluatedAt: null,
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
  };
}

describe("Communication dispatch", () => {
  it("claims and delivers an in-app notification exactly once", async () => {
    const calls: string[] = [];
    const repository = {
      async listDispatchableNotifications() {
        return [notification()];
      },
      async claimQueuedNotification() {
        calls.push("claim");
        return true;
      },
      async appendDeliveryAttempt() {
        calls.push("attempt");
      },
      async markDispatchResult() {
        calls.push("mark");
        return true;
      },
      async requeueNotification() {
        calls.push("requeue");
        return true;
      },
    } as never;

    const result = await dispatchQueuedNotifications(
      repository,
      createCommunicationProviderRegistry([inAppCommunicationProvider]),
      "2026-09-22T00:01:00.000Z",
    );

    expect(result).toEqual({ processed: 1, delivered: 1, failed: 0, skipped: 0 });
    expect(calls).toEqual(["claim", "attempt", "mark"]);
  });

  it("fails closed when no provider adapter exists for the channel", async () => {
    const calls: string[] = [];
    const repository = {
      async listDispatchableNotifications() {
        return [notification("sms")];
      },
      async claimQueuedNotification() {
        return true;
      },
      async appendDeliveryAttempt(_context: unknown, input: { readonly provider: string; readonly failureCode?: string }) {
        calls.push(input.provider + ":" + input.failureCode);
      },
      async markDispatchResult() {
        calls.push("mark");
        return true;
      },
      async requeueNotification() {
        calls.push("requeue");
        return true;
      },
    } as never;

    const result = await dispatchQueuedNotifications(
      repository,
      createCommunicationProviderRegistry([inAppCommunicationProvider]),
      "2026-09-22T00:01:00.000Z",
    );

    expect(result.failed).toBe(1);
    expect(calls).toEqual(["unconfigured:provider_adapter_unconfigured", "mark"]);
  });

  it("requeues transient provider failures", async () => {
    const calls: string[] = [];
    const transientProvider = {
      providerId: "test",
      channels: ["email"] as const,
      async deliver() {
        return {
          status: "failed" as const,
          provider: "test",
          failureCode: "timeout",
          failureClass: "transient" as const,
        };
      },
    };

    const repository = {
      async listDispatchableNotifications() {
        return [notification("email")];
      },
      async claimQueuedNotification() {
        return true;
      },
      async appendDeliveryAttempt() {
        calls.push("attempt");
      },
      async markDispatchResult() {
        calls.push("mark");
        return true;
      },
      async requeueNotification() {
        calls.push("requeue");
        return true;
      },
    } as never;

    const result = await dispatchQueuedNotifications(
      repository,
      createCommunicationProviderRegistry([transientProvider]),
      "2026-09-22T00:01:00.000Z",
    );

    expect(result.failed).toBe(1);
    expect(calls).toEqual(["attempt", "requeue"]);
  });
});
