import type { EntityId, RequestContext } from "@qooqnos/core";
import type { PaymentProviderRegistry, PaymentProviderResult } from "./payment-provider-adapter";
import type { SettlementRepository, SettlementRecord } from "./settlement-repository";

export class SettlementService {
  constructor(
    private readonly repository: SettlementRepository,
    private readonly providers: PaymentProviderRegistry,
    private readonly now: () => string,
  ) {}

  async payout(context: RequestContext, settlement: SettlementRecord): Promise<SettlementRecord> {
    if (settlement.status !== "processing") throw new Error("Settlement must be processing before provider payout");
    const provider = this.providers.resolve(settlement.provider);
    if (!provider) throw new Error("Payment provider is not configured: " + settlement.provider);
    const result: PaymentProviderResult = await provider.payoutSettlement({
      settlementId: settlement.id,
      businessReference: settlement.businessId,
      amountMinor: settlement.netAmountMinor,
      currency: settlement.settlementCurrency,
      idempotencyKey: "settlement:" + settlement.id,
    });
    if (result.status === "failed") throw new Error(result.failureCode ?? "Settlement provider payout failed");
    if (!result.providerReference) throw new Error("Settlement provider did not return a provider reference");
    return this.repository.recordProviderPayout(
      context,
      settlement.id,
      result.providerReference,
      result.providerStatus ?? result.status,
      this.now(),
    );
  }
}
