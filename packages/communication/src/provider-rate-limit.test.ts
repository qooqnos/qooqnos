import { describe, expect, it } from "vitest";
import { createCommunicationProviderRegistry, createHttpCommunicationProviderAdapter } from "./adapter";
import { CommunicationRateLimiter, detectCommunicationBurst } from "./rate-limit";

describe("Communication providers and rate limits", () => {
  it("normalizes an external HTTP provider response and propagates idempotency", async () => {
    let request: Request | undefined;
    const adapter = createHttpCommunicationProviderAdapter({
      providerId: "email.http",
      channels: ["email"],
      endpoint: "https://provider.example/send",
      authorization: { scheme: "Bearer", credential: "runtime-secret" },
      fetchImpl: async (input, init) => {
        request = new Request(input, init);
        return new Response(JSON.stringify({ id: "provider-message-1" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    const result = await adapter.deliver({
      now: "2026-09-24T10:00:00.000Z",
      notification: {
        id: "notification-1",
        organizationId: "org-1",
        workspaceId: null,
        recipientReference: "recipient-1",
        intent: "booking.confirmed",
        channel: "email",
        templateReference: null,
        templateVersion: null,
        locale: "en",
        variables: null,
        priority: "normal",
        status: "queued",
        idempotencyKey: "idem-1",
        scheduledAt: null,
        expiresAt: null,
        policyVersion: null,
        lastPolicyEvaluatedAt: null,
        createdAt: "2026-09-24T10:00:00.000Z",
        updatedAt: "2026-09-24T10:00:00.000Z",
      },
    });
    expect(result).toMatchObject({ status: "sent", provider: "email.http", providerReference: "provider-message-1" });
    expect(request?.headers.get("x-phoenix-idempotency-key")).toBe("idem-1");
    expect(request?.headers.get("authorization")).toBe("Bearer runtime-secret");
  });

  it("classifies 429 with Retry-After as transient", async () => {
    const adapter = createHttpCommunicationProviderAdapter({
      providerId: "sms.http",
      channels: ["sms"],
      endpoint: "https://provider.example/send",
      fetchImpl: async () => new Response(JSON.stringify({ error: "slow down" }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "17" },
      }),
    });
    const result = await adapter.deliver({
      now: "2026-09-24T10:00:00.000Z",
      notification: { id: "n", organizationId: "o", workspaceId: null, recipientReference: "r", intent: "x", channel: "sms", templateReference: null, templateVersion: null, locale: "en", variables: null, priority: "normal", status: "queued", idempotencyKey: "i", scheduledAt: null, expiresAt: null, policyVersion: null, lastPolicyEvaluatedAt: null, createdAt: "2026-09-24T10:00:00.000Z", updatedAt: "2026-09-24T10:00:00.000Z" },
    });
    expect(result).toMatchObject({ failureClass: "transient", failureCode: "provider_rate_limited", retryAfterSeconds: 17 });
  });

  it("enforces scoped limits without shared mutable database state", () => {
    let now = 1000;
    const limiter = new CommunicationRateLimiter([{ scope: "recipient", max: 2, windowMs: 1000 }], () => now);
    const key = { tenantReference: "org", recipientReference: "r", channel: "sms", intent: "x", provider: "sms.http" };
    expect(limiter.checkAndConsume(key).allowed).toBe(true);
    expect(limiter.checkAndConsume(key).allowed).toBe(true);
    expect(limiter.checkAndConsume(key)).toMatchObject({ allowed: false, retryAfterSeconds: 1 });
    now = 2000;
    expect(limiter.checkAndConsume(key).allowed).toBe(true);
  });

  it("detects burst anomalies inside a bounded window", () => {
    expect(detectCommunicationBurst([900, 950, 990], 1000, 3, 200)).toBe(true);
    expect(detectCommunicationBurst([700, 950], 1000, 3, 200)).toBe(false);
  });

  it("fails over to a secondary provider after repeated transient failures", () => {
    let now = 1000;
    const primary = { providerId: "email.primary", channels: ["email"] as const, async deliver() {
      return { status: "failed" as const, provider: "email.primary", failureClass: "transient" as const, failureCode: "provider_timeout" };
    }};
    const secondary = { providerId: "email.secondary", channels: ["email"] as const, async deliver() {
      return { status: "sent" as const, provider: "email.secondary", providerReference: "secondary-1" };
    }};
    const registry = createCommunicationProviderRegistry([primary, secondary], { failureThreshold: 2, cooldownSeconds: 30, clock: () => now });
    const notification = {
      id: "n", organizationId: "o", workspaceId: null, recipientReference: "r", intent: "x", channel: "email" as const,
      templateReference: null, templateVersion: null, locale: "en", variables: null, priority: "normal" as const,
      status: "queued" as const, idempotencyKey: "i", scheduledAt: null, expiresAt: null, policyVersion: null,
      lastPolicyEvaluatedAt: null, createdAt: "2026-09-24T10:00:00.000Z", updatedAt: "2026-09-24T10:00:00.000Z",
    };
    const first = registry.resolve("email")!;
    registry.report?.(first.providerId, await first.deliver({ notification, now: "1970-01-01T00:00:01.000Z" }), "1970-01-01T00:00:01.000Z");
    registry.report?.(first.providerId, await first.deliver({ notification, now: "1970-01-01T00:00:01.000Z" }), "1970-01-01T00:00:01.000Z");
    now = 2000;
    expect(registry.resolve("email")?.providerId).toBe("email.secondary");
  });

  it("blocks a burst during the anomaly cooldown", () => {
    let now = 1000;
    const limiter = new CommunicationRateLimiter(
      [],
      () => now,
      [{ scope: "recipient", threshold: 3, windowMs: 10_000, cooldownMs: 5_000 }],
    );
    const key = { tenantReference: "org", recipientReference: "r", channel: "push", intent: "account.security_push_alert", provider: "push.http" };
    expect(limiter.checkAndConsume(key).allowed).toBe(true);
    expect(limiter.checkAndConsume(key).allowed).toBe(true);
    expect(limiter.checkAndConsume(key)).toMatchObject({ allowed: false, anomalyDetected: true });
    now = 7000;
    expect(limiter.checkAndConsume(key).allowed).toBe(true);
  });
});
