import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type SettlementStatus = "pending" | "approved" | "processing" | "paid" | "failed" | "cancelled";
export type SettlementItemType = "payment" | "refund" | "fee" | "adjustment";

export interface SettlementRecord {
  readonly id: EntityId; readonly organizationId: EntityId; readonly workspaceId: EntityId | null;
  readonly businessId: EntityId; readonly provider: string; readonly settlementCurrency: string;
  readonly grossAmountMinor: number; readonly feeAmountMinor: number; readonly refundAmountMinor: number;
  readonly netAmountMinor: number; readonly status: SettlementStatus; readonly providerReference: string | null;
  readonly providerStatus: string | null; readonly ledgerTransactionId: EntityId | null;
  readonly periodStart: string; readonly periodEnd: string; readonly requestedBy: EntityId | null;
  readonly approvedBy: EntityId | null; readonly requestedAt: string; readonly processedAt: string | null;
  readonly completedAt: string | null; readonly failureCode: string | null;
  readonly correlationId: string; readonly idempotencyKey: string;
  readonly createdAt: string; readonly updatedAt: string;
}
export interface SettlementItemInput {
  readonly id: EntityId; readonly sourceType: SettlementItemType; readonly sourceReference: string;
  readonly grossAmountMinor: number; readonly feeAmountMinor: number; readonly refundAmountMinor: number;
  readonly currency: string; readonly occurredAt: string; readonly now: string;
}
export interface SettlementRequestInput {
  readonly id: EntityId; readonly businessId: EntityId; readonly provider: string;
  readonly currency: string; readonly periodStart: string; readonly periodEnd: string;
  readonly requestedBy?: EntityId; readonly correlationId: string; readonly idempotencyKey: string;
  readonly requestedAt: string; readonly now: string;
  readonly items: readonly SettlementItemInput[];
}
export interface SettlementPostingInput {
  readonly settlementId: EntityId; readonly ledgerTransactionId: EntityId;
  readonly debitAccountId: EntityId; readonly creditAccountId: EntityId;
  readonly occurredAt: string; readonly now: string;
}
export interface SettlementItemRecord extends SettlementItemInput {
  readonly settlementId: EntityId; readonly organizationId: EntityId; readonly workspaceId: EntityId | null; readonly businessId: EntityId; readonly netAmountMinor: number;
}

export class SettlementRepository extends Repository {
  constructor(database: D1Database) { super(database); }

