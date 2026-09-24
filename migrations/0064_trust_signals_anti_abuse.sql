-- Trust signals and anti-abuse projection boundary.
-- TrustSignal is derived evidence; verification truth remains in VerificationCase/Decision.
CREATE TABLE trust_signals (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  subject_type TEXT NOT NULL CHECK (
    subject_type IN ('business','user','professional_credential','location','ownership_claim','review','offering','product','other')
  ),
  subject_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info','low','medium','high','critical')),
  value_json TEXT,
  confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  policy_version TEXT,
  status TEXT NOT NULL CHECK (status IN ('active','expired','superseded','dismissed')),
  detected_at TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id, COALESCE(workspace_id, ''), source_type, source_id, signal_type, COALESCE(policy_version, ''))
);

CREATE UNIQUE INDEX uq_moderation_case_source_idempotency
  ON moderation_cases(organization_id, source_type, source_id, policy_id, policy_version);

CREATE INDEX idx_trust_signals_subject_status
  ON trust_signals(organization_id, workspace_id, subject_type, subject_id, status, detected_at DESC);

CREATE INDEX idx_trust_signals_type_time
  ON trust_signals(organization_id, signal_type, severity, detected_at DESC);

CREATE INDEX idx_trust_signals_expiry
  ON trust_signals(status, expires_at);

CREATE TRIGGER IF NOT EXISTS trg_trust_signal_workspace_scope_insert
BEFORE INSERT ON trust_signals
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM workspaces w
   WHERE w.id = NEW.workspace_id
     AND w.organization_id = NEW.organization_id
 )
BEGIN
  SELECT RAISE(ABORT, 'Trust signal workspace crosses organization boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_trust_signal_immutable_source
BEFORE UPDATE OF organization_id, workspace_id, subject_type, subject_id, signal_type,
  source_type, source_id, policy_version, detected_at
ON trust_signals
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Trust signal provenance is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_trust_signal_no_delete
BEFORE DELETE ON trust_signals
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Trust signals are append-only evidence');
END;
