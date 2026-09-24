import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type MatchLearningSignalType =
  | "impression" | "viewed" | "clicked" | "contacted" | "connected" | "booked"
  | "purchased" | "accepted" | "rejected" | "ignored" | "complaint" | "cancelled";

export interface MatchLearningSignalRecord {
  readonly id: EntityId; readonly matchRequestId: EntityId; readonly candidateId: EntityId | null;
  readonly organizationId: EntityId; readonly workspaceId: EntityId | null;
  readonly signalType: MatchLearningSignalType; readonly signalValue: number | null;
  readonly source: string; readonly actorReference: string | null; readonly metadata: unknown;
  readonly occurredAt: string; readonly createdAt: string;
}
export interface RecordMatchLearningSignalInput {
  readonly id: EntityId; readonly matchRequestId: EntityId; readonly candidateId?: EntityId;
  readonly signalType: MatchLearningSignalType; readonly signalValue?: number;
  readonly source: string; readonly actorReference?: string; readonly metadata?: unknown;
  readonly occurredAt: string; readonly now: string;
}
interface SignalRow {
  readonly id: EntityId; readonly matchRequestId: EntityId; readonly candidateId: EntityId | null;
  readonly organizationId: EntityId; readonly workspaceId: EntityId | null;
  readonly signalType: MatchLearningSignalType; readonly signalValue: number | null;
  readonly source: string; readonly actorReference: string | null; readonly metadataJson: string | null;
  readonly occurredAt: string; readonly createdAt: string;
}
export class MatchingLearningRepository extends Repository {
  constructor(database: D1Database) { super(database); }

  async record(context: RequestContext, input: RecordMatchLearningSignalInput): Promise<MatchLearningSignalRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const request = await this.database.first<{ id: EntityId; workspaceId: EntityId | null }>(
      "SELECT id, workspace_id AS workspaceId FROM match_requests WHERE id = ? AND organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?) LIMIT 1",
      input.matchRequestId, organizationId, context.workspaceId ?? null,
    );
    if (!request) throw new DatabaseError("Match request not found");
    if (context.workspaceId && request.workspaceId !== context.workspaceId) {
      throw new DatabaseError("Match learning signal requires the request workspace scope");
    }
    if (input.signalValue !== undefined && (!Number.isFinite(input.signalValue) || input.signalValue < 0)) {
      throw new DatabaseError("Match learning signal value must be a finite non-negative number");
    }
    const source = input.source.trim();
    if (!source) throw new DatabaseError("Match learning signal source is required");
    await this.database.run(
      "INSERT OR IGNORE INTO match_learning_signals (id,match_request_id,candidate_id,organization_id,workspace_id,signal_type,signal_value,source,actor_reference,metadata_json,occurred_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      input.id, input.matchRequestId, input.candidateId ?? null, organizationId, request.workspaceId,
      input.signalType, input.signalValue ?? null, source, input.actorReference ?? null,
      input.metadata === undefined ? null : JSON.stringify(input.metadata), input.occurredAt, input.now,
    );
    return this.get(context, input.id);
  }

  async get(context: RequestContext, id: EntityId): Promise<MatchLearningSignalRecord> {
    const row = await this.database.first<SignalRow>(
      "SELECT id,match_request_id AS matchRequestId,candidate_id AS candidateId,organization_id AS organizationId,workspace_id AS workspaceId,signal_type AS signalType,signal_value AS signalValue,source,actor_reference AS actorReference,metadata_json AS metadataJson,occurred_at AS occurredAt,created_at AS createdAt FROM match_learning_signals WHERE id=? AND organization_id=? AND (workspace_id IS NULL OR workspace_id=?) LIMIT 1",
      id, this.requireOrganization({ organizationId: context.tenantId }), context.workspaceId ?? null,
    );
    if (!row) throw new DatabaseError("Match learning signal not found");
    return { ...row, metadata: parseJson(row.metadataJson) };
  }

  async listForCandidate(context: RequestContext, candidateId: EntityId, limit = 100): Promise<readonly MatchLearningSignalRecord[]> {
    const safe = Math.min(Math.max(Math.trunc(limit), 1), 500);
    const rows = await this.database.all<SignalRow>(
      "SELECT id,match_request_id AS matchRequestId,candidate_id AS candidateId,organization_id AS organizationId,workspace_id AS workspaceId,signal_type AS signalType,signal_value AS signalValue,source,actor_reference AS actorReference,metadata_json AS metadataJson,occurred_at AS occurredAt,created_at AS createdAt FROM match_learning_signals WHERE candidate_id=? AND organization_id=? AND (workspace_id IS NULL OR workspace_id=?) ORDER BY occurred_at DESC,id DESC LIMIT ?",
      candidateId, this.requireOrganization({ organizationId: context.tenantId }), context.workspaceId ?? null, safe,
    );
    return rows.map((row) => ({ ...row, metadata: parseJson(row.metadataJson) }));
  }
}
function parseJson(value: string | null): unknown {
  if (!value) return null;
  try { return JSON.parse(value); } catch { throw new DatabaseError("Stored Matching learning metadata is invalid"); }
}
