import { describe, expect, it } from "vitest";
import { createHttpPaymentProviderAdapter, createPaymentProviderRegistry, PaymentProviderError } from "./payment-provider-adapter";

describe("payment provider adapters", () => {
  it("rejects duplicate providers", () => {
    const adapter = createHttpPaymentProviderAdapter({
      providerId: "test",
      baseUrl: "https://payments.example/",
      apiKey: "secret",
      createPath: "/payments",
      capturePath: "/payments/capture",
      refundPath: "/refunds", payoutPath: "/payouts",
      webhookSecret: "webhook-secret",
      fetchImpl: async () => new Response(JSON.stringify({ status: "created", providerReference: "p-1" }), { status: 200 }),
    });
    expect(() => createPaymentProviderRegistry([adapter, adapter])).toThrow("already registered");
  });

  it("normalizes successful provider responses", async () => {
    const adapter = createHttpPaymentProviderAdapter({
      providerId: "test",
      baseUrl: "https://payments.example/",
      apiKey: "secret",
      createPath: "/payments",
      capturePath: "/payments/capture",
      refundPath: "/refunds",
      payoutPath: "/payouts",
      webhookSecret: "webhook-secret",
      fetchImpl: async (_url, init) => {
        expect(new Headers(init?.headers).get("idempotency-key")).toBe("payment-1");
        return new Response(JSON.stringify({ status: "captured", providerReference: "p-1" }), { status: 200 });
      },
    });
    const result = await adapter.capturePayment({
      paymentId: "payment-1" as never,
      providerReference: "p-1",
      idempotencyKey: "payment-1",
    });
    expect(result).toMatchObject({ status: "captured", provider: "test", providerReference: "p-1" });
  });

  it("classifies provider 429 and 5xx failures as transient", async () => {
    const adapter = createHttpPaymentProviderAdapter({
      providerId: "test",
      baseUrl: "https://payments.example/",
      apiKey: "secret",
      createPath: "/payments",
      capturePath: "/payments/capture",
      refundPath: "/refunds",
      webhookSecret: "webhook-secret",
      fetchImpl: async () => new Response(JSON.stringify({ code: "rate_limited" }), { status: 429 }),
    });
    await expect(adapter.createPayment({
      paymentId: "payment-1" as never,
      amountMinor: 1000,
      currency: "USD",
      idempotencyKey: "payment-1",
    })).rejects.toMatchObject({ failureClass: "transient", failureCode: "rate_limited" });
  });

  it("returns null for invalid webhook signatures", async () => {
    const adapter = createHttpPaymentProviderAdapter({
      providerId: "test",
      baseUrl: "https://payments.example/",
      apiKey: "secret",
      createPath: "/payments",
      capturePath: "/payments/capture",
      refundPath: "/refunds",
      webhookSecret: "webhook-secret",
      fetchImpl: async () => new Response("{}", { status: 200 }),
    });
    const event = await adapter.verifyWebhook({
      payload: JSON.stringify({ id: "evt-1", type: "payment.captured", providerReference: "p-1", status: "captured", occurredAt: "2026-09-24T10:00:00.000Z" }),
      signature: "deadbeef",
    });
    expect(event).toBeNull();
  });
});
