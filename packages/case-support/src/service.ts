import type { EntityId, RequestContext } from "@qooqnos/core";
import type { AuthorizationService } from "@qooqnos/runtime";
import { CaseSupportRepository, type CasePriority, type CaseStatus } from "./repository";

export interface CaseSupportServiceOptions {
  readonly repository: CaseSupportRepository;
  readonly authorization: AuthorizationService;
  readonly id: () => EntityId;
  readonly now: () => string;
}

export class CaseSupportService {
  constructor(private readonly options: CaseSupportServiceOptions) {}

  async create(context: RequestContext, input: {
    readonly caseTypeId: EntityId;
    readonly priority: CasePriority;
    readonly severity: string;
    readonly subjectType: string;
    readonly subjectId: EntityId;
    readonly requesterType: string;
    readonly requesterId: EntityId;
    readonly sourceType: string;
    readonly sourceReference?: string;
    readonly queueId?: EntityId;
    readonly slaId?: EntityId;
  }) {
    await this.options.authorization.assert({ context, permission: "case.create", requireAuthentication: true, requireWorkspace: false });
    return this.options.repository.createCase(context, { ...input, id: this.options.id(), now: this.options.now() });
  }

  async get(context: RequestContext, id: EntityId) {
    await this.options.authorization.assert({ context, permission: "case.get", requireAuthentication: true, requireWorkspace: false });
    return this.options.repository.get(context, id);
  }

  async list(context: RequestContext, limit = 100) {
    await this.options.authorization.assert({ context, permission: "case.list", requireAuthentication: true, requireWorkspace: false });
    return this.options.repository.list(context, limit);
  }

  async recordFirstResponse(context: RequestContext, caseId: EntityId) {
    await this.options.authorization.assert({
      context,
      permission: "case.update",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    return this.options.repository.recordFirstResponse(context, {
      caseId,
      actorId: context.actorId ?? "system",
      now: this.options.now(),
    });
  }

  async transition(context: RequestContext, input: {
    readonly id: EntityId;
    readonly status: CaseStatus;
    readonly expectedVersion: number;
    readonly reason?: string;
  }) {
    const permission =
      input.status === "triaged"
        ? "case.triage"
        : input.status === "closed"
          ? "case.close"
          : input.status === "reopened"
            ? "case.reopen"
            : "case.update";
    await this.options.authorization.assert({ context, permission, requireAuthentication: true, requireWorkspace: false });
    return this.options.repository.transition(context, { ...input, now: this.options.now() });
  }

  async assign(context: RequestContext, input: {
    readonly id: EntityId;
    readonly queueId?: EntityId;
    readonly assigneeType: string;
    readonly assigneeId: string;
    readonly assignedBy: string;
    readonly reason?: string;
    readonly expectedVersion: number;
  }) {
    await this.options.authorization.assert({ context, permission: "case.assign", requireAuthentication: true, requireWorkspace: false });
    return this.options.repository.assign(context, { ...input, now: this.options.now() });
  }

  async addNote(context: RequestContext, input: {
    readonly caseId: EntityId;
    readonly authorId: string;
    readonly visibility: string;
    readonly contentReference: string;
    readonly classification: string;
  }) {
    await this.options.authorization.assert({ context, permission: "case.add_note", requireAuthentication: true, requireWorkspace: false });
    return this.options.repository.addNote(context, { ...input, id: this.options.id(), now: this.options.now() });
  }

  async addEvidence(context: RequestContext, input: {
    readonly caseId: EntityId;
    readonly sourceModule: string;
    readonly sourceType: string;
    readonly sourceId: string;
    readonly evidenceType: string;
    readonly classification: string;
    readonly accessPolicyReference?: string;
  }) {
    await this.options.authorization.assert({ context, permission: "case.add_evidence_reference", requireAuthentication: true, requireWorkspace: false });
    return this.options.repository.addEvidenceReference(context, { ...input, id: this.options.id(), now: this.options.now() });
  }

  async addLink(context: RequestContext, input: {
    readonly caseId: EntityId;
    readonly linkedType: string;
    readonly linkedId: string;
    readonly relationship: string;
  }) {
    await this.options.authorization.assert({ context, permission: "case.update", requireAuthentication: true, requireWorkspace: false });
    return this.options.repository.addLink(context, { ...input, id: this.options.id(), now: this.options.now() });
  }

  async escalate(context: RequestContext, input: {
    readonly caseId: EntityId;
    readonly escalationType: string;
    readonly reason: string;
    readonly targetQueueId?: EntityId;
    readonly targetActorId?: string;
    readonly policyVersion: string;
    readonly requestedBy: string;
    readonly expectedVersion: number;
  }) {
    await this.options.authorization.assert({ context, permission: "case.escalate", requireAuthentication: true, requireWorkspace: false });
    return this.options.repository.escalate(context, { ...input, id: this.options.id(), now: this.options.now() });
  }

  async resolve(context: RequestContext, input: {
    readonly caseId: EntityId;
    readonly outcomeCode: string;
    readonly summaryReference: string;
    readonly resolverId: string;
    readonly authoritativeReferences: readonly string[];
    readonly followUpRequired: boolean;
    readonly expectedVersion: number;
  }) {
    await this.options.authorization.assert({ context, permission: "case.resolve", requireAuthentication: true, requireWorkspace: false });
    return this.options.repository.resolve(context, { ...input, id: this.options.id(), now: this.options.now() });
  }

  async createAction(context: RequestContext, input: {
    readonly caseId: EntityId;
    readonly capability: string;
    readonly targetReference: string;
    readonly requestedBy: string;
    readonly authorizationReference: string;
    readonly idempotencyKey: string;
  }) {
    await this.options.authorization.assert({ context, permission: "case.update", requireAuthentication: true, requireWorkspace: false });
    return this.options.repository.createAction(context, { ...input, id: this.options.id(), now: this.options.now() });
  }
}

export const CASE_SUPPORT_PERMISSIONS = [
  "case.create",
  "case.get",
  "case.update",
  "case.triage",
  "case.assign",
  "case.escalate",
  "case.add_note",
  "case.add_evidence_reference",
  "case.resolve",
  "case.close",
  "case.reopen",
  "case.list",
] as const;
