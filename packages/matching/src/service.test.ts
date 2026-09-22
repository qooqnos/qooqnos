import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { MatchingService } from "./service";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "matching",
    operation: "matching.request.execute",
    locale: "en",
    timezone: "UTC",
  };
}

function authorization() {
  return {
    async assert() {},
  } as never;
}

describe("MatchingService", () => {
  it("requires a workspace-scoped match request for retrieval", async () => {
    const calls: string[] = [];
    const service = new MatchingService({
      repository: {
        async getMatchRequest() {
          return {
            id: "match-1",
            demandRequestId: "demand-1",
            organizationId: "tenant-1",
            workspaceId: null,
            algorithmVersion: "deterministic-v1",
            policyVersion: "policy-1",
            status: "created",
            requestedAt: "2026-09-22T00:00:00.000Z",
            completedAt: null,
            createdAt: "2026-09-22T00:00:00.000Z",
            updatedAt: "2026-09-22T00:00:00.000Z",
          };
        },
      } as never,
      discovery: {
        async search() {
          calls.push("search");
          return [];
        },
      } as never,
      authorization: authorization(),
      id: () => brandId<"EntityId">("generated"),
      now: () => "2026-09-22T00:01:00.000Z",
    });

    await expect(service.retrieveAndRank(context(), {
      matchRequestId: brandId<"EntityId">("match-1"),
      query: "formal hair",
    })).rejects.toThrow("workspace scope");

    expect(calls).toEqual([]);
  });

  it("retrieves eligible business projections and ranks them deterministically", async () => {
    const statuses: string[] = [];
    const candidates: Array<{ id: string; score: number; rank: number }> = [];

    const service = new MatchingService({
      repository: {
        async getMatchRequest() {
          return {
            id: "match-1",
            demandRequestId: "demand-1",
            organizationId: "tenant-1",
            workspaceId: "workspace-1",
            algorithmVersion: "deterministic-v1",
            policyVersion: "policy-1",
            status: "created",
            requestedAt: "2026-09-22T00:00:00.000Z",
            completedAt: null,
            createdAt: "2026-09-22T00:00:00.000Z",
            updatedAt: "2026-09-22T00:00:00.000Z",
          };
        },
        async listCandidates() {
          return [];
        },
        async setMatchStatus(_context: RequestContext, _id: string, status: string) {
          statuses.push(status);
          return {
            id: "match-1",
            demandRequestId: "demand-1",
            organizationId: "tenant-1",
            workspaceId: "workspace-1",
            algorithmVersion: "deterministic-v1",
            policyVersion: "policy-1",
            status,
            requestedAt: "2026-09-22T00:00:00.000Z",
            completedAt: status === "decided" ? "2026-09-22T00:01:00.000Z" : null,
            createdAt: "2026-09-22T00:00:00.000Z",
            updatedAt: "2026-09-22T00:01:00.000Z",
          };
        },
        async addCandidate(_context: RequestContext, input: {
          readonly id: string;
          readonly matchRequestId: string;
          readonly businessId?: string;
          readonly retrievalSource: string;
          readonly retrievalScore?: number;
          readonly rankingScore?: number;
          readonly rankPosition?: number;
        }) {
          candidates.push({
            id: input.businessId ?? input.id,
            score: input.rankingScore ?? 0,
            rank: input.rankPosition ?? 0,
          });
          return {
            id: input.id,
            matchRequestId: input.matchRequestId,
            businessId: input.businessId ?? null,
            offeringId: null,
            retrievalSource: input.retrievalSource,
            retrievalScore: input.retrievalScore ?? null,
            rankingScore: input.rankingScore ?? null,
            rankPosition: input.rankPosition ?? null,
            eligibilityStatus: "eligible",
            reasons: [],
            featureSnapshot: {},
            createdAt: "2026-09-22T00:01:00.000Z",
          };
        },
      } as never,
      discovery: {
        async search() {
          return [
            {
              id: "doc-1",
              organizationId: "tenant-1",
              workspaceId: "workspace-1",
              sourceType: "business",
              sourceId: "business-a",
              documentVersion: 1,
              title: "Alpha",
              body: null,
              metadata: null,
              eligibility: "eligible",
              createdAt: "2026-09-22T00:00:00.000Z",
              updatedAt: "2026-09-22T00:00:00.000Z",
            },
            {
              id: "doc-2",
              organizationId: "tenant-1",
              workspaceId: "workspace-1",
              sourceType: "business",
              sourceId: "business-b",
              documentVersion: 1,
              title: "Beta",
              body: null,
              metadata: null,
              eligibility: "eligible",
              createdAt: "2026-09-22T00:00:00.000Z",
              updatedAt: "2026-09-22T00:02:00.000Z",
            },
          ];
        },
      } as never,
      authorization: authorization(),
      id: (() => {
        let n = 0;
        return () => brandId<"EntityId">(`candidate-${++n}`);
      })(),
      now: () => "2026-09-22T00:01:00.000Z",
    });

    const result = await service.retrieveAndRank(context(), {
      matchRequestId: brandId<"EntityId">("match-1"),
      query: "formal hair",
      limit: 10,
    });

    expect(statuses).toEqual(["retrieving", "ranking", "decided"]);
    expect(candidates).toEqual([
      { id: "business-a", score: 1.1, rank: 1 },
      { id: "business-b", score: 0.5, rank: 2 },
    ]);
    expect(result.candidates).toHaveLength(2);
  });

  it("replays existing candidates without calling Discovery", async () => {
    let searched = false;
    const service = new MatchingService({
      repository: {
        async getMatchRequest() {
          return {
            id: "match-1",
            demandRequestId: "demand-1",
            organizationId: "tenant-1",
            workspaceId: "workspace-1",
            algorithmVersion: "deterministic-v1",
            policyVersion: "policy-1",
            status: "decided",
            requestedAt: "2026-09-22T00:00:00.000Z",
            completedAt: "2026-09-22T00:01:00.000Z",
            createdAt: "2026-09-22T00:00:00.000Z",
            updatedAt: "2026-09-22T00:01:00.000Z",
          };
        },
        async listCandidates() {
          return [{
            id: "candidate-1",
            matchRequestId: "match-1",
            businessId: "business-1",
            offeringId: null,
            retrievalSource: "discovery.lexical",
            retrievalScore: 1,
            rankingScore: 1,
            rankPosition: 1,
            eligibilityStatus: "eligible",
            reasons: [],
            featureSnapshot: {},
            createdAt: "2026-09-22T00:01:00.000Z",
          }];
        },
        async setMatchStatus() {
          return {
            id: "match-1",
            demandRequestId: "demand-1",
            organizationId: "tenant-1",
            workspaceId: "workspace-1",
            algorithmVersion: "deterministic-v1",
            policyVersion: "policy-1",
            status: "decided",
            requestedAt: "2026-09-22T00:00:00.000Z",
            completedAt: "2026-09-22T00:01:00.000Z",
            createdAt: "2026-09-22T00:00:00.000Z",
            updatedAt: "2026-09-22T00:01:00.000Z",
          };
        },
      } as never,
      discovery: {
        async search() {
          searched = true;
          return [];
        },
      } as never,
      authorization: authorization(),
      id: () => brandId<"EntityId">("candidate-2"),
      now: () => "2026-09-22T00:01:00.000Z",
    });

    const result = await service.retrieveAndRank(context(), {
      matchRequestId: brandId<"EntityId">("match-1"),
      query: "formal hair",
    });

    expect(searched).toBe(false);
    expect(result.candidates).toHaveLength(1);
  });
  it("connects a selected business candidate through Customer relationships", async () => {
    const calls: string[] = [];
    const service = new MatchingService({
      repository: {
        async getMatchRequest() {
          return {
            id: "match-1",
            demandRequestId: "demand-1",
            organizationId: "tenant-1",
            workspaceId: "workspace-1",
            algorithmVersion: "deterministic-v1",
            policyVersion: "policy-1",
            status: "decided",
            requestedAt: "2026-09-22T00:00:00.000Z",
            completedAt: "2026-09-22T00:01:00.000Z",
            createdAt: "2026-09-22T00:00:00.000Z",
            updatedAt: "2026-09-22T00:01:00.000Z",
          };
        },
        async getDemandRequest() {
          return {
            id: "demand-1",
            organizationId: "tenant-1",
            workspaceId: "workspace-1",
            customerId: "customer-1",
            sourceChannel: "api",
            status: "matched",
            rawInputReference: null,
            locale: "en",
            normalizedDemand: {},
            confidence: 1,
            createdAt: "2026-09-22T00:00:00.000Z",
            updatedAt: "2026-09-22T00:01:00.000Z",
          };
        },
        async getCandidate() {
          return {
            id: "candidate-1",
            matchRequestId: "match-1",
            businessId: "business-1",
            offeringId: null,
            retrievalSource: "discovery.lexical",
            retrievalScore: 1,
            rankingScore: 1,
            rankPosition: 1,
            eligibilityStatus: "eligible",
            reasons: [],
            featureSnapshot: {},
            createdAt: "2026-09-22T00:01:00.000Z",
          };
        },
        async hasSelectedDecision() {
          return true;
        },
        async setMatchStatus(_context: RequestContext, _id: string, status: string) {
          calls.push("match:" + status);
          return {
            id: "match-1",
            demandRequestId: "demand-1",
            organizationId: "tenant-1",
            workspaceId: "workspace-1",
            algorithmVersion: "deterministic-v1",
            policyVersion: "policy-1",
            status,
            requestedAt: "2026-09-22T00:00:00.000Z",
            completedAt: "2026-09-22T00:01:00.000Z",
            createdAt: "2026-09-22T00:00:00.000Z",
            updatedAt: "2026-09-22T00:01:00.000Z",
          };
        },
      } as never,
      discovery: {} as never,
      relationships: {
        async getByCustomerBusinessType() {
          return null;
        },
        async create(_context: RequestContext, input: { readonly relationshipType: string; readonly businessId: string }) {
          calls.push("relationship:" + input.relationshipType + ":" + input.businessId);
          return {
            id: "relationship-1",
            customerId: "customer-1",
            businessId: input.businessId,
            relationshipType: input.relationshipType,
            status: "prospect",
            firstInteractionAt: "2026-09-22T00:01:00.000Z",
            lastInteractionAt: "2026-09-22T00:01:00.000Z",
            source: "matching",
            createdAt: "2026-09-22T00:01:00.000Z",
            updatedAt: "2026-09-22T00:01:00.000Z",
          };
        },
      } as never,
      authorization: authorization(),
      id: () => brandId<"EntityId">("relationship-1"),
      now: () => "2026-09-22T00:01:00.000Z",
    });

    const result = await service.connect(context(), {
      matchRequestId: brandId<"EntityId">("match-1"),
      candidateId: brandId<"EntityId">("candidate-1"),
    });

    expect(result.relationship.businessId).toBe("business-1");
    expect(result.replayed).toBe(false);
    expect(calls).toEqual(["relationship:match:business-1", "match:connected"]);
  });

});
