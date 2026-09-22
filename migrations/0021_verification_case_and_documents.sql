-- Establish the canonical Trust VerificationCase aggregate.
-- Policy/requirement registries remain separate contracts; this table stores the
-- immutable policy reference/version evaluated for the case.

CREATE TABLE verification_cases (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  subject_type TEXT NOT NULL CHECK (
    subject_type IN (
      'business',
      'user',
      'professional_credential',
      'location',
      'ownership_claim',
      'other'
    )
  ),
  subject_id TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('created','submitted','under_review','approved','rejected','expired')
  ),
  risk_class TEXT NOT NULL,
  submitted_at TEXT,
  resolved_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_verification_cases_scope_status
  ON verification_cases(organization_id, workspace_id, status);

CREATE INDEX idx_verification_cases_subject
  ON verification_cases(subject_type, subject_id);

CREATE INDEX idx_verification_cases_expiry
  ON verification_cases(expires_at);

CREATE TRIGGER IF NOT EXISTS trg_verification_case_workspace_scope_insert
BEFORE INSERT ON verification_cases
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1 FROM workspaces w
  WHERE w.id = NEW.workspace_id
    AND w.organization_id = NEW.organization_id
 )
BEGIN
  SELECT RAISE(ABORT, 'Verification case workspace crosses organization boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_verification_case_workspace_scope_update
BEFORE UPDATE OF organization_id, workspace_id ON verification_cases
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1 FROM workspaces w
  WHERE w.id = NEW.workspace_id
    AND w.organization_id = NEW.organization_id
 )
BEGIN
  SELECT RAISE(ABORT, 'Verification case workspace crosses organization boundary');
END;

CREATE TABLE verification_documents (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES verification_cases(id) ON DELETE RESTRICT,
  evidence_type TEXT NOT NULL,
  storage_reference TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  issuer TEXT,
  submitted_at TEXT NOT NULL,
  expires_at TEXT,
  processing_status TEXT NOT NULL,
  classification TEXT NOT NULL,
  provenance TEXT NOT NULL,
  retention_policy TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_verification_documents_case
  ON verification_documents(case_id, submitted_at DESC);

CREATE INDEX idx_verification_documents_expiry
  ON verification_documents(expires_at);

CREATE INDEX idx_verification_documents_hash
  ON verification_documents(content_hash);

CREATE TRIGGER IF NOT EXISTS trg_verification_document_org_scope_insert
BEFORE INSERT ON verification_documents
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM verification_cases vc
  WHERE vc.id = NEW.case_id
)
BEGIN
  SELECT RAISE(ABORT, 'Verification document references an unknown case');
END;
