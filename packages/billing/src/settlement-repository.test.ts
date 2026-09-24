import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { SettlementRepository } from "./settlement-repository";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"), correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"), tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"), module: "billing", operation: "billing.settlement.manage",
    locale: "en", timezone: "UTC",
  };
}
describe("SettlementRepository",()=>{
  it("rejects deductions above gross",async()=>{
    const raw:D1DatabaseLike={prepare:()=>({bind(){return this},async first(){return null},async all(){return{results:[]}},async run(){return{success:true,meta:{changes:1}}}} as D1PreparedStatementLike),async batch(){return[]}};
    const r=new SettlementRepository(new D1Database(raw));
    await expect(r.createSettlement(context(),{
      id:brandId<"EntityId">("s-1"),businessId:brandId<"EntityId">("b-1"),provider:"test",currency:"USD",
      periodStart:"2026-09-01",periodEnd:"2026-09-30",correlationId:"corr-1",idempotencyKey:"s-1",
      requestedAt:"2026-09-24T10:00:00Z",now:"2026-09-24T10:00:00Z",
      items:[{id:brandId<"EntityId">("i-1"),sourceType:"payment",sourceReference:"p-1",grossAmountMinor:1000,feeAmountMinor:700,refundAmountMinor:400,currency:"USD",occurredAt:"2026-09-24T10:00:00Z",now:"2026-09-24T10:00:00Z"}]
    })).rejects.toThrow("deductions exceed gross");
  });
  it("requires items and integer financial values",async()=>{
    const raw:D1DatabaseLike={prepare:()=>({bind(){return this},async first(){return null},async all(){return{results:[]}},async run(){return{success:true,meta:{changes:1}}}} as D1PreparedStatementLike),async batch(){return[]}};
    const r=new SettlementRepository(new D1Database(raw));
    await expect(r.createSettlement(context(),{
      id:brandId<"EntityId">("s-1"),businessId:brandId<"EntityId">("b-1"),provider:"test",currency:"USD",
      periodStart:"2026-09-01",periodEnd:"2026-09-30",correlationId:"corr-1",idempotencyKey:"s-1",
      requestedAt:"2026-09-24T10:00:00Z",now:"2026-09-24T10:00:00Z",items:[]
    })).rejects.toThrow("at least one item");
  });
});
