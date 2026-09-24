import { brandId } from "@qooqnos/core";
import { VerificationRepository } from "@qooqnos/database";
import { TrustReviewRepository } from "@qooqnos/trust";
import { getDatabase } from "./database";
import { createRequestContext } from "./context";
import type { ApiEnv } from "./env";

export interface TrustExpiryWorkResult {
  readonly evaluated: number;
  readonly skipped: number;
  readonly failed: number;
}

export async function processPendingTrustExpiries(
  env: ApiEnv,
  now = new Date().toISOString(),
  limit = 50,
): Promise<TrustExpiryWorkResult> {
  const database = getDatabase(env);
  if (!database) return { evaluated: 0, skipped: 0, failed: 0 };

  const repository = new VerificationRepository(database);
  const items = await repository.listPendingExpiryWorkItems(limit);

  let evaluated = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const context = createRequestContext({
        module: "trust",
        operation: "verification.expiry.process",
        actorId: brandId<"EntityId">("system"),
        tenantId: item.organizationId,
        ...(item.workspaceId ? { workspaceId: item.workspaceId } : {}),
        authenticated: true,
        locale: "en",
        timezone: "UTC",
      });

      const applied = await repository.resolveExpiryAsExpired({
        expiryId: item.id,
        decisionId: brandId<"EntityId">(item.id + ":expired"),
        detectedAt: now,
        rationaleReference: "trust.expiry.worker.v1",
        now,
        correlationId: context.correlationId,
        actorReference: "system",
      });

      if (applied) evaluated += 1;
      else skipped += 1;
    } catch {
      failed += 1;
    }
  }

  return { evaluated, skipped, failed };
}

export interface TrustAntiAbuseWorkResult {
  readonly signals: number;
  readonly moderationCases: number;
  readonly skipped: number;
  readonly failed: number;
}

export async function processTrustAntiAbuseSignals(
  env: ApiEnv,
  now = new Date().toISOString(),
  limit = 100,
): Promise<TrustAntiAbuseWorkResult> {
  const database = getDatabase(env);
  if (!database) return { signals: 0, moderationCases: 0, skipped: 0, failed: 0 };

  const repository = new TrustReviewRepository(database);
  const inputs = await repository.listAbuseInputs(limit);
  let signals = 0;
  let moderationCases = 0;
  let skipped = 0;
  let failed = 0;

  for (const input of inputs) {
    try {
      const context = createRequestContext({
        module: "trust",
        operation: "trust.anti_abuse.process",
        actorId: brandId<"EntityId">("system"),
        tenantId: input.organizationId,
        ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
        authenticated: true,
        locale: "en",
        timezone: "UTC",
      });

      const confidence = input.confidence ?? (input.sourceType === "review_report" ? 0.7 : 0);
      const severity = confidence >= 0.9 ? "critical" : confidence >= 0.75 ? "high" : confidence >= 0.5 ? "medium" : "low";
      let value: unknown = input.valueJson;
      if (input.valueJson) {
        try { value = JSON.parse(input.valueJson); } catch { value = { raw: input.valueJson }; }
      }
      const policyVersion = input.policyVersion ?? "trust.anti_abuse.v1";
      const signal = await repository.recordTrustSignal(context, {
        id: brandId<"EntityId">("trust-signal:" + input.sourceType + ":" + input.sourceId),
        subjectType: "review",
        subjectId: input.reviewId,
        signalType: input.signalType,
        severity,
        value,
        confidence,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        policyVersion,
        detectedAt: input.detectedAt,
        now,
      });
      signals += 1;

      if (severity === "high" || severity === "critical") {
        const existing = await repository.findModerationCaseBySource(
          input.organizationId,
          input.sourceType,
          input.sourceId,
          "trust.anti_abuse",
          policyVersion,
        );
        if (!existing) {
          await repository.createGenericModerationCase(context, {
            id: brandId<"EntityId">("moderation:" + input.sourceType + ":" + input.sourceId),
            subjectType: "review",
            subjectId: input.reviewId,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            policyId: "trust.anti_abuse",
            policyVersion,
            riskLevel: severity === "critical" ? "critical" : "high",
            now,
          });
          moderationCases += 1;
        } else {
          skipped += 1;
        }
      }
      void signal;
    } catch {
      failed += 1;
    }
  }

  return { signals, moderationCases, skipped, failed };
}
