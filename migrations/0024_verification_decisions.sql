-- Establish immutable authoritative verification decisions.
CREATE TABLE verification_decisions (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES verification_cases(id) ON DELETE RESTRICT,
  requirement_id TEXT NOT NULL REFERENCES verification_requirements(id) ON DELETE RESTRICT,
  outcome TEXT NOT NULL CHECK (
    outcome IN ('approved','rejected','changes_required','expired')
  ),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('human','system_policy')),
  actor_id TEXT,
  rationale_reference TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_verification_decisions_case
  ON verification_decisions(case_id, decided_at DESC);

CREATE INDEX idx_verification_decisions_requirement
  ON verification_decisions(requirement_id, decided_at DESC);

CREATE TABLE verification_decision_checks (
  decision_id TEXT NOT NULL REFERENCES verification_decisions(id) ON DELETE RESTRICT,
  check_id TEXT NOT NULL REFERENCES verification_checks(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  PRIMARY KEY(decision_id, check_id)
);

CREATE INDEX idx_verification_decision_checks_check
  ON verification_decision_checks(check_id);

CREATE TRIGGER IF NOT EXISTS trg_verification_decision_scope_insert
BEFORE INSERT ON verification_decisions
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
  SELECT RAISE(ABORT, 'Verification decision requirement does not match case policy or subject');
END;

CREATE TRIGGER IF NOT EXISTS trg_verification_decision_scope_update
BEFORE UPDATE OF case_id, requirement_id, policy_version, outcome, actor_type, actor_id, rationale_reference, decided_at ON verification_decisions
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Verification decisions are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_verification_decision_scope_delete
BEFORE DELETE ON verification_decisions
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Verification decisions are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_verification_decision_check_scope_insert
BEFORE INSERT ON verification_decision_checks
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM verification_decisions vd
  INNER JOIN verification_checks vc ON vc.id = NEW.check_id
  WHERE vd.id = NEW.decision_id
    AND vc.case_id = vd.case_id
)
BEGIN
  SELECT RAISE(ABORT, 'Verification check does not belong to the decision case');
END;

CREATE TRIGGER IF NOT EXISTS trg_verification_decision_check_scope_update
BEFORE UPDATE OF decision_id, check_id ON verification_decision_checks
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM verification_decisions vd
  INNER JOIN verification_checks vc ON vc.id = NEW.check_id
  WHERE vd.id = NEW.decision_id
    AND vc.case_id = vd.case_id
)
BEGIN
  SELECT RAISE(ABORT, 'Verification check does not belong to the decision case');
END;
