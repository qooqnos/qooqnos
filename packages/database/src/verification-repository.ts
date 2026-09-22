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
