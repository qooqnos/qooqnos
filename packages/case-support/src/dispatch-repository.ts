import { type EntityId } from "@qooqnos/core";
import { D1Database, Repository, DatabaseError } from "@qooqnos/database";

export interface CaseDispatchRecord {
  readonly id: EntityId;
  readonly caseId: EntityId;
  readonly assignmentId: EntityId;
  readonly queueId: EntityId;
  readonly providerId: string;
  readonly routeReference: string | null;
  readonly idempotencyKey: string;
  readonly status: "pending" | "dispatching" | "accepted" | "failed" | "cancelled";
  readonly externalReference: string | null;
  readonly failureCode: string | null;
  readonly failureClass: "transient" | "permanent" | null;
  readonly attempts: number;
  readonly availableAt: string;
  readonly acceptedAt: string | null;
  readonly lastAttemptAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CaseDispatchPayload {
  readonly dispatch: CaseDispatchRecord;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId | null;
  readonly caseTypeId: EntityId;
  readonly priority: string;
  readonly subjectType: string;
  readonly subjectId: EntityId;
  readonly requesterType: string;
  readonly requesterId: EntityId;
}

type CaseDispatchRow = CaseDispatchRecord & {
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId | null;
  readonly caseTypeId: EntityId;
  readonly priority: string;
  readonly subjectType: string;
  readonly subjectId: EntityId;
  readonly requesterType: string;
  readonly requesterId: EntityId;
};

export class CaseDispatchRepository extends Repository {
  constructor(database: D1Database) { super(database); }

  async getDue(limit = 50, now = new Date().toISOString()): Promise<readonly CaseDispatchPayload[]> {
    const safe = Math.min(Math.max(Math.trunc(limit), 1), 500);
    const rows = await this.database.all<CaseDispatchRow>(
      "SELECT d.id,d.case_id AS caseId,d.assignment_id AS assignmentId,d.queue_id AS queueId,d.provider_id AS providerId,d.route_reference AS routeReference,d.idempotency_key AS idempotencyKey,d.status,d.external_reference AS externalReference,d.failure_code AS failureCode,d.failure_class AS failureClass,d.attempts,d.available_at AS availableAt,d.accepted_at AS acceptedAt,d.last_attempt_at AS lastAttemptAt,d.created_at AS createdAt,d.updated_at AS updatedAt,c.organization_id AS organizationId,c.workspace_id AS workspaceId,c.case_type_id AS caseTypeId,c.priority,c.subject_type AS subjectType,c.subject_id AS subjectId,c.requester_type AS requesterType,c.requester_id AS requesterId FROM case_dispatches d INNER JOIN cases c ON c.id=d.case_id WHERE (d.status='pending' OR (d.status='failed' AND d.failure_class='transient')) AND d.available_at<=? ORDER BY d.available_at ASC,d.created_at ASC,d.id ASC LIMIT ?",
      now,
      safe,
    );
    return rows.map(toPayload);
  }

  async claim(id: EntityId, now: string): Promise<boolean> {
    const result = await this.database.run(
      "UPDATE case_dispatches SET status='dispatching',attempts=attempts+1,last_attempt_at=?,updated_at=? WHERE id=? AND (status='pending' OR (status='failed' AND failure_class='transient')) AND available_at<=?",
      now, now, id, now,
    );
    return (result.meta?.changes ?? 0) === 1;
  }

  async recordAccepted(input: {
    readonly id: EntityId;
    readonly externalReference?: string;
    readonly now: string;
    readonly attemptId: EntityId;
  }): Promise<void> {
    const dispatch = await this.get(input.id);
    if (!dispatch) throw new DatabaseError("Case dispatch not found");
    const results = await this.database.transaction([
      {
        sql: "UPDATE case_dispatches SET status='accepted',external_reference=?,failure_code=NULL,failure_class=NULL,accepted_at=?,updated_at=? WHERE id=? AND status='dispatching'",
        params: [input.externalReference ?? null, input.now, input.now, input.id],
      },
      {
        sql: "INSERT INTO case_dispatch_attempts (id,dispatch_id,attempt_number,status,provider_reference,occurred_at) VALUES (?,?,?,?,?,?)",
        params: [input.attemptId, input.id, dispatch.dispatch.attempts, "accepted", input.externalReference ?? null, input.now],
      },
      {
        sql: "INSERT OR IGNORE INTO outbox_events (id,event_type,event_version,aggregate_type,aggregate_id,organization_id,workspace_id,payload_json,status,attempts,available_at,occurred_at,published_at) VALUES (?,?,1,'case',?,?,?,?, 'pending',0,?,?,NULL)",
        params: [
          input.id + ":accepted:" + input.now,
          "case.dispatch.accepted",
          input.id,
          dispatch.organizationId,
          dispatch.workspaceId,
          JSON.stringify({ caseId: input.id, dispatchId: input.id, providerId: dispatch.dispatch.providerId, externalReference: input.externalReference ?? null }),
          input.now,
          input.now,
        ],
      },
    ]);
    if ((results[0]?.meta.changes ?? 0) !== 1) throw new DatabaseError("Case dispatch changed concurrently");
  }

