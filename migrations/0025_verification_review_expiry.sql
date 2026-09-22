-- Add human review assignment/state and explicit expiry/re-evaluation records.
CREATE TABLE verification_reviews (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES verification_cases(id) ON DELETE RESTRICT,
  reviewer_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('assigned','in_progress','completed','escalated')
  ),
  assigned_at TEXT NOT NULL,
  completed_at TEXT,
  review_outcome TEXT,
  escalation_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    completed_at IS NULL
    OR completed_at >= assigned_at
  )
);

CREATE INDEX idx_verification_reviews_case
  ON verification_reviews(case_id, assigned_at DESC);

CREATE INDEX idx_verification_reviews_reviewer_status
  ON verification_reviews(reviewer_id, status);

CREATE TABLE verification_expiries (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES verification_cases(id) ON DELETE RESTRICT,
  requirement_id TEXT NOT NULL REFERENCES verification_requirements(id) ON DELETE RESTRICT,
  evidence_id TEXT REFERENCES verification_documents(id) ON DELETE RESTRICT,
  expires_at TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  reevaluation_status TEXT NOT NULL CHECK (
    reevaluation_status IN ('pending','evaluated','blocked')
  ),
  resulting_decision_id TEXT REFERENCES verification_decisions(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (detected_at >= expires_at)
);

CREATE INDEX idx_verification_expiries_case
  ON verification_expiries(case_id, expires_at DESC);

CREATE INDEX idx_verification_expiries_pending
  ON verification_expiries(reevaluation_status, expires_at);

CREATE INDEX idx_verification_expiries_evidence
  ON verification_expiries(evidence_id);

CREATE TRIGGER IF NOT EXISTS trg_verification_review_case_scope_insert
BEFORE INSERT ON verification_reviews
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM verification_cases vc
  WHERE vc.id = NEW.case_id
)
BEGIN
  SELECT RAISE(ABORT, 'Verification review references an unknown case');
END;

CREATE TRIGGER IF NOT EXISTS trg_verification_review_case_scope_update
BEFORE UPDATE OF case_id ON verification_reviews
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM verification_cases vc
  WHERE vc.id = NEW.case_id
)
BEGIN
  SELECT RAISE(ABORT, 'Verification review references an unknown case');
END;

CREATE TRIGGER IF NOT EXISTS trg_verification_expiry_scope_insert
BEFORE INSERT ON verification_expiries
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM verification_cases vc
  INNER JOIN verification_requirements vr
    ON vr.id = NEW.requirement_id
   AND vr.policy_id = vc.policy_id
   AND vr.policy_version = vc.policy_version
  LEFT JOIN verification_documents vd
    ON vd.id = NEW.evidence_id
   AND vd.case_id = vc.id
  WHERE vc.id = NEW.case_id
    AND (NEW.evidence_id IS NULL OR vd.id IS NOT NULL)
)
BEGIN
  SELECT RAISE(ABORT, 'Verification expiry scope does not match case, requirement or evidence');
END;

CREATE TRIGGER IF NOT EXISTS trg_verification_expiry_scope_update
BEFORE UPDATE OF case_id, requirement_id, evidence_id, resulting_decision_id ON verification_expiries
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM verification_cases vc
  INNER JOIN verification_requirements vr
    ON vr.id = NEW.requirement_id
   AND vr.policy_id = vc.policy_id
   AND vr.policy_version = vc.policy_version
  LEFT JOIN verification_documents vd
    ON vd.id = NEW.evidence_id
   AND vd.case_id = vc.id
  LEFT JOIN verification_decisions vd2
    ON vd2.id = NEW.resulting_decision_id
   AND vd2.case_id = vc.id
   AND vd2.requirement_id = NEW.requirement_id
  WHERE vc.id = NEW.case_id
    AND (NEW.evidence_id IS NULL OR vd.id IS NOT NULL)
    AND (NEW.resulting_decision_id IS NULL OR vd2.id IS NOT NULL)
)
BEGIN
  SELECT RAISE(ABORT, 'Verification expiry scope does not match case, requirement, evidence or decision');
END;
