import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export const ARVAN_AI_PROVIDER_ID = "arvan-aiaas" as const;
export const AI_WALLET_CURRENCY = "IRR" as const;
export const DEFAULT_AI_WALLET_MARKUP_BPS = 5000 as const;

export interface AiWalletPricingConfig {
  readonly providerId: string;
  readonly modelId: string;
  readonly currency?: string;
  readonly inputAmountPerMillionMinor: number;
  readonly outputAmountPerMillionMinor: number;
  readonly markupBps?: number;
  readonly pricingVersion?: string;
}

export interface AiWalletRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId | null;
  readonly userId: EntityId;
  readonly currency: string;
  readonly balanceMinor: number;
  readonly reservedMinor: number;
  readonly availableMinor: number;
  readonly status: "active" | "suspended" | "closed";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AiWalletQuote {
  readonly providerId: string;
  readonly modelId: string;
  readonly pricingVersion: string;
  readonly currency: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly providerCostMinor: number;
  readonly markupMinor: number;
  readonly customerChargeMinor: number;
}

export interface AiWalletReservation {
  readonly reservationId: string;
  readonly walletId: EntityId;
  readonly reservedMinor: number;
  readonly quote: AiWalletQuote;
}

export interface AiWalletUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface AiWalletServiceOptions {
  readonly database: D1Database;
  readonly id: () => EntityId;
  readonly now: () => string;
  readonly pricing: AiWalletPricingConfig;
  readonly defaultOutputTokenReserve?: number;
}

export interface AiWalletPreflight {
  readonly allowed: boolean;
  readonly availableMinor: number;
  readonly estimatedChargeMinor: number;
  readonly currency: string;
  readonly reason?: string;
}

export class InsufficientAiWalletError extends DatabaseError {
  constructor(message = "Insufficient AI wallet balance") {
    super(message);
    this.name = "InsufficientAiWalletError";
  }
}

export class AiWalletService extends Repository {
  constructor(private readonly options: AiWalletServiceOptions) {
    super(options.database);
    validatePricing(options.pricing);
  }

  async ensureWallet(context: RequestContext): Promise<AiWalletRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const userId = this.requireActor(context);
    const workspaceId = context.workspaceId ?? null;
    const currency = normalizeCurrency(this.options.pricing.currency ?? AI_WALLET_CURRENCY);
    const id = this.options.id();
    const now = this.options.now();

    await this.database.run(
      `INSERT OR IGNORE INTO billing_ai_wallets
       (id, organization_id, workspace_id, user_id, currency, balance_minor, reserved_minor, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, 0, 'active', ?, ?)`,
      id,
      organizationId,
      workspaceId,
      userId,
      currency,
      now,
      now,
    );

