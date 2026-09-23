import { CaseSupportRepository } from "@qooqnos/case-support";
import { getDatabase } from "./database";
import { createRequestContext } from "./context";
import type { ApiEnv } from "./env";

export interface CaseSlaProcessResult {
  readonly casesScanned: number;
  readonly breachesRecorded: number;
}

export async function processCaseSla(
  env: ApiEnv,
  now = new Date().toISOString(),
  limit = 200,
): Promise<CaseSlaProcessResult> {
  const database = getDatabase(env);
  if (!database) return { casesScanned: 0, breachesRecorded: 0 };

  const repository = new CaseSupportRepository(database);
  const cases = await repository.listSlaActiveCases(now, limit);
  let breachesRecorded = 0;

  for (const caseRecord of cases) {
    const context = createRequestContext({
      module: "case-support",
      operation: "case.sla.evaluate",
      requestId: `case-sla:${caseRecord.id}:${now}`,
      correlationId: `case-sla:${caseRecord.id}`,
      tenantId: caseRecord.organizationId,
      ...(caseRecord.workspaceId ? { workspaceId: caseRecord.workspaceId } : {}),
      actorId: "system",
      locale: "en",
      timezone: "UTC",
      authenticated: true,
    });

    const firstResponseTargetAt = addSeconds(caseRecord.openedAt, caseRecord.firstResponseTargetSeconds);
    const resolutionTargetAt = addSeconds(caseRecord.openedAt, caseRecord.resolutionTargetSeconds);

    if (
      now >= firstResponseTargetAt
      && !(await repository.hasCaseEvent(context, caseRecord.id, "case.first_response"))
    ) {
      if (await repository.recordSlaBreach(context, {
        caseId: caseRecord.id,
        metric: "first_response",
        targetAt: firstResponseTargetAt,
        now,
      })) {
        breachesRecorded += 1;
      }
    }

    if (now >= resolutionTargetAt && !caseRecord.resolvedAt && !caseRecord.closedAt) {
      if (await repository.recordSlaBreach(context, {
        caseId: caseRecord.id,
        metric: "resolution",
        targetAt: resolutionTargetAt,
        now,
      })) {
        breachesRecorded += 1;
      }
    }
  }

  return { casesScanned: cases.length, breachesRecorded };
}

function addSeconds(timestamp: string, seconds: number): string {
  const base = Date.parse(timestamp);
  if (Number.isNaN(base)) throw new Error("Case SLA timestamp is invalid");
  if (!Number.isSafeInteger(seconds) || seconds < 0) throw new Error("Case SLA target seconds are invalid");
  return new Date(base + seconds * 1000).toISOString();
}