  async recordFailure(input: {
    readonly id: EntityId;
    readonly failureCode: string;
    readonly failureClass: "transient" | "permanent";
    readonly nextAvailableAt: string;
    readonly now: string;
    readonly attemptId: EntityId;
  }): Promise<void> {
    const dispatch = await this.get(input.id);
    if (!dispatch) throw new DatabaseError("Case dispatch not found");
    const status = input.failureClass === "transient" ? "failed" : "failed";
    await this.database.transaction([
      {
        sql: "UPDATE case_dispatches SET status=?,failure_code=?,failure_class=?,available_at=?,updated_at=? WHERE id=? AND status='dispatching'",
        params: [status, input.failureCode, input.failureClass, input.nextAvailableAt, input.now, input.id],
      },
      {
        sql: "INSERT INTO case_dispatch_attempts (id,dispatch_id,attempt_number,status,failure_code,failure_class,occurred_at) VALUES (?,?,?,?,?,?,?)",
        params: [input.attemptId, input.id, dispatch.dispatch.attempts, "failed", input.failureCode, input.failureClass, input.now],
      },
    ]);
  }

  async get(id: EntityId): Promise<CaseDispatchPayload | null> {
    const row = await this.database.first<CaseDispatchRow>(
      "SELECT d.id,d.case_id AS caseId,d.assignment_id AS assignmentId,d.queue_id AS queueId,d.provider_id AS providerId,d.route_reference AS routeReference,d.idempotency_key AS idempotencyKey,d.status,d.external_reference AS externalReference,d.failure_code AS failureCode,d.failure_class AS failureClass,d.attempts,d.available_at AS availableAt,d.accepted_at AS acceptedAt,d.last_attempt_at AS lastAttemptAt,d.created_at AS createdAt,d.updated_at AS updatedAt,c.organization_id AS organizationId,c.workspace_id AS workspaceId,c.case_type_id AS caseTypeId,c.priority,c.subject_type AS subjectType,c.subject_id AS subjectId,c.requester_type AS requesterType,c.requester_id AS requesterId FROM case_dispatches d INNER JOIN cases c ON c.id=d.case_id WHERE d.id=? LIMIT 1",
      id,
    );
    return row ? toPayload(row) : null;
  }

  async createForAssignment(input: {
    readonly id: EntityId;
    readonly caseId: EntityId;
    readonly assignmentId: EntityId;
    readonly queueId: EntityId;
    readonly providerId: string;
    readonly routeReference?: string | null;
    readonly organizationId: EntityId;
    readonly workspaceId: EntityId | null;
    readonly now: string;
  }): Promise<void> {
    await this.database.run(
      "INSERT OR IGNORE INTO case_dispatches (id,case_id,assignment_id,queue_id,provider_id,route_reference,idempotency_key,status,attempts,available_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'pending',0,?,?,?)",
      input.id,
      input.caseId,
      input.assignmentId,
      input.queueId,
      input.providerId.trim(),
      input.routeReference ?? null,
      "case-dispatch:" + input.assignmentId,
      input.now,
      input.now,
      input.now,
    );
  }
}

function toPayload(row: CaseDispatchRow): CaseDispatchPayload {
  const {
    organizationId,
    workspaceId,
    caseTypeId,
    priority,
    subjectType,
    subjectId,
    requesterType,
    requesterId,
    ...dispatch
  } = row;
  return {
    dispatch,
    organizationId,
    workspaceId,
    caseTypeId,
    priority,
    subjectType,
    subjectId,
    requesterType,
    requesterId,
  };
}