  async createSettlement(context: RequestContext, input: SettlementRequestInput): Promise<SettlementRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const currency = normalizeCurrency(input.currency);
    if (!input.businessId) throw new DatabaseError("Settlement business is required");
    if (!input.provider.trim()) throw new DatabaseError("Settlement provider is required");
    if (!input.idempotencyKey.trim()) throw new DatabaseError("Settlement idempotency key is required");
    if (!input.items.length) throw new DatabaseError("Settlement requires at least one item");
    let gross=0, fee=0, refund=0;
    for (const item of input.items) {
      if (normalizeCurrency(item.currency)!==currency) throw new DatabaseError("Settlement item currency mismatch");
      for (const amount of [item.grossAmountMinor,item.feeAmountMinor,item.refundAmountMinor]) {
        if (!Number.isSafeInteger(amount) || amount < 0) throw new DatabaseError("Settlement amounts must be non-negative integer minor units");
      }
      if (item.feeAmountMinor + item.refundAmountMinor > item.grossAmountMinor) throw new DatabaseError("Settlement item deductions exceed gross amount");
      gross += item.grossAmountMinor; fee += item.feeAmountMinor; refund += item.refundAmountMinor;
    }
    if (!Number.isSafeInteger(gross+fee+refund) || gross <= 0) throw new DatabaseError("Settlement gross amount is invalid");
    const net=gross-fee-refund;
    if (net < 0) throw new DatabaseError("Settlement net amount cannot be negative");
    const existing=await this.getByIdempotency(context,input.idempotencyKey.trim());
    if(existing){ if(existing.businessId!==input.businessId || existing.netAmountMinor!==net || existing.settlementCurrency!==currency) throw new DatabaseError("Settlement idempotency key reused with different financial input"); return existing; }
    await this.database.run(
      "INSERT INTO billing_settlements (id,organization_id,workspace_id,business_id,provider,settlement_currency,gross_amount_minor,fee_amount_minor,refund_amount_minor,net_amount_minor,status,period_start,period_end,requested_by,requested_at,correlation_id,idempotency_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'pending',?,?,?,?,?,?,?,?,?)",
      input.id,organizationId,context.workspaceId??null,input.businessId,input.provider.trim(),currency,gross,fee,refund,net,input.periodStart,input.periodEnd,input.requestedBy??context.actorId??null,input.requestedAt,input.correlationId,input.idempotencyKey.trim(),input.now,input.now
    );
    for(const item of input.items){
      const netItem=item.grossAmountMinor-item.feeAmountMinor-item.refundAmountMinor;
      await this.database.run(
        "INSERT INTO billing_settlement_items (id,settlement_id,organization_id,workspace_id,business_id,source_type,source_reference,gross_amount_minor,fee_amount_minor,refund_amount_minor,net_amount_minor,currency,occurred_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        item.id,input.id,organizationId,context.workspaceId??null,input.businessId,item.sourceType,item.sourceReference.trim(),item.grossAmountMinor,item.feeAmountMinor,item.refundAmountMinor,netItem,currency,item.occurredAt,item.now
      );
    }
    const result=await this.get(context,input.id); if(!result) throw new DatabaseError("Settlement not found after creation"); return result;
  }

  async approveSettlement(context: RequestContext, settlementId: EntityId, approvedBy: EntityId, now: string): Promise<SettlementRecord> {
    const s=await this.get(context,settlementId); if(!s) throw new DatabaseError("Settlement not found");
    if(s.status!=="pending") throw new DatabaseError("Only pending settlements can be approved");
    if(s.requestedBy && s.requestedBy===approvedBy) throw new DatabaseError("Settlement approval requires separation from requester");
    await this.transition(context,settlementId,"approved",approvedBy,now);
    return (await this.get(context,settlementId))!;
  }
  async markProcessing(context: RequestContext, settlementId: EntityId, now: string): Promise<SettlementRecord> {
    const s=await this.get(context,settlementId); if(!s || s.status!=="approved") throw new DatabaseError("Settlement must be approved before processing");
    await this.database.run("UPDATE billing_settlements SET status='processing',processed_at=?,updated_at=? WHERE id=? AND organization_id=? AND status='approved'",now,now,settlementId,this.requireOrganization({organizationId:context.tenantId}));
    return (await this.get(context,settlementId))!;
  }
  async recordProviderPayout(context: RequestContext, settlementId: EntityId, providerReference: string, providerStatus: string, now: string): Promise<SettlementRecord> {
    const s=await this.get(context,settlementId); if(!s) throw new DatabaseError("Settlement not found");
    if(s.status!=="processing") throw new DatabaseError("Settlement must be processing before provider payout is recorded");
    await this.database.run("UPDATE billing_settlements SET status='paid',provider_reference=?,provider_status=?,completed_at=?,updated_at=? WHERE id=? AND organization_id=? AND status='processing'",providerReference.trim(),providerStatus.trim(),now,now,settlementId,this.requireOrganization({organizationId:context.tenantId}));
    return (await this.get(context,settlementId))!;
  }
  async postSettlementAccounting(context: RequestContext,input:SettlementPostingInput): Promise<SettlementRecord>{
    const org=this.requireOrganization({organizationId:context.tenantId}); const s=await this.get(context,input.settlementId);
    if(!s) throw new DatabaseError("Settlement not found"); if(s.status!=="processing"&&s.status!=="paid") throw new DatabaseError("Settlement must be processing or paid before accounting"); if(s.ledgerTransactionId) throw new DatabaseError("Settlement accounting is already posted");
    const accounts=await this.database.all<{id:string;currency:string}>( "SELECT id,currency FROM billing_ledger_accounts WHERE id IN (?,?) AND organization_id=?",input.debitAccountId,input.creditAccountId,org);
    if(accounts.length!==2||accounts[0]?.id===accounts[1]?.id) throw new DatabaseError("Settlement accounting requires two distinct ledger accounts");
    if(accounts.some(a=>a.currency!==s.settlementCurrency)) throw new DatabaseError("Settlement accounting currency mismatch");
    const items=await this.listItems(context,s.id); if(!items.length||items.reduce((n,i)=>n+i.netAmountMinor,0)!==s.netAmountMinor) throw new DatabaseError("Settlement items do not reconcile to net amount");
    await this.database.transaction([
      {sql:"INSERT INTO billing_ledger_transactions (id,organization_id,workspace_id,business_id,transaction_type,source_type,source_id,currency,idempotency_key,correlation_id,occurred_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",params:[input.ledgerTransactionId,org,context.workspaceId??null,s.businessId,"settlement","settlement",s.id,s.settlementCurrency,"settlement:"+s.id,s.correlationId,input.occurredAt,input.now]},
      {sql:"INSERT INTO billing_ledger_entries (id,transaction_id,account_id,organization_id,workspace_id,business_id,direction,amount_minor,currency,source_reference,created_at) VALUES (?,?,?,?,?,?,'debit',?,?,?,?)",params:[input.ledgerTransactionId+":debit",input.ledgerTransactionId,input.debitAccountId,org,context.workspaceId??null,s.businessId,s.netAmountMinor,s.settlementCurrency,s.id,input.now]},
      {sql:"INSERT INTO billing_ledger_entries (id,transaction_id,account_id,organization_id,workspace_id,business_id,direction,amount_minor,currency,source_reference,created_at) VALUES (?,?,?,?,?,?,'credit',?,?,?,?)",params:[input.ledgerTransactionId+":credit",input.ledgerTransactionId,input.creditAccountId,org,context.workspaceId??null,s.businessId,s.netAmountMinor,s.settlementCurrency,s.id,input.now]},
      {sql:"UPDATE billing_settlements SET ledger_transaction_id=?,updated_at=? WHERE id=? AND organization_id=? AND ledger_transaction_id IS NULL",params:[input.ledgerTransactionId,input.now,s.id,org]}
    ]);
    return (await this.get(context,s.id))!;
  }
  async get(context:RequestContext,id:EntityId):Promise<SettlementRecord|null>{
    return this.database.first<SettlementRecord>("SELECT id,organization_id AS organizationId,workspace_id AS workspaceId,business_id AS businessId,provider,settlement_currency AS settlementCurrency,gross_amount_minor AS grossAmountMinor,fee_amount_minor AS feeAmountMinor,refund_amount_minor AS refundAmountMinor,net_amount_minor AS netAmountMinor,status,provider_reference AS providerReference,provider_status AS providerStatus,ledger_transaction_id AS ledgerTransactionId,period_start AS periodStart,period_end AS periodEnd,requested_by AS requestedBy,approved_by AS approvedBy,requested_at AS requestedAt,processed_at AS processedAt,completed_at AS completedAt,failure_code AS failureCode,correlation_id AS correlationId,idempotency_key AS idempotencyKey,created_at AS createdAt,updated_at AS updatedAt FROM billing_settlements WHERE id=? AND organization_id=? AND (workspace_id IS NULL OR workspace_id=?) LIMIT 1",id,this.requireOrganization({organizationId:context.tenantId}),context.workspaceId??null);
  }
  async listItems(context:RequestContext,settlementId:EntityId):Promise<readonly SettlementItemRecord[]>{
    return this.database.all<SettlementItemRecord>("SELECT id,settlement_id AS settlementId,organization_id AS organizationId,workspace_id AS workspaceId,business_id AS businessId,source_type AS sourceType,source_reference AS sourceReference,gross_amount_minor AS grossAmountMinor,fee_amount_minor AS feeAmountMinor,refund_amount_minor AS refundAmountMinor,net_amount_minor AS netAmountMinor,currency,occurred_at AS occurredAt,created_at AS createdAt FROM billing_settlement_items WHERE settlement_id=? AND organization_id=? AND (workspace_id IS NULL OR workspace_id=?) ORDER BY occurred_at,id",settlementId,this.requireOrganization({organizationId:context.tenantId}),context.workspaceId??null);
  }
  private async getByIdempotency(context:RequestContext,key:string){return this.database.first<SettlementRecord>("SELECT id,organization_id AS organizationId,workspace_id AS workspaceId,business_id AS businessId,provider,settlement_currency AS settlementCurrency,gross_amount_minor AS grossAmountMinor,fee_amount_minor AS feeAmountMinor,refund_amount_minor AS refundAmountMinor,net_amount_minor AS netAmountMinor,status,provider_reference AS providerReference,provider_status AS providerStatus,ledger_transaction_id AS ledgerTransactionId,period_start AS periodStart,period_end AS periodEnd,requested_by AS requestedBy,approved_by AS approvedBy,requested_at AS requestedAt,processed_at AS processedAt,completed_at AS completedAt,failure_code AS failureCode,correlation_id AS correlationId,idempotency_key AS idempotencyKey,created_at AS createdAt,updated_at AS updatedAt FROM billing_settlements WHERE organization_id=? AND idempotency_key=? LIMIT 1",this.requireOrganization({organizationId:context.tenantId}),key);}
  private async transition(context:RequestContext,id:EntityId,status:"approved",approvedBy:EntityId,now:string){await this.database.run("UPDATE billing_settlements SET status=?,approved_by=?,updated_at=? WHERE id=? AND organization_id=? AND status='pending'",status,approvedBy,now,id,this.requireOrganization({organizationId:context.tenantId}));}
}
function normalizeCurrency(v:string){const n=v.trim().toUpperCase();if(!/^[A-Z]{3}$/.test(n))throw new DatabaseError("Settlement currency must be a 3-letter ISO currency code");return n;}
