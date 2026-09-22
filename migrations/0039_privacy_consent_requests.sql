-- Establish canonical consent and privacy-request persistence.
CREATE TABLE privacy_consents (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('customer','user','member','actor')),
  subject_id TEXT NOT NULL,
  purpose TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('granted','revoked','expired')),
  source TEXT NOT NULL,
  evidence_reference TEXT,
  granted_at TEXT,
  revoked_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (revoked_at IS NULL OR granted_at IS NULL OR revoked_at >= granted_at),
  CHECK (expires_at IS NULL OR granted_at IS NULL OR expires_at >= granted_at)
);

CREATE INDEX idx_privacy_consents_subject_purpose
  ON privacy_consents(organization_id, subject_type, subject_id, purpose, status);

CREATE UNIQUE INDEX uq_privacy_active_consent
  ON privacy_consents(organization_id, subject_type, subject_id, purpose)
  WHERE status = 'granted';

CREATE TABLE privacy_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('customer','user','member','actor')),
  subject_id TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('access','export','delete','restrict','correct')),
  status TEXT NOT NULL CHECK (status IN ('requested','validating','approved','processing','completed','rejected','cancelled')),
  requested_by TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  due_at TEXT,
  completed_at TEXT,
  result_reference TEXT,
  rejection_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (completed_at IS NULL OR completed_at >= requested_at),
  CHECK (due_at IS NULL OR due_at >= requested_at)
);

CREATE INDEX idx_privacy_requests_subject_status
  ON privacy_requests(organization_id, subject_type, subject_id, status, requested_at DESC);

CREATE INDEX idx_privacy_requests_due
  ON privacy_requests(status, due_at);

CREATE TABLE privacy_processing_records (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES privacy_requests(id) ON DELETE RESTRICT,
  module_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_reference TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued','processing','completed','failed','skipped')),
  error_reference TEXT,
  processed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_privacy_processing_request
  ON privacy_processing_records(request_id, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_privacy_consent_scope_insert
BEFORE INSERT ON privacy_consents
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1 FROM workspaces w
  WHERE w.id = NEW.workspace_id
    AND w.organization_id = NEW.organization_id
 )
BEGIN
  SELECT RAISE(ABORT, 'Privacy consent workspace crosses organization boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_privacy_request_scope_insert
BEFORE INSERT ON privacy_requests
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1 FROM workspaces w
  WHERE w.id = NEW.workspace_id
    AND w.organization_id = NEW.organization_id
 )
BEGIN
  SELECT RAISE(ABORT, 'Privacy request workspace crosses organization boundary');
END;
