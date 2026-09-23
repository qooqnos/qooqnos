import { brandId, type EntityId, type RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type CaseStatus = "open"|"triaged"|"assigned"|"in_progress"|"waiting"|"escalated"|"resolved"|"closed"|"reopened";
export type CasePriority = "low"|"normal"|"high"|"urgent";

export interface CaseRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId | null;
  readonly caseTypeId: EntityId;
  readonly status: CaseStatus;
  readonly priority: CasePriority;
  readonly severity: string;
  readonly subjectType: string;
  readonly subjectId: EntityId;
  readonly requesterType: string;
  readonly requesterId: EntityId;
  readonly sourceType: string;
  readonly sourceReference: string | null;
  readonly queueId: EntityId | null;
  readonly assigneeId: string | null;
  readonly slaId: EntityId | null;
  readonly version: number;
  readonly openedAt: string;
  readonly resolvedAt: string | null;
  readonly closedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class CaseSupportRepository extends Repository {
  constructor(database: D1Database) { super(database); }

  async createCase(context: RequestContext, input: {
    readonly id: EntityId;
    readonly caseTypeId: EntityId;
    readonly priority: CasePriority;
    readonly severity: string;
    readonly subjectType: string;
    readonly subjectId: EntityId;
    readonly requesterType: string;
    readonly requesterId: EntityId;
    readonly sourceType: string;
    readonly sourceReference?: string | undefined;
    readonly queueId?: EntityId | undefined;
    readonly slaId?: EntityId | undefined;
    readonly now: string;
  }): Promise<CaseRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const existing = input.sourceReference
      ? await this.database.first<CaseRecord>(
          "SELECT id,organization_id AS organizationId,workspace_id AS workspaceId,case_type_id AS caseTypeId,status,priority,severity,subject_type AS subjectType,subject_id AS subjectId,requester_type AS requesterType,requester_id AS requesterId,source_type AS sourceType,source_reference AS sourceReference,queue_id AS queueId,assignee_id AS assigneeId,sla_id AS slaId,version,opened_at AS openedAt,resolved_at AS resolvedAt,closed_at AS closedAt,created_at AS createdAt,updated_at AS updatedAt FROM cases WHERE organization_id=? AND source_type=? AND source_reference=? LIMIT 1",
          organizationId,
          input.sourceType,
          input.sourceReference,
        )
      : null;
    if (existing) return existing;
    await this.database.run(
      "INSERT INTO cases (id,organization_id,workspace_id,case_type_id,status,priority,severity,subject_type,subject_id,requester_type,requester_id,source_type,source_reference,queue_id,sla_id,version,opened_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)",
      input.id,
      organizationId,
      context.workspaceId ?? null,
      input.caseTypeId,
      "open",
      input.priority,
      input.severity.trim(),
      input.subjectType.trim(),
      input.subjectId,
      input.requesterType.trim(),
      input.requesterId,
      input.sourceType.trim(),
      input.sourceReference ?? null,
      input.queueId ?? null,
      input.slaId ?? null,
      input.now,
      input.now,
      input.now,
    );
    await this.appendEvent(context, {
      id: brandId<"EntityId">(input.id + ":created:" + input.now),
      caseId: input.id,
      eventType: "case.created",
      fromStatus: null,
      toStatus: "open",
      occurredAt: input.now,
    });
    return this.getRequired(context, input.id);
  }

  async get(context: RequestContext, id: EntityId): Promise<CaseRecord | null> {
    return this.database.first<CaseRecord>(
      "SELECT id,organization_id AS organizationId,workspace_id AS workspaceId,case_type_id AS caseTypeId,status,priority,severity,subject_type AS subjectType,subject_id AS subjectId,requester_type AS requesterType,requester_id AS requesterId,source_type AS sourceType,source_reference AS sourceReference,queue_id AS queueId,assignee_id AS assigneeId,sla_id AS slaId,version,opened_at AS openedAt,resolved_at AS resolvedAt,closed_at AS closedAt,created_at AS createdAt,updated_at AS updatedAt FROM cases WHERE id=? AND organization_id=? AND (workspace_id IS NULL OR workspace_id=?) LIMIT 1",
      id,
      this.requireOrganization({ organizationId: context.tenantId }),
      context.workspaceId ?? null,
    );
  }

  async list(context: RequestContext, limit = 100): Promise<readonly CaseRecord[]> {
    const safe = Math.min(Math.max(Math.trunc(limit), 1), 500);
    return this.database.all<CaseRecord>(
      "SELECT id,organization_id AS organizationId,workspace_id AS workspaceId,case_type_id AS caseTypeId,status,priority,severity,subject_type AS subjectType,subject_id AS subjectId,requester_type AS requesterType,requester_id AS requesterId,source_type AS sourceType,source_reference AS sourceReference,queue_id AS queueId,assignee_id AS assigneeId,sla_id AS slaId,version,opened_at AS openedAt,resolved_at AS resolvedAt,closed_at AS closedAt,created_at AS createdAt,updated_at AS updatedAt FROM cases WHERE organization_id=? AND (workspace_id IS NULL OR workspace_id=?) ORDER BY updated_at DESC,id DESC LIMIT ?",
      this.requireOrganization({ organizationId: context.tenantId }),
      context.workspaceId ?? null,
      safe,
    );
  }

  async listSlaActiveCases(now: string, limit = 200): Promise<readonly (CaseRecord & {
    readonly firstResponseTargetSeconds: number;
    readonly resolutionTargetSeconds: number;
  })[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
    return this.database.all(
      "SELECT c.id,c.organization_id AS organizationId,c.workspace_id AS workspaceId,c.case_type_id AS caseTypeId,c.status,c.priority,c.severity,c.subject_type AS subjectType,c.subject_id AS subjectId,c.requester_type AS requesterType,c.requester_id AS requesterId,c.source_type AS sourceType,c.source_reference AS sourceReference,c.queue_id AS queueId,c.assignee_id AS assigneeId,c.sla_id AS slaId,c.version,c.opened_at AS openedAt,c.resolved_at AS resolvedAt,c.closed_at AS closedAt,c.created_at AS createdAt,c.updated_at AS updatedAt,s.first_response_target_seconds AS firstResponseTargetSeconds,s.resolution_target_seconds AS resolutionTargetSeconds FROM cases c INNER JOIN case_slas s ON s.id = c.sla_id WHERE c.status NOT IN ('resolved','closed') AND s.effective_from <= ? AND (s.effective_to IS NULL OR s.effective_to > ?) ORDER BY c.opened_at ASC,c.id ASC LIMIT ?",
      now,
      now,
      safeLimit,
    );
  }

  async hasCaseEvent(
    context: RequestContext,
    caseId: EntityId,
    eventType: string,
  ): Promise<boolean> {
    await this.getRequired(context, caseId);
    const row = await this.database.first<{ id: EntityId }>(
      "SELECT id FROM case_events WHERE case_id=? AND event_type=? LIMIT 1",
      caseId,
      eventType,
    );
    return row !== null;
  }

  async recordFirstResponse(context: RequestContext, input: {
    readonly caseId: EntityId;
    readonly actorId: string;
    readonly now: string;
  }): Promise<void> {
    await this.getRequired(context, input.caseId);
    await this.database.run(
      "INSERT OR IGNORE INTO case_events (id,case_id,event_type,actor_type,actor_id,from_status,to_status,payload_reference,correlation_id,occurred_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      input.caseId + ":first_response",
      input.caseId,
      "case.first_response",
      "human",
      input.actorId.trim(),
      null,
      null,
      null,
      context.correlationId,
      input.now,
      input.now,
    );
  }

  async recordSlaBreach(context: RequestContext, input: {
    readonly caseId: EntityId;
    readonly metric: "first_response" | "resolution";
    readonly targetAt: string;
    readonly now: string;
  }): Promise<boolean> {
    const caseRecord = await this.getRequired(context, input.caseId);
    const eventId = input.caseId + ":sla_breached:" + input.metric;
    await this.database.transaction([
      {
        sql: "INSERT OR IGNORE INTO case_events (id,case_id,event_type,actor_type,actor_id,from_status,to_status,payload_reference,correlation_id,occurred_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        params: [
          eventId,
          input.caseId,
          "case.sla_breached",
          "system",
          "system",
          caseRecord.status,
          caseRecord.status,
          JSON.stringify({ metric: input.metric, targetAt: input.targetAt }),
          context.correlationId,
          input.now,
          input.now,
        ],
      },
      {
        sql: "INSERT OR IGNORE INTO outbox_events (id,event_type,event_version,aggregate_type,aggregate_id,organization_id,workspace_id,payload_json,status,attempts,available_at,occurred_at,published_at) VALUES (?, ?, 1, 'case', ?, ?, ?, ?, 'pending', 0, ?, ?, NULL)",
        params: [
          eventId + ":outbox",
          "case.sla_breached",
          input.caseId,
          caseRecord.organizationId,
          caseRecord.workspaceId,
          JSON.stringify({ caseId: input.caseId, metric: input.metric, targetAt: input.targetAt }),
          input.now,
          input.now,
        ],
      },
    ]);
    return (results[0]?.meta?.changes ?? 0) === 1;
  }

  async transition(context: RequestContext, input: {
    readonly id: EntityId;
    readonly status: CaseStatus;
    readonly expectedVersion: number;
    readonly reason?: string | undefined;
    readonly now: string;
  }): Promise<CaseRecord> {
    const current = await this.getRequired(context, input.id);
    if (current.status === input.status) return current;
    if (current.version !== input.expectedVersion) throw new DatabaseError("Case version conflict");
    if (!canTransition(current.status, input.status)) throw new DatabaseError("Invalid Case status transition");
    const resolvedAt = input.status === "resolved" ? input.now : current.resolvedAt;
    const closedAt = input.status === "closed" ? input.now : current.closedAt;
    const event = eventName(input.status);
    const results = await this.database.transaction([
      {
        sql: "UPDATE cases SET status=?,resolved_at=?,closed_at=?,version=version+1,updated_at=? WHERE id=? AND organization_id=? AND (workspace_id IS NULL OR workspace_id=?) AND version=?",
        params: [input.status, resolvedAt, closedAt, input.now, input.id, current.organizationId, current.workspaceId, input.expectedVersion],
      },
      {
        sql: "INSERT INTO case_events (id,case_id,event_type,actor_type,actor_id,from_status,to_status,payload_reference,correlation_id,occurred_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        params: [input.id + ":event:" + input.status + ":" + input.now, input.id, event, "service", context.actorId ?? "system", current.status, input.status, input.reason ?? null, context.correlationId, input.now, input.now],
      },
      {
        sql: "INSERT OR IGNORE INTO outbox_events (id,event_type,event_version,aggregate_type,aggregate_id,organization_id,workspace_id,payload_json,status,attempts,available_at,occurred_at,published_at) VALUES (?, ?, 1, 'case', ?, ?, ?, ?, 'pending', 0, ?, ?, NULL)",
        params: [input.id + ":outbox:" + input.status + ":" + input.now, event, input.id, current.organizationId, current.workspaceId, JSON.stringify({ caseId: input.id, fromStatus: current.status, toStatus: input.status, reason: input.reason ?? null }), input.now, input.now],
      },
    ]);
    if ((results[0]?.meta?.changes ?? 0) !== 1) throw new DatabaseError("Case changed concurrently");
    return this.getRequired(context, input.id);
  }

  async assign(context: RequestContext, input: {
    readonly id: EntityId;
    readonly queueId?: EntityId | undefined;
    readonly assigneeType: string;
    readonly assigneeId: string;
    readonly assignedBy: string;
    readonly reason?: string | undefined;
    readonly now: string;
    readonly expectedVersion: number;
  }): Promise<CaseRecord> {
    const current = await this.getRequired(context, input.id);
    if (current.version !== input.expectedVersion) throw new DatabaseError("Case version conflict");
    await this.database.transaction([
      {
        sql: "UPDATE cases SET status=CASE WHEN status IN ('open','triaged','reopened') THEN 'assigned' ELSE status END,queue_id=?,assignee_id=?,version=version+1,updated_at=? WHERE id=? AND version=?",
        params: [input.queueId ?? null, input.assigneeId.trim(), input.now, input.id, input.expectedVersion],
      },
      {
        sql: "INSERT INTO case_assignments (id,case_id,queue_id,assignee_type,assignee_id,assigned_by,reason,assigned_at) VALUES (?,?,?,?,?,?,?,?)",
        params: [input.id + ":assignment:" + input.now, input.id, input.queueId ?? null, input.assigneeType.trim(), input.assigneeId.trim(), input.assignedBy.trim(), input.reason ?? null, input.now],
      },
      {
        sql: "INSERT INTO case_events (id,case_id,event_type,actor_type,actor_id,from_status,to_status,payload_reference,correlation_id,occurred_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        params: [input.id + ":assigned:" + input.now, input.id, "case.assigned", "service", context.actorId ?? "system", current.status, "assigned", input.reason ?? null, context.correlationId, input.now, input.now],
      },
    ]);
    return this.getRequired(context, input.id);
  }

  async addNote(context: RequestContext, input: {
    readonly id: EntityId;
    readonly caseId: EntityId;
    readonly authorId: string;
    readonly visibility: string;
    readonly contentReference: string;
    readonly classification: string;
    readonly now: string;
  }): Promise<void> {
    await this.getRequired(context, input.caseId);
    await this.database.run(
      "INSERT INTO case_notes (id,case_id,author_id,visibility,content_reference,classification,created_at) VALUES (?,?,?,?,?,?,?)",
      input.id,
      input.caseId,
      input.authorId.trim(),
      input.visibility.trim(),
      input.contentReference.trim(),
      input.classification.trim(),
      input.now,
    );
  }

  async addEvidenceReference(context: RequestContext, input: {
    readonly id: EntityId;
    readonly caseId: EntityId;
    readonly sourceModule: string;
    readonly sourceType: string;
    readonly sourceId: string;
    readonly evidenceType: string;
    readonly classification: string;
    readonly accessPolicyReference?: string | undefined;
    readonly now: string;
  }): Promise<void> {
    await this.getRequired(context, input.caseId);
    await this.database.run(
      "INSERT INTO case_evidence_references (id,case_id,source_module,source_type,source_id,evidence_type,classification,access_policy_reference,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
      input.id,
      input.caseId,
      input.sourceModule.trim(),
      input.sourceType.trim(),
      input.sourceId.trim(),
      input.evidenceType.trim(),
      input.classification.trim(),
      input.accessPolicyReference ?? null,
      input.now,
    );
  }

  async addLink(context: RequestContext, input: {
    readonly id: EntityId;
    readonly caseId: EntityId;
    readonly linkedType: string;
    readonly linkedId: string;
    readonly relationship: string;
    readonly now: string;
  }): Promise<void> {
    await this.getRequired(context, input.caseId);
    await this.database.run(
      "INSERT INTO case_links (id,case_id,linked_type,linked_id,relationship,created_at) VALUES (?,?,?,?,?,?)",
      input.id,
      input.caseId,
      input.linkedType.trim(),
      input.linkedId.trim(),
      input.relationship.trim(),
      input.now,
    );
  }

  async escalate(context: RequestContext, input: {
    readonly id: EntityId;
    readonly caseId: EntityId;
    readonly escalationType: string;
    readonly reason: string;
    readonly targetQueueId?: EntityId | undefined;
    readonly targetActorId?: string | undefined;
    readonly policyVersion: string;
    readonly requestedBy: string;
    readonly expectedVersion: number;
    readonly now: string;
  }): Promise<CaseRecord> {
    const current = await this.getRequired(context, input.caseId);
    if (current.version !== input.expectedVersion) throw new DatabaseError("Case version conflict");
    await this.database.transaction([
      {
        sql: "UPDATE cases SET status='escalated',queue_id=COALESCE(?,queue_id),assignee_id=COALESCE(?,assignee_id),version=version+1,updated_at=? WHERE id=? AND version=?",
        params: [input.targetQueueId ?? null, input.targetActorId ?? null, input.now, input.caseId, input.expectedVersion],
      },
      {
        sql: "INSERT INTO case_escalations (id,case_id,escalation_type,reason,target_queue_id,target_actor_id,policy_version,requested_by,escalated_at) VALUES (?,?,?,?,?,?,?,?,?)",
        params: [input.id, input.caseId, input.escalationType.trim(), input.reason.trim(), input.targetQueueId ?? null, input.targetActorId ?? null, input.policyVersion.trim(), input.requestedBy.trim(), input.now],
      },
      {
        sql: "INSERT INTO case_events (id,case_id,event_type,actor_type,actor_id,from_status,to_status,payload_reference,correlation_id,occurred_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        params: [input.caseId + ":escalated:" + input.now, input.caseId, "case.escalated", "service", context.actorId ?? "system", current.status, "escalated", input.reason, context.correlationId, input.now, input.now],
      },
    ]);
    return this.getRequired(context, input.caseId);
  }

  async resolve(context: RequestContext, input: {
    readonly id: EntityId;
    readonly caseId: EntityId;
    readonly outcomeCode: string;
    readonly summaryReference: string;
    readonly resolverId: string;
    readonly authoritativeReferences: readonly string[];
    readonly followUpRequired: boolean;
    readonly expectedVersion: number;
    readonly now: string;
  }): Promise<CaseRecord> {
    const current = await this.getRequired(context, input.caseId);
    if (current.version !== input.expectedVersion) throw new DatabaseError("Case version conflict");
    if (!["in_progress","waiting","escalated","reopened","assigned"].includes(current.status)) throw new DatabaseError("Case cannot be resolved from current status");
    await this.database.transaction([
      {
        sql: "UPDATE cases SET status='resolved',resolved_at=?,version=version+1,updated_at=? WHERE id=? AND version=?",
        params: [input.now, input.now, input.caseId, input.expectedVersion],
      },
      {
        sql: "INSERT INTO case_resolutions (id,case_id,outcome_code,summary_reference,resolver_id,authoritative_references_json,follow_up_required,resolved_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        params: [input.id, input.caseId, input.outcomeCode.trim(), input.summaryReference.trim(), input.resolverId.trim(), JSON.stringify(input.authoritativeReferences), input.followUpRequired ? 1 : 0, input.now, input.now],
      },
      {
        sql: "INSERT INTO case_events (id,case_id,event_type,actor_type,actor_id,from_status,to_status,payload_reference,correlation_id,occurred_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        params: [input.caseId + ":resolved:" + input.now, input.caseId, "case.resolved", "service", context.actorId ?? "system", current.status, "resolved", input.summaryReference, context.correlationId, input.now, input.now],
      },
    ]);
    return this.getRequired(context, input.caseId);
  }

  async createAction(context: RequestContext, input: {
    readonly id: EntityId;
    readonly caseId: EntityId;
    readonly capability: string;
    readonly targetReference: string;
    readonly requestedBy: string;
    readonly authorizationReference: string;
    readonly idempotencyKey: string;
    readonly now: string;
  }): Promise<{ readonly id: EntityId; readonly status: string; readonly resultReference: string | null }> {
    await this.getRequired(context, input.caseId);
    const existing = await this.database.first<{ id: EntityId; status: string; resultReference: string | null }>(
      "SELECT id,status,result_reference AS resultReference FROM case_actions WHERE case_id=? AND idempotency_key=? LIMIT 1",
      input.caseId,
      input.idempotencyKey.trim(),
    );
    if (existing) return existing;
    await this.database.run(
      "INSERT INTO case_actions (id,case_id,capability,target_reference,requested_by,authorization_reference,idempotency_key,status,created_at) VALUES (?,?,?,?,?,?,?,'requested',?)",
      input.id,
      input.caseId,
      input.capability.trim(),
      input.targetReference.trim(),
      input.requestedBy.trim(),
      input.authorizationReference.trim(),
      input.idempotencyKey.trim(),
      input.now,
    );
    return { id: input.id, status: "requested", resultReference: null };
  }

  private async getRequired(context: RequestContext, id: EntityId): Promise<CaseRecord> {
    const record = await this.get(context, id);
    if (!record) throw new DatabaseError("Case not found");
    return record;
  }

  private async appendEvent(context: RequestContext, input: {
    readonly id: EntityId;
    readonly caseId: EntityId;
    readonly eventType: string;
    readonly fromStatus: string | null;
    readonly toStatus: string;
    readonly occurredAt: string;
  }): Promise<void> {
    await this.database.run(
      "INSERT OR IGNORE INTO case_events (id,case_id,event_type,actor_type,actor_id,from_status,to_status,payload_reference,correlation_id,occurred_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      input.id,
      input.caseId,
      input.eventType,
      "service",
      context.actorId ?? "system",
      input.fromStatus,
      input.toStatus,
      null,
      context.correlationId,
      input.occurredAt,
      input.occurredAt,
    );
  }
}

function canTransition(from: CaseStatus, to: CaseStatus): boolean {
  const allowed: Record<CaseStatus, readonly CaseStatus[]> = {
    open: ["triaged","assigned","escalated"],
    triaged: ["assigned","in_progress","escalated"],
    assigned: ["in_progress","waiting","escalated","resolved"],
    in_progress: ["waiting","resolved","escalated"],
    waiting: ["in_progress","resolved","escalated"],
    escalated: ["in_progress","resolved"],
    resolved: ["closed","reopened"],
    closed: [],
    reopened: ["in_progress","waiting","resolved"],
  };
  return allowed[from].includes(to);
}

function eventName(status: CaseStatus): string {
  if (status === "in_progress") return "case.started";
  if (status === "waiting") return "case.waiting";
  if (status === "reopened") return "case.reopened";
  return "case." + status;
}
