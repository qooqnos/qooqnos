import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type RefundStatus = "requested" | "approved" | "processing" | "succeeded" | "failed" | "cancelled";
export type LedgerDirection = "debit" | "credit";
export type LedgerAccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

export interface LedgerAccountInput {
  readonly id: EntityId;
  readonly businessId?: EntityId | undefined;
  readonly accountCode: string;
  readonly name: string;
  readonly accountType: LedgerAccountType;
  readonly currency: string;
  readonly normalBalance: LedgerDirection;
  readonly parentAccountId?: EntityId | undefined;
  readonly now: string;
}

export interface RefundRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId | null;
  readonly businessId: EntityId | null;
  readonly paymentReference: string;
  readonly orderReference: string | null;
  readonly requestedAmountMinor: number;
  readonly refundedAmountMinor: number;
  readonly currency: string;
  readonly reasonCode: string;
  readonly status: RefundStatus;
  readonly provider: string | null;
  readonly providerReference: string | null;
  readonly providerStatus: string | null;
  readonly ledgerTransactionId: EntityId | null;
  readonly requestedBy: EntityId | null;
  readonly approvedBy: EntityId | null;
  readonly requestedAt: string;
  readonly processedAt: string | null;
  readonly completedAt: string | null;
  readonly failureCode: string | null;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RefundRequestInput {
  readonly id: EntityId;
  readonly paymentReference: string;
  readonly orderReference?: string | undefined;
  readonly businessId?: EntityId | undefined;
  readonly requestedAmountMinor: number;
  readonly currency: string;
  readonly reasonCode: string;
  readonly requestedBy?: EntityId | undefined;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly requestedAt: string;
  readonly now: string;
}

export interface RefundAccountingInput {
  readonly refundId: EntityId;
  readonly ledgerTransactionId: EntityId;
  readonly debitAccountId: EntityId;
  readonly creditAccountId: EntityId;
  readonly occurredAt: string;
  readonly now: string;
}

export interface LedgerEntryRecord {
  readonly id: EntityId;
  readonly transactionId: EntityId;
  readonly accountId: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId | null;
  readonly businessId: EntityId | null;
  readonly direction: LedgerDirection;
  readonly amountMinor: number;
  readonly currency: string;
  readonly sourceReference: string;
  readonly reversalOfEntryId: EntityId | null;
  readonly createdAt: string;
}

export class RefundAccountingRepository extends Repository {
  constructor(database: D1Database) {
    super(database);
  }

  async createRefund(context: RequestContext, input: RefundRequestInput): Promise<RefundRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    if (!input.paymentReference.trim()) throw new DatabaseError("Refund payment reference is required");
    if (!Number.isSafeInteger(input.requestedAmountMinor) || input.requestedAmountMinor <= 0) {
      throw new DatabaseError("Refund amount must be a positive integer minor-unit value");
    }
    const currency = normalizeCurrency(input.currency);
    if (!input.reasonCode.trim()) throw new DatabaseError("Refund reason code is required");
    if (!input.idempotencyKey.trim()) throw new DatabaseError("Refund idempotency key is required");

    const existing = await this.database.first<RefundRecord>(
      `SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, business_id AS businessId,
        payment_reference AS paymentReference, order_reference AS orderReference,
        requested_amount_minor AS requestedAmountMinor, refunded_amount_minor AS refundedAmountMinor,
        currency, reason_code AS reasonCode, status, provider, provider_reference AS providerReference,
        provider_status AS providerStatus, ledger_transaction_id AS ledgerTransactionId,
        requested_by AS requestedBy, approved_by AS approvedBy, requested_at AS requestedAt,
        processed_at AS processedAt, completed_at AS completedAt, failure_code AS failureCode,
        correlation_id AS correlationId, idempotency_key AS idempotencyKey,
        created_at AS createdAt, updated_at AS updatedAt
       FROM billing_refunds
       WHERE organization_id = ? AND idempotency_key = ?
       LIMIT 1`,
      organizationId, input.idempotencyKey.trim(),
    );
    if (existing) {
      if (
        existing.paymentReference !== input.paymentReference.trim() ||
        existing.requestedAmountMinor !== input.requestedAmountMinor ||
        existing.currency !== currency
      ) throw new DatabaseError("Refund idempotency key reused with different financial input");
      return existing;
    }

