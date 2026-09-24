import type { EntityId, RequestContext } from "@qooqnos/core";
import type { BillingRepository } from "./repository";
import type {
  PaymentCaptureRequest,
  PaymentCreateRequest,
  PaymentProviderRegistry,
  PaymentRefundRequest,
  PaymentProviderResult,
} from "./payment-provider-adapter";

export class PaymentProviderService {
  constructor(
    private readonly registry: PaymentProviderRegistry,
    private readonly repository: BillingRepository,
    private readonly id: () => EntityId,
    private readonly now: () => string,
  ) {}

  async createPayment(context: RequestContext, providerId: string, request: PaymentCreateRequest): Promise<PaymentProviderResult> {
    const adapter = this.requireProvider(providerId);
    const result = await adapter.createPayment(request);
    if (result.providerReference) {
      await this.repository.recordProviderReference(context, {
        id: this.id(),
        provider: result.provider,
        referenceType: "payment",
        externalReference: result.providerReference,
        status: result.status,
        metadata: { ...(result.providerStatus ? { providerStatus: result.providerStatus } : {}) },
        now: this.now(),
      });
    }
    return result;
  }

  async capturePayment(context: RequestContext, providerId: string, request: PaymentCaptureRequest): Promise<PaymentProviderResult> {
    const adapter = this.requireProvider(providerId);
    const result = await adapter.capturePayment(request);
    await this.recordReference(context, result, "payment_capture");
    return result;
  }

  async refundPayment(context: RequestContext, providerId: string, request: PaymentRefundRequest): Promise<PaymentProviderResult> {
    const adapter = this.requireProvider(providerId);
    const result = await adapter.refundPayment(request);
    await this.recordReference(context, result, "refund");
    return result;
  }

  private async recordReference(context: RequestContext, result: PaymentProviderResult, referenceType: string): Promise<void> {
    if (!result.providerReference) return;
    await this.repository.recordProviderReference(context, {
      id: this.id(),
      provider: result.provider,
      referenceType,
      externalReference: result.providerReference,
      status: result.status,
      metadata: { ...(result.providerStatus ? { providerStatus: result.providerStatus } : {}) },
      now: this.now(),
    });
  }

  private requireProvider(providerId: string) {
    const adapter = this.registry.resolve(providerId.trim());
    if (!adapter) throw new Error("Payment provider is not configured: " + providerId);
    return adapter;
  }
}
