import { describe, expect, it } from "vitest";
import { processPendingTrustExpiries } from "./trust-worker";
import type { D1DatabaseLike, D1PreparedStatementLike } from "@qooqnos/database";

describe("processPendingTrustExpiries", () => {
  it("resolves one expired Trust work item idempotently", async () => {
    const workItem = {
      id: "expiry-1",
      caseId: "case-1",
      requirementId: "identity",
      evidenceId: null,
      expiresAt: "2026-09-21T00:00:00.000Z",
      detectedAt: "2026-09-22T00:00:00.000Z",
      reevaluationStatus: "pending",
      resultingDecisionId: null,
      createdAt: "2026-09-21T00:00:00.000Z",
      updatedAt: "2026-09-21T00:00:00.000Z",
      organizationId: "tenant-1",
      workspaceId: "workspace-1",
      policyVersion: "v1",
    };

    let batches = 0;
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() {
        return workItem as T;
      },
      async all<T>() {
        return { results: [workItem] as T[] };
      },
      async run() {
        return { success: true, meta: { changes: 1 } };
      },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch(statements) {
        batches += statements.length;
        return statements.map(() => ({ success: true, meta: { changes: 1 } }));
      },
    };

    const result = await processPendingTrustExpiries(
      {
        DB: raw,
      },
      "2026-09-22T00:00:00.000Z",
    );

    expect(result).toEqual({ evaluated: 1, skipped: 0, failed: 0 });
    expect(batches).toBe(4);
  });
});
