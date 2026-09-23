import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { PrivacyRepository } from "./repository";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "privacy",
    operation: "privacy.consent.manage",
    locale: "en",
    timezone: "UTC",
  };
}

describe("PrivacyRepository", () => {
  it("is tenant scoped when reading consents", async () => {
    const statement:D1PreparedStatementLike={
      bind(){return this;},
      async first<T>(){return null as T|null;},
      async all<T>(){return {results:[] as T[]};},
      async run(){return {success:true};}
    };
    const raw:D1DatabaseLike={prepare(_sql:string){return statement;},async batch(){return[];}};
    const repository=new PrivacyRepository(new D1Database(raw));
    await expect(repository.getConsent(context(),brandId<"EntityId">("foreign"))).rejects.toThrow("Consent not found");
  });

  it("replaces an active consent before granting a new version", async () => {
    let writes=0;
    const statement:D1PreparedStatementLike={
      bind(){return this;},
      async first<T>(sql?: string){
        if (sql?.includes("FROM customers")) return { found: 1 } as T;
        return {
          id:"consent-1",organizationId:"tenant-1",workspaceId:"workspace-1",subjectType:"customer",
          subjectId:"customer-1",purpose:"marketing",consentVersion:"v2",status:"granted",source:"web",
          evidenceReference:null,grantedAt:"2026-09-22T00:00:00.000Z",revokedAt:null,expiresAt:null,
          createdAt:"2026-09-22T00:00:00.000Z",updatedAt:"2026-09-22T00:00:00.000Z"
        } as T;
      },
      async all<T>(){return {results:[] as T[]};},
      async run(){writes+=1;return {success:true};}
    };
    const raw:D1DatabaseLike={
      prepare(){return statement;},
      async batch(statements){
        writes += statements.length;
        return statements.map(()=>({success:true}));
      }
    };
    const repository=new PrivacyRepository(new D1Database(raw));
    const result=await repository.createConsent(context(),{
      id:brandId<"EntityId">("consent-2"),subjectType:"customer",subjectId:brandId<"EntityId">("customer-1"),
      purpose:"marketing",consentVersion:"v2",source:"web",now:"2026-09-22T00:00:00.000Z"
    });
    expect(result.status).toBe("granted");
    expect(writes).toBe(2);
  });


  it("uses the current server time when revoking a replaced consent", async () => {
    const statements: Array<{ sql: string; params: readonly unknown[] }> = [];
    const existing = {
      id: "consent-current",
      organizationId: "tenant-1",
      workspaceId: "workspace-1",
      subjectType: "customer",
      subjectId: "customer-1",
      purpose: "marketing",
      consentVersion: "v1",
      status: "granted",
      source: "web",
      evidenceReference: null,
      grantedAt: "2026-09-22T00:00:00.000Z",
      revokedAt: null,
      expiresAt: null,
      createdAt: "2026-09-22T00:00:00.000Z",
      updatedAt: "2026-09-22T00:00:00.000Z",
    };
    let query = "";
    const statement: D1PreparedStatementLike = {
      bind(...values) {
        statements.push({ sql: query, params: values });
        return this;
      },
      async first<T>() {
        if (query.includes("FROM customers")) return { found: 1 } as T;
        if (query.includes("FROM privacy_consents")) return existing as T;
        return null as T | null;
      },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare(sql: string) {
        query = sql;
        return statement;
      },
      async batch() {
        return statements.map(() => ({ success: true }));
      },
    };
    const repository = new PrivacyRepository(new D1Database(raw));

    await repository.createConsent(context(), {
      id: brandId<"EntityId">("consent-new"),
      subjectType: "customer",
      subjectId: brandId<"EntityId">("customer-1"),
      purpose: "marketing",
      consentVersion: "v2",
      source: "web",
      grantedAt: "2026-09-20T00:00:00.000Z",
      now: "2026-09-23T00:00:00.000Z",
    });

    const revokeStatement = statements.find((item) => item.sql.includes("UPDATE privacy_consents SET status = 'revoked'"));
    expect(revokeStatement?.params[0]).toBe("2026-09-23T00:00:00.000Z");
  });

  it("rejects a subject outside the tenant scope before recording consent", async () => {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return null as T | null; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch() { return []; },
    };
    const repository = new PrivacyRepository(new D1Database(raw));

    await expect(repository.createConsent(context(), {
      id: brandId<"EntityId">("consent-foreign"),
      subjectType: "customer",
      subjectId: brandId<"EntityId">("customer-foreign"),
      purpose: "marketing",
      consentVersion: "v2",
      source: "web",
      now: "2026-09-23T00:00:00.000Z",
    })).rejects.toThrow("current organization/workspace scope");
  });


  it("rejects out-of-scope member and user subjects", async () => {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return null as T | null; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch() { return []; },
    };
    const repository = new PrivacyRepository(new D1Database(raw));

    await expect(repository.createRequest(context(), {
      id: brandId<"EntityId">("request-member"),
      subjectType: "member",
      subjectId: brandId<"EntityId">("member-foreign"),
      requestType: "export",
      requestedBy: "user-1",
      now: "2026-09-23T00:00:00.000Z",
    })).rejects.toThrow("current organization/workspace scope");

    await expect(repository.createRequest(context(), {
      id: brandId<"EntityId">("request-user"),
      subjectType: "user",
      subjectId: brandId<"EntityId">("user-foreign"),
      requestType: "delete",
      requestedBy: "user-1",
      now: "2026-09-23T00:00:00.000Z",
    })).rejects.toThrow("current organization/workspace scope");
  });

  it("rejects out-of-scope actor subjects", async () => {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return null as T | null; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch() { return []; },
    };
    const repository = new PrivacyRepository(new D1Database(raw));

    await expect(repository.createConsent(context(), {
      id: brandId<"EntityId">("consent-actor"),
      subjectType: "actor",
      subjectId: brandId<"EntityId">("actor-foreign"),
      purpose: "personalization",
      consentVersion: "v1",
      source: "api",
      now: "2026-09-23T00:00:00.000Z",
    })).rejects.toThrow("current organization/workspace scope");
  });

  it("expires only currently granted consents", async () => {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return null as T | null; },
      async all<T>() {
        return {
          results: [
            { id: "consent-expired", organizationId: "tenant-1", workspaceId: "workspace-1" },
          ] as T[],
        };
      },
      async run() { return { success: true, meta: { changes: 1 } }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch(statements) {
        return statements.map((_, index) => ({
          success: true,
          meta: { changes: index === 0 ? 1 : 1 },
        }));
      },
    };
    const repository = new PrivacyRepository(new D1Database(raw));

    await expect(
      repository.expireConsents("2026-09-23T01:00:00.000Z"),
    ).resolves.toBe(1);
  });


  it("rejects backward Privacy request transitions", async () => {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() {
        return {
          id: "request-1",
          organizationId: "tenant-1",
          workspaceId: "workspace-1",
          subjectType: "customer",
          subjectId: "customer-1",
          requestType: "export",
          status: "processing",
          requestedBy: "user-1",
          requestedAt: "2026-09-22T00:00:00.000Z",
          dueAt: null,
          completedAt: null,
          resultReference: null,
          rejectionReason: null,
          createdAt: "2026-09-22T00:00:00.000Z",
          updatedAt: "2026-09-22T00:01:00.000Z",
        } as T;
      },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = { prepare() { return statement; }, async batch() { return []; } };
    const repository = new PrivacyRepository(new D1Database(raw));

    await expect(repository.transitionRequest(
      context(),
      brandId<"EntityId">("request-1"),
      "validating",
      "2026-09-22T00:02:00.000Z",
    )).rejects.toThrow("Invalid Privacy request status transition");
  });

  it("claims an approved privacy request exactly once", async () => {
    let updateCalls = 0;
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() {
        return {
          id: "request-1",
          organizationId: "tenant-1",
          workspaceId: "workspace-1",
          subjectType: "customer",
          subjectId: "customer-1",
          requestType: "export",
          status: "approved",
          requestedBy: "privacy-admin",
          requestedAt: "2026-09-22T00:00:00.000Z",
          dueAt: null,
          completedAt: null,
          resultReference: null,
          rejectionReason: null,
          createdAt: "2026-09-22T00:00:00.000Z",
          updatedAt: "2026-09-22T00:00:00.000Z",
        } as T;
      },
      async all<T>() { return { results: [] as T[] }; },
      async run() { updateCalls += 1; return { success: true, meta: { changes: 1 } }; },
    };
    const raw: D1DatabaseLike = { prepare() { return statement; }, async batch(statements) { return statements.map(() => ({ success: true, meta: { changes: 1 } })); } };
    const repository = new PrivacyRepository(new D1Database(raw));

    const result = await repository.claimOrResumeRequest({
      requestId: brandId<"EntityId">("request-1"),
      now: "2026-09-23T00:00:00.000Z",
    });

    expect(result?.status).toBe("approved");
    expect(updateCalls).toBe(1);
  });

});