    const wallet = await this.getWallet(context);
    if (!wallet) throw new DatabaseError("AI wallet could not be initialized");
    return wallet;
  }

  async getWallet(context: RequestContext): Promise<AiWalletRecord | null> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const userId = this.requireActor(context);
    const workspaceId = context.workspaceId ?? null;
    const currency = normalizeCurrency(this.options.pricing.currency ?? AI_WALLET_CURRENCY);

    const row = await this.database.first<{
      id: EntityId;
      organizationId: EntityId;
      workspaceId: EntityId | null;
      userId: EntityId;
      currency: string;
      balanceMinor: number;
      reservedMinor: number;
      status: "active" | "suspended" | "closed";
      createdAt: string;
      updatedAt: string;
    }>(
      `SELECT id,
        organization_id AS organizationId,
        workspace_id AS workspaceId,
        user_id AS userId,
        currency,
        balance_minor AS balanceMinor,
        reserved_minor AS reservedMinor,
        status,
        created_at AS createdAt,
        updated_at AS updatedAt
       FROM billing_ai_wallets
       WHERE organization_id = ?
         AND (workspace_id IS ?)
         AND user_id = ?
         AND currency = ?
       LIMIT 1`,
      organizationId,
      workspaceId,
      userId,
      currency,
    );

    if (!row) return null;
    return {
      ...row,
      availableMinor: Math.max(0, row.balanceMinor - row.reservedMinor),
    };
  }

  async preflightArvan(
    context: RequestContext,
    input: {
      readonly modelId: string;
      readonly estimatedInputTokens: number;
      readonly estimatedOutputTokens?: number;
    },
  ): Promise<AiWalletPreflight> {
    const wallet = await this.ensureWallet(context);
    const quote = await this.quoteArvan(
      input.modelId,
      normalizeTokenCount(input.estimatedInputTokens),
      normalizeTokenCount(input.estimatedOutputTokens ?? this.options.defaultOutputTokenReserve ?? 3000),
    );
    if (wallet.status !== "active") {
      return {
        allowed: false,
        availableMinor: wallet.availableMinor,
        estimatedChargeMinor: quote.customerChargeMinor,
        currency: quote.currency,
        reason: "AI wallet is not active",
      };
    }
    if (wallet.availableMinor < quote.customerChargeMinor) {
      return {
        allowed: false,
        availableMinor: wallet.availableMinor,
        estimatedChargeMinor: quote.customerChargeMinor,
        currency: quote.currency,
        reason: "Insufficient AI wallet balance",
      };
    }
    return {
      allowed: true,
      availableMinor: wallet.availableMinor,
      estimatedChargeMinor: quote.customerChargeMinor,
      currency: quote.currency,
    };
  }

  async reserveArvan(
    context: RequestContext,
    input: {
      readonly operationId: string;
      readonly idempotencyKey: string;
      readonly modelId: string;
      readonly estimatedInputTokens: number;
      readonly estimatedOutputTokens?: number;
    },
  ): Promise<AiWalletReservation> {
    const wallet = await this.ensureWallet(context);
    const inputTokens = normalizeTokenCount(input.estimatedInputTokens);
    const outputTokens = normalizeTokenCount(input.estimatedOutputTokens ?? this.options.defaultOutputTokenReserve ?? 3000);
    const quote = await this.quoteArvan(input.modelId, inputTokens, outputTokens);
    const existing = await this.database.first<{
      id: string;
      walletId: EntityId;
      reservedMinor: number;
      metadataJson: string | null;
    }>(
      `SELECT id, wallet_id AS walletId, reserved_delta_minor AS reservedMinor, metadata_json AS metadataJson
       FROM billing_ai_wallet_events
       WHERE wallet_id = ? AND idempotency_key = ? AND event_type = 'reservation'
       LIMIT 1`,
      wallet.id,
      "reserve:" + input.idempotencyKey,
    );
    if (existing) {
      return {
        reservationId: existing.id,
        walletId: existing.walletId,
        reservedMinor: existing.reservedMinor,
        quote,
      };
    }

    const reservationId = this.options.id();
    const now = this.options.now();
    const updated = await this.database.run(
      `UPDATE billing_ai_wallets
       SET reserved_minor = reserved_minor + ?, updated_at = ?
       WHERE id = ?
         AND status = 'active'
         AND balance_minor - reserved_minor >= ?`,
      quote.customerChargeMinor,
      now,
      wallet.id,
      quote.customerChargeMinor,
    );
    if ((updated.meta?.changes ?? 0) !== 1) {
      throw new InsufficientAiWalletError();
    }

    try {
      await this.database.run(
        `INSERT INTO billing_ai_wallet_events
         (id, wallet_id, organization_id, workspace_id, user_id, event_type,
          balance_delta_minor, reserved_delta_minor, currency, operation_id,
          provider_id, model_id, pricing_reference, provider_cost_minor,
          markup_minor, customer_charge_minor, idempotency_key, correlation_id,
          occurred_at, created_at)
         VALUES (?, ?, ?, ?, ?, 'reservation', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        reservationId,
        wallet.id,
        wallet.organizationId,
        wallet.workspaceId,
        wallet.userId,
        quote.customerChargeMinor,
        quote.currency,
        input.operationId,
        quote.providerId,
        quote.modelId,
        quote.pricingVersion,
        quote.providerCostMinor,
        quote.markupMinor,
        quote.customerChargeMinor,
        "reserve:" + input.idempotencyKey,
        context.correlationId,
        now,
        now,
      );
    } catch (error) {
      await this.database.run(
        "UPDATE billing_ai_wallets SET reserved_minor = MAX(0, reserved_minor - ?), updated_at = ? WHERE id = ?",
        quote.customerChargeMinor,
        this.options.now(),
        wallet.id,
      ).catch(() => undefined);
      throw error;
    }

    return {
      reservationId,
      walletId: wallet.id,
      reservedMinor: quote.customerChargeMinor,
      quote,
    };
  }

  async settleArvan(
    context: RequestContext,
    reservation: AiWalletReservation,
    usage: AiWalletUsage,
    operationId: string,
    idempotencyKey: string,
  ): Promise<AiWalletQuote> {
    const inputTokens = normalizeTokenCount(usage.inputTokens);
    const outputTokens = normalizeTokenCount(usage.outputTokens);
    const quote = await this.quoteArvan(reservation.quote.modelId, inputTokens, outputTokens);
    const existing = await this.database.first<{
      providerCostMinor: number | null;
      markupMinor: number | null;
      customerChargeMinor: number | null;
    }>(
      `SELECT provider_cost_minor AS providerCostMinor,
        markup_minor AS markupMinor,
        customer_charge_minor AS customerChargeMinor
       FROM billing_ai_wallet_events
       WHERE wallet_id = ? AND idempotency_key = ? AND event_type = 'ai_charge'
       LIMIT 1`,
      reservation.walletId,
      "charge:" + idempotencyKey,
    );
    if (existing && existing.customerChargeMinor !== null && existing.providerCostMinor !== null && existing.markupMinor !== null) {
      return {
        ...quote,
        providerCostMinor: existing.providerCostMinor,
        markupMinor: existing.markupMinor,
        customerChargeMinor: existing.customerChargeMinor,
      };
    }

    const now = this.options.now();
    const updated = await this.database.run(
      `UPDATE billing_ai_wallets
       SET balance_minor = balance_minor - ?,
           reserved_minor = reserved_minor - ?,
           updated_at = ?
       WHERE id = ?
         AND status = 'active'
         AND reserved_minor >= ?
         AND balance_minor >= ?`,
      quote.customerChargeMinor,
      reservation.reservedMinor,
      now,
      reservation.walletId,
      reservation.reservedMinor,
      quote.customerChargeMinor,
    );
    if ((updated.meta?.changes ?? 0) !== 1) {
      throw new InsufficientAiWalletError("AI wallet could not settle the AI charge; please top up the wallet and retry.");
    }

    try {
      await this.database.run(
        `INSERT INTO billing_ai_wallet_events
         (id, wallet_id, organization_id, workspace_id, user_id, event_type,
          balance_delta_minor, reserved_delta_minor, currency, operation_id,
          provider_id, model_id, pricing_reference, provider_cost_minor,
          markup_minor, customer_charge_minor, idempotency_key, correlation_id,
          occurred_at, created_at)
         SELECT ?, wallet_id, organization_id, workspace_id, user_id, 'ai_charge',
          ?, ?, currency, ?, provider_id, model_id, pricing_reference, ?, ?, ?, ?, ?, ?, ?
         FROM billing_ai_wallet_events
         WHERE id = ?`,
        this.options.id(),
        -quote.customerChargeMinor,
        -reservation.reservedMinor,
        operationId,
        quote.providerCostMinor,
        quote.markupMinor,
        quote.customerChargeMinor,
        "charge:" + idempotencyKey,
        context.correlationId,
        now,
        now,
        reservation.reservationId,
      );
    } catch (error) {
      throw error;
    }

    return quote;
  }

  async releaseArvan(
    context: RequestContext,
    reservation: AiWalletReservation,
    operationId: string,
    idempotencyKey: string,
    reason: string,
  ): Promise<void> {
    const releaseKey = "release:" + idempotencyKey;
    const existing = await this.database.first<{ id: string }>(
      "SELECT id FROM billing_ai_wallet_events WHERE wallet_id = ? AND idempotency_key = ? LIMIT 1",
      reservation.walletId,
      releaseKey,
    );
    if (existing) return;

    const now = this.options.now();
    const updated = await this.database.run(
      `UPDATE billing_ai_wallets
       SET reserved_minor = reserved_minor - ?, updated_at = ?
       WHERE id = ? AND reserved_minor >= ?`,
      reservation.reservedMinor,
      now,
      reservation.walletId,
      reservation.reservedMinor,
    );
    if ((updated.meta?.changes ?? 0) !== 1) {
      throw new DatabaseError("AI wallet reservation could not be released");
    }

    await this.database.run(
      `INSERT INTO billing_ai_wallet_events
       (id, wallet_id, organization_id, workspace_id, user_id, event_type,
        balance_delta_minor, reserved_delta_minor, currency, operation_id,
        provider_id, model_id, pricing_reference, provider_cost_minor,
        markup_minor, customer_charge_minor, idempotency_key, correlation_id,
        metadata_json, occurred_at, created_at)
       SELECT ?, wallet_id, organization_id, workspace_id, user_id, 'reservation_release',
        0, ?, currency, ?, provider_id, model_id, pricing_reference,
        provider_cost_minor, markup_minor, customer_charge_minor, ?, ?, ?, ?, ?
       FROM billing_ai_wallet_events
       WHERE id = ?`,
      this.options.id(),
      -reservation.reservedMinor,
      operationId,
      releaseKey,
      context.correlationId,
      JSON.stringify({ reason }),
      now,
      now,
      reservation.reservationId,
    );
  }

  async creditWallet(
    context: RequestContext,
    input: {
      readonly amountMinor: number;
      readonly idempotencyKey: string;
      readonly referenceType?: string;
      readonly referenceId?: string;
      readonly metadata?: Readonly<Record<string, unknown>>;
    },
  ): Promise<AiWalletRecord> {
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
      throw new DatabaseError("AI wallet credit must be a positive integer minor-unit value");
    }
    const wallet = await this.ensureWallet(context);
    const existing = await this.database.first<{ id: string }>(
      "SELECT id FROM billing_ai_wallet_events WHERE wallet_id = ? AND idempotency_key = ? LIMIT 1",
      wallet.id,
      "topup:" + input.idempotencyKey,
    );
    if (existing) {
      const replay = await this.getWallet(context);
      if (!replay) throw new DatabaseError("AI wallet not found after top-up replay");
      return replay;
    }

    const now = this.options.now();
    await this.database.run(
      "UPDATE billing_ai_wallets SET balance_minor = balance_minor + ?, updated_at = ? WHERE id = ? AND status = 'active'",
      input.amountMinor,
      now,
      wallet.id,
    );
    await this.database.run(
      `INSERT INTO billing_ai_wallet_events
       (id, wallet_id, organization_id, workspace_id, user_id, event_type,
        balance_delta_minor, reserved_delta_minor, currency, idempotency_key,
        correlation_id, metadata_json, occurred_at, created_at)
       VALUES (?, ?, ?, ?, ?, 'topup', ?, 0, ?, ?, ?, ?, ?, ?)`,
      this.options.id(),
      wallet.id,
      wallet.organizationId,
      wallet.workspaceId,
      wallet.userId,
      input.amountMinor,
      wallet.currency,
      "topup:" + input.idempotencyKey,
      context.correlationId,
      JSON.stringify({
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        ...input.metadata,
      }),
      now,
      now,
    );
    const updated = await this.getWallet(context);
    if (!updated) throw new DatabaseError("AI wallet not found after top-up");
    return updated;
  }

  async quoteArvan(modelId: string, inputTokens: number, outputTokens: number): Promise<AiWalletQuote> {
    const pricing = await this.getOrCreatePricing(modelId);
    const providerCostMinor = calculateTokenCostMinor(
      inputTokens,
      pricing.inputAmountPerMillionMinor,
      outputTokens,
      pricing.outputAmountPerMillionMinor,
    );
    const customerChargeMinor = calculateCustomerChargeMinor(providerCostMinor, pricing.markupBps);
    return {
      providerId: pricing.providerId,
      modelId: pricing.modelId,
      pricingVersion: pricing.pricingVersion,
      currency: pricing.currency,
      inputTokens,
      outputTokens,
      providerCostMinor,
      markupMinor: Math.max(0, customerChargeMinor - providerCostMinor),
      customerChargeMinor,
    };
  }

  private async getOrCreatePricing(modelId: string): Promise<{
    providerId: string;
    modelId: string;
    currency: string;
    inputAmountPerMillionMinor: number;
    outputAmountPerMillionMinor: number;
    markupBps: number;
    pricingVersion: string;
  }> {
    const currency = normalizeCurrency(this.options.pricing.currency ?? AI_WALLET_CURRENCY);
    const existing = await this.database.first<{
      providerId: string;
      modelId: string;
      currency: string;
      inputAmountPerMillionMinor: number;
      outputAmountPerMillionMinor: number;
      markupBps: number;
      pricingVersion: string;
    }>(
      `SELECT provider_id AS providerId,
        model_id AS modelId,
        currency,
        input_amount_per_million_minor AS inputAmountPerMillionMinor,
        output_amount_per_million_minor AS outputAmountPerMillionMinor,
        markup_bps AS markupBps,
        pricing_version AS pricingVersion
       FROM billing_ai_model_prices
       WHERE provider_id = ? AND model_id = ? AND currency = ? AND status = 'active'
         AND effective_from <= ?
         AND (effective_to IS NULL OR effective_to > ?)
       ORDER BY effective_from DESC
       LIMIT 1`,
      this.options.pricing.providerId,
      modelId,
      currency,
      this.options.now(),
      this.options.now(),
    );
    if (existing) return existing;

    if (this.options.pricing.modelId !== modelId) {
      throw new DatabaseError("Arvan AI pricing is not configured for model: " + modelId);
    }

    const id = this.options.id();
    const now = this.options.now();
    const pricingVersion = this.options.pricing.pricingVersion?.trim() || "arvan-config-v1";
    await this.database.run(
      `UPDATE billing_ai_model_prices
       SET status = 'retired', effective_to = ?, updated_at = ?
       WHERE provider_id = ? AND model_id = ? AND currency = ? AND status = 'active'
         AND pricing_version <> ?`,
      now,
      now,
      this.options.pricing.providerId,
      modelId,
      currency,
      pricingVersion,
    );
    await this.database.run(
      `INSERT OR IGNORE INTO billing_ai_model_prices
       (id, provider_id, model_id, currency, input_amount_per_million_minor,
        output_amount_per_million_minor, markup_bps, pricing_version,
        effective_from, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      id,
      this.options.pricing.providerId,
      modelId,
      currency,
      this.options.pricing.inputAmountPerMillionMinor,
      this.options.pricing.outputAmountPerMillionMinor,
      this.options.pricing.markupBps ?? DEFAULT_AI_WALLET_MARKUP_BPS,
      pricingVersion,
      now,
      now,
      now,
    );
    const inserted = await this.database.first<{
      providerId: string;
      modelId: string;
      currency: string;
      inputAmountPerMillionMinor: number;
      outputAmountPerMillionMinor: number;
      markupBps: number;
      pricingVersion: string;
    }>(
      `SELECT provider_id AS providerId,
        model_id AS modelId,
        currency,
        input_amount_per_million_minor AS inputAmountPerMillionMinor,
        output_amount_per_million_minor AS outputAmountPerMillionMinor,
        markup_bps AS markupBps,
        pricing_version AS pricingVersion
       FROM billing_ai_model_prices
       WHERE provider_id = ? AND model_id = ? AND currency = ? AND status = 'active'
       ORDER BY effective_from DESC
       LIMIT 1`,
      this.options.pricing.providerId,
      modelId,
      currency,
    );
    if (!inserted) throw new DatabaseError("Arvan AI pricing could not be initialized");
    return inserted;
  }
}

export function estimateAiInputTokens(input: unknown): number {
  const serialized = typeof input === "string" ? input : JSON.stringify(input);
  const bytes = new TextEncoder().encode(serialized ?? "").byteLength;
  return Math.max(1, Math.ceil(bytes / 3) + 512);
}

export function calculateTokenCostMinor(
  inputTokens: number,
  inputAmountPerMillionMinor: number,
  outputTokens: number,
  outputAmountPerMillionMinor: number,
): number {
  const input = normalizeTokenCount(inputTokens);
  const output = normalizeTokenCount(outputTokens);
  const inputPrice = normalizeMoney(inputAmountPerMillionMinor);
  const outputPrice = normalizeMoney(outputAmountPerMillionMinor);
  const totalNumerator =
    BigInt(input) * BigInt(inputPrice)
    + BigInt(output) * BigInt(outputPrice);
  return Number((totalNumerator + 999_999n) / 1_000_000n);
}

export function calculateCustomerChargeMinor(providerCostMinor: number, markupBps = DEFAULT_AI_WALLET_MARKUP_BPS): number {
  const providerCost = normalizeMoney(providerCostMinor);
  const bps = normalizeMarkupBps(markupBps);
  return Number((BigInt(providerCost) * BigInt(10_000 + bps) + 9_999n) / 10_000n);
}

function validatePricing(pricing: AiWalletPricingConfig): void {
  if (!pricing.providerId.trim()) throw new DatabaseError("AI wallet provider is required");
  if (!pricing.modelId.trim()) throw new DatabaseError("AI wallet model is required");
  normalizeCurrency(pricing.currency ?? AI_WALLET_CURRENCY);
  normalizeMoney(pricing.inputAmountPerMillionMinor);
  normalizeMoney(pricing.outputAmountPerMillionMinor);
  normalizeMarkupBps(pricing.markupBps ?? DEFAULT_AI_WALLET_MARKUP_BPS);
}

function normalizeTokenCount(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new DatabaseError("AI token usage must be a non-negative integer");
  return value;
}

function normalizeMoney(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new DatabaseError("AI wallet monetary values must be non-negative safe integers");
  return value;
}

function normalizeMarkupBps(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100_000) {
    throw new DatabaseError("AI wallet markup must be between 0 and 100000 basis points");
  }
  return value;
}

function normalizeCurrency(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) throw new DatabaseError("AI wallet currency must be a 3-letter ISO currency code");
  return normalized;
}
