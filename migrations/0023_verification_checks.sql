-- Establish verification checks and evidence links.
CREATE TABLE verification_checks (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES verification_cases(id) ON DELETE RESTRICT,
  requirement_id TEXT NOT NULL REFERENCES verification_requirements(id) ON DELETE RESTRICT,
  check_type TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('automated','human')),
  result TEXT NOT NULL CHECK (result IN ('pass','fail','inconclusive')),
  confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  reviewer_id TEXT,
  policy_version TEXT NOT NULL,
  performed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_verification_checks_case
  ON verification_checks(case_id, performed_at DESC);

CREATE INDEX idx_verification_checks_requirement
  ON verification_checks(requirement_id, performed_at DESC);

CREATE TABLE verification_check_documents (
  check_id TEXT NOT NULL REFERENCES verification_checks(id) ON DELETE RESTRICT,
  document_id TEXT NOT NULL REFERENCES verification_documents(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  PRIMARY KEY(check_id, document_id)
);

CREATE INDEX idx_verification_check_documents_document
  ON verification_check_documents(document_id);

CREATE TRIGGER IF NOT EXISTS trg_verification_check_policy_scope_insert
BEFORE INSERT ON verification_checks
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM verification_cases vc
  INNER JOIN verification_requirements vr
    ON vr.id = NEW.requirement_id
   AND vr.policy_id = vc.policy_id
   AND vr.policy_version = vc.policy_version
  WHERE vc.id = NEW.case_id
    AND NEW.policy_version = vc.policy_version
    AND vr.subject_type = vc.subject_type
)
BEGIN
  SELECT RAISE(ABORT, 'Verification check requirement does not match case policy or subject');
END;

CREATE TRIGGER IF NOT EXISTS trg_verification_check_policy_scope_update
BEFORE UPDATE OF case_id, requirement_id, policy_version ON verification_checks
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM verification_cases vc
  INNER JOIN verification_requirements vr
    ON vr.id = NEW.requirement_id
   AND vr.policy_id = vc.policy_id
   AND vr.policy_version = vc.policy_version
  WHERE vc.id = NEW.case_id
    AND NEW.policy_version = vc.policy_version
    AND vr.subject_type = vc.subject_type
)
BEGIN
  SELECT RAISE(ABORT, 'Verification check requirement does not match case policy or subject');
END;

CREATE TRIGGER IF NOT EXISTS trg_verification_check_document_scope_insert
BEFORE INSERT ON verification_check_documents
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM verification_checks vc
  INNER JOIN verification_documents vd ON vd.id = NEW.document_id
  WHERE vc.id = NEW.check_id
    AND vd.case_id = vc.case_id
)
BEGIN
  SELECT RAISE(ABORT, 'Verification evidence does not belong to the check case');
END;

CREATE TRIGGER IF NOT EXISTS trg_verification_check_document_scope_update
BEFORE UPDATE OF check_id, document_id ON verification_check_documents
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM verification_checks vc
  INNER JOIN verification_documents vd ON vd.id = NEW.document_id
  WHERE vc.id = NEW.check_id
    AND vd.case_id = vc.case_id
)
BEGIN
  SELECT RAISE(ABORT, 'Verification evidence does not belong to the check case');
END;
