import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type VerificationSubjectType =
  | "business"
  | "user"
  | "professional_credential"
  | "location"
  | "ownership_claim"
  | "other";

export type VerificationCaseStatus =
  | "created"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "expired";

export interface VerificationCaseRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId | null;
  readonly subjectType: VerificationSubjectType;
  readonly subjectId: EntityId;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly status: VerificationCaseStatus;
  readonly riskClass: string;
  readonly submittedAt: string | null;
  readonly resolvedAt: string | null;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface VerificationDocumentRecord {
  readonly id: EntityId;
  readonly caseId: EntityId;
  readonly evidenceType: string;
  readonly storageReference: string;
  readonly contentHash: string;
  readonly issuer: string | null;
  readonly submittedAt: string;
  readonly expiresAt: string | null;
  readonly processingStatus: string;
  readonly classification: string;
  readonly provenance: string;
  readonly retentionPolicy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateVerificationCaseInput {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId?: EntityId | undefined;
  readonly subjectType: VerificationSubjectType;
  readonly subjectId: EntityId;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly riskClass: string;
  readonly now: string;
}

export interface AddVerificationDocumentInput {
  readonly id: EntityId;
  readonly caseId: EntityId;
  readonly evidenceType: string;
  readonly storageReference: string;
  readonly contentHash: string;
  readonly issuer?: string | undefined;
  readonly submittedAt: string;
  readonly expiresAt?: string | undefined;
  readonly processingStatus: string;
  readonly classification: string;
  readonly provenance: string;
  readonly retentionPolicy: string;
  readonly now: string;
}



export interface CreateVerificationPolicyInput {
  readonly id: string;
  readonly version: string;
  readonly subjectType: VerificationSubjectType;
  readonly riskClass: string;
  readonly jurisdiction?: string | undefined;
  readonly industry?: string | undefined;
  readonly effectiveFrom?: string | undefined;
  readonly effectiveTo?: string | undefined;
  readonly humanReviewRules?: string | undefined;
  readonly expiryRules?: string | undefined;
  readonly status?: "draft" | "active" | "retired";
  readonly now: string;
}

export interface CreateVerificationRequirementInput {
  readonly id: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly subjectType: VerificationSubjectType;
  readonly requirementType: string;
  readonly required?: boolean | undefined;
  readonly evidenceTypes: readonly string[];
  readonly humanReviewRequired?: boolean | undefined;
  readonly jurisdiction?: string | undefined;
  readonly industry?: string | undefined;
  readonly effectiveFrom?: string | undefined;
  readonly effectiveTo?: string | undefined;
  readonly expiryRule?: string | undefined;
  readonly now: string;
}

export interface CreateVerificationCheckInput {
  readonly id: EntityId;
  readonly caseId: EntityId;
  readonly requirementId: string;
  readonly checkType: string;
  readonly method: "automated" | "human";
  readonly result: "pass" | "fail" | "inconclusive";
  readonly confidence?: number | undefined;
  readonly reviewerId?: string | undefined;
  readonly policyVersion: string;
  readonly performedAt: string;
  readonly now: string;
}

export interface CreateVerificationDecisionInput {
  readonly id: EntityId;
  readonly caseId: EntityId;
  readonly requirementId: string;
  readonly outcome: "approved" | "rejected" | "changes_required" | "expired";
  readonly actorType: "human" | "system_policy";
  readonly actorId?: string | undefined;
  readonly rationaleReference: string;
  readonly policyVersion: string;
  readonly decidedAt: string;
  readonly now: string;
}

export interface VerificationDecisionRecord {
  readonly id: EntityId;
  readonly caseId: EntityId;
  readonly requirementId: string;
  readonly outcome: CreateVerificationDecisionInput["outcome"];
  readonly actorType: CreateVerificationDecisionInput["actorType"];
  readonly actorId: string | null;
  readonly rationaleReference: string;
  readonly policyVersion: string;
  readonly decidedAt: string;
  readonly createdAt: string;
}

export interface VerificationCheckRecord {
  readonly id: EntityId;
  readonly caseId: EntityId;
  readonly requirementId: string;
  readonly checkType: string;
  readonly method: "automated" | "human";
  readonly result: "pass" | "fail" | "inconclusive";
  readonly confidence: number | null;
  readonly reviewerId: string | null;
  readonly policyVersion: string;
  readonly performedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}


export type VerificationReviewStatus = "assigned" | "in_progress" | "completed" | "escalated";

export interface VerificationReviewRecord {
  readonly id: EntityId;
  readonly caseId: EntityId;
  readonly reviewerId: string;
  readonly status: VerificationReviewStatus;
  readonly assignedAt: string;
  readonly completedAt: string | null;
  readonly reviewOutcome: string | null;
  readonly escalationReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface VerificationExpiryRecord {
  readonly id: EntityId;
  readonly caseId: EntityId;
  readonly requirementId: string;
  readonly evidenceId: EntityId | null;
  readonly expiresAt: string;
  readonly detectedAt: string;
  readonly reevaluationStatus: "pending" | "evaluated" | "blocked";
  readonly resultingDecisionId: EntityId | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateVerificationReviewInput {
  readonly id: EntityId;
  readonly caseId: EntityId;
  readonly reviewerId: string;
  readonly assignedAt: string;
  readonly now: string;
}

export interface CreateVerificationExpiryInput {
  readonly id: EntityId;
  readonly caseId: EntityId;
  readonly requirementId: string;
  readonly evidenceId?: EntityId | undefined;
  readonly expiresAt: string;
  readonly detectedAt: string;
  readonly now: string;
}

export class VerificationRepository extends Repository {
  constructor(database: D1Database) {
    super(database);
  }

  async getCase(context: RequestContext, id: EntityId): Promise<VerificationCaseRecord | null> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });

    return this.database.first<VerificationCaseRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, subject_type AS subjectType, subject_id AS subjectId, policy_id AS policyId, policy_version AS policyVersion, status, risk_class AS riskClass, submitted_at AS submittedAt, resolved_at AS resolvedAt, expires_at AS expiresAt, created_at AS createdAt, updated_at AS updatedAt FROM verification_cases WHERE id = ? AND organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?) LIMIT 1",
      id,
      organizationId,
      workspaceId,
    );
  }


  async createPolicy(input: CreateVerificationPolicyInput): Promise<void> {
    if (!input.id.trim()) throw new DatabaseError("Verification policy id is required");
    if (!input.version.trim()) throw new DatabaseError("Verification policy version is required");
    if (!input.riskClass.trim()) throw new DatabaseError("Verification policy risk class is required");

    await this.database.run(
      "INSERT INTO verification_policies (id, version, jurisdiction, industry, subject_type, risk_class, effective_from, effective_to, human_review_rules, expiry_rules, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id.trim(),
      input.version.trim(),
      input.jurisdiction ?? null,
      input.industry ?? null,
      input.subjectType,
      input.riskClass.trim(),
      input.effectiveFrom ?? null,
      input.effectiveTo ?? null,
      input.humanReviewRules ?? null,
      input.expiryRules ?? null,
      input.status ?? "draft",
      input.now,
      input.now,
    );
  }

  async createRequirement(input: CreateVerificationRequirementInput): Promise<void> {
    if (!input.requirementType.trim()) throw new DatabaseError("Verification requirement type is required");
    if (input.evidenceTypes.length === 0) throw new DatabaseError("Verification requirement evidence types are required");

    await this.database.run(
      "INSERT INTO verification_requirements (id, policy_id, policy_version, subject_type, jurisdiction, industry, requirement_type, required, evidence_types, human_review_required, effective_from, effective_to, expiry_rule, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id,
      input.policyId,
      input.policyVersion,
      input.subjectType,
      input.jurisdiction ?? null,
      input.industry ?? null,
      input.requirementType.trim(),
      input.required === false ? 0 : 1,
      JSON.stringify(input.evidenceTypes),
      input.humanReviewRequired ? 1 : 0,
      input.effectiveFrom ?? null,
      input.effectiveTo ?? null,
      input.expiryRule ?? null,
      input.now,
      input.now,
    );
  }

  async createCheck(
    context: RequestContext,
    input: CreateVerificationCheckInput,
  ): Promise<VerificationCheckRecord> {
    const verificationCase = await this.getCase(context, input.caseId);
    if (!verificationCase) throw new DatabaseError("Verification case not found");
    if (!input.checkType.trim()) throw new DatabaseError("Verification check type is required");
    if (input.confidence !== undefined && (input.confidence < 0 || input.confidence > 1)) {
      throw new DatabaseError("Verification check confidence must be between 0 and 1");
    }

    await this.database.run(
      "INSERT INTO verification_checks (id, case_id, requirement_id, check_type, method, result, confidence, reviewer_id, policy_version, performed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id,
      input.caseId,
      input.requirementId,
      input.checkType.trim(),
      input.method,
      input.result,
      input.confidence ?? null,
      input.reviewerId ?? null,
      input.policyVersion,
      input.performedAt,
      input.now,
      input.now,
    );

    const record = await this.database.first<VerificationCheckRecord>(
      "SELECT id, case_id AS caseId, requirement_id AS requirementId, check_type AS checkType, method, result, confidence, reviewer_id AS reviewerId, policy_version AS policyVersion, performed_at AS performedAt, created_at AS createdAt, updated_at AS updatedAt FROM verification_checks WHERE id = ? LIMIT 1",
      input.id,
    );
    if (!record) throw new DatabaseError("Verification check not found after creation");
    return record;
  }

  async attachEvidenceToCheck(
    context: RequestContext,
    checkId: EntityId,
    documentId: EntityId,
    now: string,
  ): Promise<void> {
    const check = await this.database.first<{ caseId: EntityId }>(
      "SELECT case_id AS caseId FROM verification_checks WHERE id = ? LIMIT 1",
      checkId,
    );
    if (!check) throw new DatabaseError("Verification check not found");

    const document = await this.listDocuments(context, await this.resolveCaseForCheck(checkId));
    if (!document.some((item) => item.id === documentId)) {
      throw new DatabaseError("Verification evidence is not available in the current case scope");
    }

    await this.database.run(
      "INSERT INTO verification_check_documents (check_id, document_id, created_at) VALUES (?, ?, ?)",
      checkId,
      documentId,
      now,
    );
  }

  async createDecision(
    context: RequestContext,
    input: CreateVerificationDecisionInput,
  ): Promise<VerificationDecisionRecord> {
    const verificationCase = await this.getCase(context, input.caseId);
    if (!verificationCase) throw new DatabaseError("Verification case not found");
    if (!input.rationaleReference.trim()) throw new DatabaseError("Verification decision rationale reference is required");

    await this.database.run(
      "INSERT INTO verification_decisions (id, case_id, requirement_id, outcome, actor_type, actor_id, rationale_reference, policy_version, decided_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id,
      input.caseId,
      input.requirementId,
      input.outcome,
      input.actorType,
      input.actorId ?? null,
      input.rationaleReference.trim(),
      input.policyVersion,
      input.decidedAt,
      input.now,
    );

    const record = await this.database.first<VerificationDecisionRecord>(
      "SELECT id, case_id AS caseId, requirement_id AS requirementId, outcome, actor_type AS actorType, actor_id AS actorId, rationale_reference AS rationaleReference, policy_version AS policyVersion, decided_at AS decidedAt, created_at AS createdAt FROM verification_decisions WHERE id = ? LIMIT 1",
      input.id,
    );
    if (!record) throw new DatabaseError("Verification decision not found after creation");
    return record;
  }

  async attachCheckToDecision(
    context: RequestContext,
    decisionId: EntityId,
    checkId: EntityId,
    now: string,
  ): Promise<void> {
    const decision = await this.database.first<{ caseId: EntityId }>(
      "SELECT case_id AS caseId FROM verification_decisions WHERE id = ? LIMIT 1",
      decisionId,
    );
    if (!decision) throw new DatabaseError("Verification decision not found");
    await this.getCase(context, decision.caseId);

    const check = await this.database.first<{ id: EntityId; caseId: EntityId }>(
      "SELECT id, case_id AS caseId FROM verification_checks WHERE id = ? LIMIT 1",
      checkId,
    );
    if (!check) throw new DatabaseError("Verification check not found");
    if (check.caseId !== decision.caseId) throw new DatabaseError("Verification check does not belong to the decision case");

    await this.database.run(
      "INSERT INTO verification_decision_checks (decision_id, check_id, created_at) VALUES (?, ?, ?)",
      decisionId,
      checkId,
      now,
    );
  }

  private async resolveCaseForCheck(checkId: EntityId): Promise<EntityId> {
    const row = await this.database.first<{ caseId: EntityId }>(
      "SELECT case_id AS caseId FROM verification_checks WHERE id = ? LIMIT 1",
      checkId,
    );
    if (!row) throw new DatabaseError("Verification check not found");
    return row.caseId;
  }


  async assignReview(
    context: RequestContext,
    input: CreateVerificationReviewInput,
  ): Promise<VerificationReviewRecord> {
    const verificationCase = await this.getCase(context, input.caseId);
    if (!verificationCase) throw new DatabaseError("Verification case not found");
    if (!input.reviewerId.trim()) throw new DatabaseError("Verification reviewer is required");
    if (verificationCase.status !== "submitted" && verificationCase.status !== "under_review") {
      throw new DatabaseError("Verification case is not eligible for human review");
    }

    await this.database.run(
      "INSERT INTO verification_reviews (id, case_id, reviewer_id, status, assigned_at, created_at, updated_at) VALUES (?, ?, ?, 'assigned', ?, ?, ?)",
      input.id,
      input.caseId,
      input.reviewerId.trim(),
      input.assignedAt,
      input.now,
      input.now,
    );

    if (verificationCase.status === "submitted") {
      await this.database.run(
        "UPDATE verification_cases SET status = 'under_review', updated_at = ? WHERE id = ? AND status = 'submitted'",
        input.now,
        input.caseId,
      );
    }

    return this.getReview(context, input.id);
  }

  async updateReview(
    context: RequestContext,
    id: EntityId,
    status: VerificationReviewStatus,
    now: string,
    reviewOutcome?: string,
    escalationReason?: string,
  ): Promise<VerificationReviewRecord> {
    const review = await this.getReview(context, id);
    if (!review) throw new DatabaseError("Verification review not found");
    await this.getCase(context, review.caseId);

    if (status === "completed" && !reviewOutcome?.trim()) {
      throw new DatabaseError("Completed verification review requires an outcome");
    }
    if (status === "escalated" && !escalationReason?.trim()) {
      throw new DatabaseError("Escalated verification review requires an escalation reason");
    }

    const completedAt = status === "completed" ? now : review.completedAt;
    await this.database.run(
      "UPDATE verification_reviews SET status = ?, completed_at = ?, review_outcome = ?, escalation_reason = ?, updated_at = ? WHERE id = ?",
      status,
      completedAt,
      reviewOutcome?.trim() || review.reviewOutcome,
      escalationReason?.trim() || review.escalationReason,
      now,
      id,
    );
    return this.getReview(context, id);
  }

  async getReview(
    context: RequestContext,
    id: EntityId,
  ): Promise<VerificationReviewRecord> {
    const review = await this.database.first<VerificationReviewRecord>(
      "SELECT vr.id, vr.case_id AS caseId, vr.reviewer_id AS reviewerId, vr.status, vr.assigned_at AS assignedAt, vr.completed_at AS completedAt, vr.review_outcome AS reviewOutcome, vr.escalation_reason AS escalationReason, vr.created_at AS createdAt, vr.updated_at AS updatedAt FROM verification_reviews vr INNER JOIN verification_cases vc ON vc.id = vr.case_id WHERE vr.id = ? AND vc.organization_id = ? AND (vc.workspace_id IS NULL OR vc.workspace_id = ?) LIMIT 1",
      id,
      this.requireOrganization({ organizationId: context.tenantId }),
      this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
    if (!review) throw new DatabaseError("Verification review not found");
    return review;
  }

  async createExpiry(
    context: RequestContext,
    input: CreateVerificationExpiryInput,
  ): Promise<VerificationExpiryRecord> {
    const verificationCase = await this.getCase(context, input.caseId);
    if (!verificationCase) throw new DatabaseError("Verification case not found");
    if (input.detectedAt < input.expiresAt) {
      throw new DatabaseError("Verification expiry detection cannot precede expiry");
    }

    const requirement = await this.database.first<{ id: string }>(
      "SELECT id FROM verification_requirements WHERE id = ? AND policy_id = ? AND policy_version = ? AND subject_type = ? LIMIT 1",
      input.requirementId,
      verificationCase.policyId,
      verificationCase.policyVersion,
      verificationCase.subjectType,
    );
    if (!requirement) throw new DatabaseError("Verification expiry requirement does not match case policy");

    if (input.evidenceId) {
      const evidence = await this.database.first<{ id: EntityId }>(
        "SELECT id FROM verification_documents WHERE id = ? AND case_id = ? LIMIT 1",
        input.evidenceId,
        input.caseId,
      );
      if (!evidence) throw new DatabaseError("Verification expiry evidence does not belong to case");
    }

    await this.database.run(
      "INSERT INTO verification_expiries (id, case_id, requirement_id, evidence_id, expires_at, detected_at, reevaluation_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)",
      input.id,
      input.caseId,
      input.requirementId,
      input.evidenceId ?? null,
      input.expiresAt,
      input.detectedAt,
      input.now,
      input.now,
    );
    return this.getExpiry(context, input.id);
  }

  async evaluateExpiry(
    context: RequestContext,
    id: EntityId,
    resultingDecisionId: EntityId | null,
    status: "evaluated" | "blocked",
    now: string,
  ): Promise<VerificationExpiryRecord> {
    const expiry = await this.getExpiry(context, id);
    if (!expiry) throw new DatabaseError("Verification expiry not found");
    if (expiry.reevaluationStatus !== "pending") {
      throw new DatabaseError("Verification expiry is already resolved");
    }

    if (resultingDecisionId) {
      const decision = await this.database.first<{ caseId: EntityId; requirementId: string }>(
        "SELECT case_id AS caseId, requirement_id AS requirementId FROM verification_decisions WHERE id = ? LIMIT 1",
        resultingDecisionId,
      );
      if (!decision || decision.caseId !== expiry.caseId || decision.requirementId !== expiry.requirementId) {
        throw new DatabaseError("Resulting verification decision does not match expiry");
      }
    }

    await this.database.run(
      "UPDATE verification_expiries SET reevaluation_status = ?, resulting_decision_id = ?, updated_at = ? WHERE id = ? AND reevaluation_status = 'pending'",
      status,
      resultingDecisionId,
      now,
      id,
    );
    return this.getExpiry(context, id);
  }

  async getExpiry(
    context: RequestContext,
    id: EntityId,
  ): Promise<VerificationExpiryRecord> {
    const expiry = await this.database.first<VerificationExpiryRecord>(
      "SELECT ve.id, ve.case_id AS caseId, ve.requirement_id AS requirementId, ve.evidence_id AS evidenceId, ve.expires_at AS expiresAt, ve.detected_at AS detectedAt, ve.reevaluation_status AS reevaluationStatus, ve.resulting_decision_id AS resultingDecisionId, ve.created_at AS createdAt, ve.updated_at AS updatedAt FROM verification_expiries ve INNER JOIN verification_cases vc ON vc.id = ve.case_id WHERE ve.id = ? AND vc.organization_id = ? AND (vc.workspace_id IS NULL OR vc.workspace_id = ?) LIMIT 1",
      id,
      this.requireOrganization({ organizationId: context.tenantId }),
      this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
    if (!expiry) throw new DatabaseError("Verification expiry not found");
    return expiry;
  }

  async listPendingExpiries(
    context: RequestContext,
    limit = 100,
  ): Promise<readonly VerificationExpiryRecord[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
    return this.database.all<VerificationExpiryRecord>(
      "SELECT ve.id, ve.case_id AS caseId, ve.requirement_id AS requirementId, ve.evidence_id AS evidenceId, ve.expires_at AS expiresAt, ve.detected_at AS detectedAt, ve.reevaluation_status AS reevaluationStatus, ve.resulting_decision_id AS resultingDecisionId, ve.created_at AS createdAt, ve.updated_at AS updatedAt FROM verification_expiries ve INNER JOIN verification_cases vc ON vc.id = ve.case_id WHERE ve.reevaluation_status = 'pending' AND vc.organization_id = ? AND (vc.workspace_id IS NULL OR vc.workspace_id = ?) ORDER BY ve.expires_at ASC, ve.id ASC LIMIT ?",
      this.requireOrganization({ organizationId: context.tenantId }),
      this.requireWorkspace({ workspaceId: context.workspaceId }),
      safeLimit,
    );
  }

  async createCase(
    context: RequestContext,
    input: CreateVerificationCaseInput,
  ): Promise<VerificationCaseRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    if (input.organizationId !== organizationId) {
      throw new DatabaseError("Verification case organization does not match request context");
    }
    if (input.workspaceId && input.workspaceId !== context.workspaceId) {
      throw new DatabaseError("Verification case workspace does not match request context");
    }
    if (!input.policyId.trim()) throw new DatabaseError("Verification policy id is required");
    if (!input.policyVersion.trim()) throw new DatabaseError("Verification policy version is required");
    if (!input.riskClass.trim()) throw new DatabaseError("Verification risk class is required");

    await this.database.run(
      "INSERT INTO verification_cases (id, organization_id, workspace_id, subject_type, subject_id, policy_id, policy_version, status, risk_class, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'created', ?, ?, ?)",
      input.id,
      input.organizationId,
      input.workspaceId ?? null,
      input.subjectType,
      input.subjectId,
      input.policyId.trim(),
      input.policyVersion.trim(),
      input.riskClass.trim(),
      input.now,
      input.now,
    );

    const record = await this.getCase(context, input.id);
    if (!record) throw new DatabaseError("Verification case not found after creation");
    return record;
  }

  async submitCase(
    context: RequestContext,
    id: EntityId,
    submittedAt: string,
    now: string,
  ): Promise<VerificationCaseRecord> {
    const current = await this.getCase(context, id);
    if (!current) throw new DatabaseError("Verification case not found");
    if (current.status !== "created") {
      throw new DatabaseError("Only created verification cases can be submitted");
    }

    await this.database.run(
      "UPDATE verification_cases SET status = 'submitted', submitted_at = ?, updated_at = ? WHERE id = ?",
      submittedAt,
      now,
      id,
    );

    const record = await this.getCase(context, id);
    if (!record) throw new DatabaseError("Verification case not found after submission");
    return record;
  }

  async addDocument(
    context: RequestContext,
    input: AddVerificationDocumentInput,
  ): Promise<VerificationDocumentRecord> {
    const verificationCase = await this.getCase(context, input.caseId);
    if (!verificationCase) throw new DatabaseError("Verification case not found");

    if (!input.evidenceType.trim()) throw new DatabaseError("Verification evidence type is required");
    if (!input.storageReference.trim()) throw new DatabaseError("Verification storage reference is required");
    if (!input.contentHash.trim()) throw new DatabaseError("Verification evidence content hash is required");
    if (!input.processingStatus.trim()) throw new DatabaseError("Verification processing status is required");
    if (!input.classification.trim()) throw new DatabaseError("Verification classification is required");
    if (!input.provenance.trim()) throw new DatabaseError("Verification provenance is required");
    if (!input.retentionPolicy.trim()) throw new DatabaseError("Verification retention policy is required");

    await this.database.run(
      "INSERT INTO verification_documents (id, case_id, evidence_type, storage_reference, content_hash, issuer, submitted_at, expires_at, processing_status, classification, provenance, retention_policy, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id,
      input.caseId,
      input.evidenceType.trim(),
      input.storageReference.trim(),
      input.contentHash.trim(),
      input.issuer?.trim() || null,
      input.submittedAt,
      input.expiresAt ?? null,
      input.processingStatus.trim(),
      input.classification.trim(),
      input.provenance.trim(),
      input.retentionPolicy.trim(),
      input.now,
      input.now,
    );

    const document = await this.database.first<VerificationDocumentRecord>(
      "SELECT id, case_id AS caseId, evidence_type AS evidenceType, storage_reference AS storageReference, content_hash AS contentHash, issuer, submitted_at AS submittedAt, expires_at AS expiresAt, processing_status AS processingStatus, classification, provenance, retention_policy AS retentionPolicy, created_at AS createdAt, updated_at AS updatedAt FROM verification_documents WHERE id = ? LIMIT 1",
      input.id,
    );
    if (!document) throw new DatabaseError("Verification document not found after creation");
    return document;
  }

  async listDocuments(
    context: RequestContext,
    caseId: EntityId,
  ): Promise<readonly VerificationDocumentRecord[]> {
    const verificationCase = await this.getCase(context, caseId);
    if (!verificationCase) throw new DatabaseError("Verification case not found");

    return this.database.all<VerificationDocumentRecord>(
      "SELECT id, case_id AS caseId, evidence_type AS evidenceType, storage_reference AS storageReference, content_hash AS contentHash, issuer, submitted_at AS submittedAt, expires_at AS expiresAt, processing_status AS processingStatus, classification, provenance, retention_policy AS retentionPolicy, created_at AS createdAt, updated_at AS updatedAt FROM verification_documents WHERE case_id = ? ORDER BY submitted_at DESC, id DESC",
      caseId,
    );
  }
}