    await this.database.run(
      `INSERT INTO billing_refunds
       (id, organization_id, workspace_id, business_id, payment_reference, order_reference,
        requested_amount_minor, refunded_amount_minor, currency, reason_code, status,
        requested_by, requested_at, correlation_id, idempotency_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'requested', ?, ?, ?, ?, ?, ?)`,
      input.id, organizationId, context.workspaceId ?? null, input.businessId ?? null,
      input.paymentReference.trim(), input.orderReference?.trim() ?? null,
      input.requestedAmountMinor, currency, input.reasonCode.trim(), input.requestedBy ?? context.actorId ?? null,
      input.requestedAt, input.correlationId, input.idempotencyKey.trim(), input.now, input.now,
    );
    const record = await this.getRefund(context, input.id);
    if (!record) throw new DatabaseError("Refund not found after creation");
    return record;
  }

  async approveRefund(context: RequestContext, refundId: EntityId, approvedBy: EntityId, now: string): Promise<RefundRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const refund = await this.getRefund(context, refundId);
    if (!refund) throw new DatabaseError("Refund not found");
    if (refund.status !== "requested") throw new DatabaseError("Only requested refunds can be approved");
    if (refund.requestedBy && refund.requestedBy === approvedBy) {
      throw new DatabaseError("Refund approval requires separation from the requester");
    }
    const result = await this.database.run(
      `UPDATE billing_refunds
       SET status = 'approved', approved_by = ?, updated_at = ?
       WHERE id = ? AND organization_id = ? AND status = 'requested'`,
      approvedBy, now, refundId, organizationId,
    );
    if ((result.meta?.changes ?? 0) !== 1) throw new DatabaseError("Refund approval lost its state transition");
    const updated = await this.getRefund(context, refundId);
    if (!updated) throw new DatabaseError("Refund not found after approval");
    return updated;
  }

  async markRefundProcessing(context: RequestContext, refundId: EntityId, now: string): Promise<RefundRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const result = await this.database.run(
      `UPDATE billing_refunds
       SET status = 'processing', processed_at = ?, updated_at = ?
       WHERE id = ? AND organization_id = ? AND status = 'approved'`,
      now, now, refundId, organizationId,
    );
    if ((result.meta?.changes ?? 0) !== 1) throw new DatabaseError("Refund must be approved before processing");
    const updated = await this.getRefund(context, refundId);
    if (!updated) throw new DatabaseError("Refund not found after processing transition");
    return updated;
  }

  async postSuccessfulRefundAccounting(
    context: RequestContext,
    input: RefundAccountingInput,
  ): Promise<RefundRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const refund = await this.getRefund(context, input.refundId);
    if (!refund) throw new DatabaseError("Refund not found");
    if (refund.status !== "processing" && refund.status !== "approved") {
      throw new DatabaseError("Refund must be approved or processing before accounting");
    }
    if (refund.ledgerTransactionId) throw new DatabaseError("Refund accounting is already posted");
    if (!Number.isSafeInteger(refund.requestedAmountMinor) || refund.requestedAmountMinor <= 0) {
      throw new DatabaseError("Refund amount is invalid");
    }

    const accounts = await this.database.all<{ id: string; currency: string; organizationId: string; workspaceId: string | null; businessId: string | null }>(
      `SELECT id, currency, organization_id AS organizationId, workspace_id AS workspaceId, business_id AS businessId
       FROM billing_ledger_accounts
       WHERE id IN (?, ?) AND organization_id = ?`,
      input.debitAccountId, input.creditAccountId, organizationId,
    );
    if (accounts.length !== 2) throw new DatabaseError("Refund accounting requires two distinct ledger accounts");
    if (accounts[0]?.id === accounts[1]?.id) throw new DatabaseError("Refund accounting accounts must be distinct");
    for (const account of accounts) {
      if (account.currency !== refund.currency) throw new DatabaseError("Refund accounting currency mismatch");
      if (account.workspaceId !== null && account.workspaceId !== (context.workspaceId ?? null)) {
        throw new DatabaseError("Refund accounting workspace mismatch");
      }
      if (account.businessId !== null && account.businessId !== (refund.businessId ?? null)) {
        throw new DatabaseError("Refund accounting business mismatch");
      }
    }

    await this.database.transaction([
      {
        sql: `INSERT INTO billing_ledger_transactions
          (id, organization_id, workspace_id, business_id, transaction_type, source_type, source_id,
           currency, idempotency_key, correlation_id, occurred_at, created_at)
          VALUES (?, ?, ?, ?, 'refund', 'refund', ?, ?, ?, ?, ?, ?)`,
        params: [
          input.ledgerTransactionId, organizationId, context.workspaceId ?? null, refund.businessId,
          refund.id, refund.currency, "refund:" + refund.id, refund.correlationId, input.occurredAt, input.now,
        ],
      },
      {
        sql: `INSERT INTO billing_ledger_entries
          (id, transaction_id, account_id, organization_id, workspace_id, business_id,
           direction, amount_minor, currency, source_reference, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'debit', ?, ?, ?, ?)`,
        params: [
          input.ledgerTransactionId + ":debit", input.ledgerTransactionId, input.debitAccountId,
          organizationId, context.workspaceId ?? null, refund.businessId, refund.requestedAmountMinor,
          refund.currency, refund.id, input.now,
        ],
      },
      {
        sql: `INSERT INTO billing_ledger_entries
          (id, transaction_id, account_id, organization_id, workspace_id, business_id,
           direction, amount_minor, currency, source_reference, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'credit', ?, ?, ?, ?)`,
        params: [
          input.ledgerTransactionId + ":credit", input.ledgerTransactionId, input.creditAccountId,
          organizationId, context.workspaceId ?? null, refund.businessId, refund.requestedAmountMinor,
          refund.currency, refund.id, input.now,
        ],
      },
      {
        sql: `UPDATE billing_refunds
          SET status = 'succeeded', refunded_amount_minor = requested_amount_minor,
              ledger_transaction_id = ?, completed_at = ?, updated_at = ?
          WHERE id = ? AND organization_id = ? AND ledger_transaction_id IS NULL
            AND status IN ('approved','processing')`,
        params: [input.ledgerTransactionId, input.occurredAt, input.now, refund.id, organizationId],
      },
    ]);
    const updated = await this.getRefund(context, refund.id);
    if (!updated || updated.status !== "succeeded") throw new DatabaseError("Refund accounting did not complete");
    return updated;
  }

  async getRefund(context: RequestContext, id: EntityId): Promise<RefundRecord | null> {
    return this.database.first<RefundRecord>(
      `SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, business_id AS businessId,
        payment_reference AS paymentReference, order_reference AS orderReference,
        requested_amount_minor AS requestedAmountMinor, refunded_amount_minor AS refundedAmountMinor,
        currency, reason_code AS reasonCode, status, provider, provider_reference AS providerReference,
        provider_status AS providerStatus, ledger_transaction_id AS ledgerTransactionId,
        requested_by AS requestedBy, approved_by AS approvedBy, requested_at AS requestedAt,
        processed_at AS processedAt, completed_at AS completedAt, failure_code AS failureCode,
        correlation_id AS correlationId, idempotency_key AS idempotencyKey,
        created_at AS createdAt, updated_at AS updatedAt
       FROM billing_refunds
       WHERE id = ? AND organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?)
       LIMIT 1`,
      id, this.requireOrganization({ organizationId: context.tenantId }), context.workspaceId ?? null,
    );
  }

  async listLedgerEntries(context: RequestContext, transactionId: EntityId): Promise<readonly LedgerEntryRecord[]> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    return this.database.all<LedgerEntryRecord>(
      `SELECT id, transaction_id AS transactionId, account_id AS accountId,
        organization_id AS organizationId, workspace_id AS workspaceId, business_id AS businessId,
        direction, amount_minor AS amountMinor, currency, source_reference AS sourceReference,
        reversal_of_entry_id AS reversalOfEntryId, created_at AS createdAt
       FROM billing_ledger_entries
       WHERE transaction_id = ? AND organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?)
       ORDER BY id ASC`,
      transactionId, organizationId, context.workspaceId ?? null,
    );
  }

  async createLedgerAccount(context: RequestContext, input: LedgerAccountInput): Promise<void> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const currency = normalizeCurrency(input.currency);
    if (!input.accountCode.trim() || !input.name.trim()) throw new DatabaseError("Ledger account code and name are required");
    await this.database.run(
      `INSERT INTO billing_ledger_accounts
       (id, organization_id, workspace_id, business_id, account_code, name, account_type,
        currency, normal_balance, status, parent_account_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
      input.id, organizationId, context.workspaceId ?? null, input.businessId ?? null,
      input.accountCode.trim(), input.name.trim(), input.accountType, currency, input.normalBalance,
      input.parentAccountId ?? null, input.now, input.now,
    );
  }
}

function normalizeCurrency(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) throw new DatabaseError("Billing currency must be a 3-letter ISO currency code");
  return normalized;
}
