import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { MatchingRepository } from "./repository";

function context():RequestContext{
 return {
  requestId:brandId<"RequestId">("req-1"),correlationId:brandId<"CorrelationId">("corr-1"),
  actorId:brandId<"EntityId">("user-1"),tenantId:brandId<"EntityId">("tenant-1"),
  workspaceId:brandId<"EntityId">("workspace-1"),module:"matching",operation:"matching.demand.create",locale:"en",timezone:"UTC"
 };
}

describe("MatchingRepository",()=>{
 it("requires exactly one typed target for candidates",async()=>{
  const statement:D1PreparedStatementLike={bind(){return this;},async first<T>(){return {
   id:"match-1",demandRequestId:"demand-1",organizationId:"tenant-1",workspaceId:"workspace-1",
   algorithmVersion:"v1",policyVersion:"p1",status:"created",requestedAt:"2026-09-22T00:00:00.000Z",
   completedAt:null,createdAt:"2026-09-22T00:00:00.000Z",updatedAt:"2026-09-22T00:00:00.000Z"
  } as T;},async all<T>(){return {results:[] as T[]};},async run(){return {success:true};}};
  const raw:D1DatabaseLike={prepare(){return statement;},async batch(){return[];}};
  const repository=new MatchingRepository(new D1Database(raw));
  await expect(repository.addCandidate(context(),{
   id:brandId<"EntityId">("candidate-1"),matchRequestId:brandId<"EntityId">("match-1"),
   retrievalSource:"search",now:"2026-09-22T00:00:00.000Z"
  })).rejects.toThrow("exactly one");
 });

  it("uses the latest Match decision when determining Connect eligibility", async () => {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>(/* eslint-disable @typescript-eslint/no-unused-vars */) { return { decision: "rejected" } as T; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch() { return []; },
    };
    const repository = new MatchingRepository(new D1Database(raw));

    const selected = await repository.hasSelectedDecision(
      context(),
      brandId<"EntityId">("match-1"),
      brandId<"EntityId">("candidate-1"),
    );

    expect(selected).toBe(false);
  });

});
