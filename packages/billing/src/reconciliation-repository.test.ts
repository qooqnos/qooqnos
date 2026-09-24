import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { ReconciliationRepository } from "./reconciliation-repository";

const context = (): RequestContext => ({
  requestId: brandId<"RequestId">("req-1"), correlationId: brandId<"CorrelationId">("corr-1"),
  actorId: brandId<"EntityId">("actor-1"), tenantId: brandId<"EntityId">("tenant-1"),
  workspaceId: brandId<"EntityId">("workspace-1"), module: "billing", operation: "billing.reconciliation.manage",
  locale: "en", timezone: "UTC",
});
const db=()=>new D1Database({
  prepare:()=>({bind(){return this},async first(){return null},async all(){return{results:[]}},async run(){return{success:true,meta:{changes:1}}}} as D1PreparedStatementLike),
  async batch(){return[]},
} as D1DatabaseLike);

describe("ReconciliationRepository",()=>{
 it("requires an idempotency key",async()=>{
   const r=new ReconciliationRepository(db());
   await expect(r.openMismatch(context(),{id:brandId<"EntityId">("case-1"),provider:"provider",referenceType:"payment",category:"amount_mismatch",correlationId:"corr-1",idempotencyKey:"",openedAt:"2026-09-24T10:00:00Z",now:"2026-09-24T10:00:00Z"})).rejects.toThrow("idempotency key");
 });
 it("rejects invalid financial amounts",async()=>{
   const r=new ReconciliationRepository(db());
   await expect(r.openMismatch(context(),{id:brandId<"EntityId">("case-1"),provider:"provider",referenceType:"payment",category:"amount_mismatch",expectedAmountMinor:-1,correlationId:"corr-1",idempotencyKey:"r-1",openedAt:"2026-09-24T10:00:00Z",now:"2026-09-24T10:00:00Z"})).rejects.toThrow("non-negative");
 });
});
