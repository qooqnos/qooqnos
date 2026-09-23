-- Establish the canonical generic ModerationCase workflow boundary.
CREATE TABLE moderation_cases (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open','reviewing','decided','actioned','closed','escalated')),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low','medium','high','critical')),
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  UNIQUE(organization_id, subject_type, subject_id, policy_id, policy_version, created_at)
);

CREATE INDEX idx_moderation_cases_scope_status
  ON moderation_cases(organization_id, workspace_id, status, created_at DESC);

CREATE INDEX idx_moderation_cases_subject
  ON moderation_cases(organization_id, subject_type, subject_id, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_moderation_case_workspace_scope
BEFORE INSERT ON moderation_cases
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1
   FROM workspaces w
   WHERE w.id = NEW.workspace_id
     AND w.organization_id = NEW.organization_id
 )
BEGIN
  SELECT RAISE(ABORT, 'Moderation case workspace crosses organization boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_moderation_case_update_scope
BEFORE UPDATE OF organization_id, workspace_id, subject_type, subject_id, source_type, source_id, policy_id, policy_version ON moderation_cases
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1
   FROM workspaces w
   WHERE w.id = NEW.workspace_id
     AND w.organization_id = NEW.organization_id
 )
BEGIN
  SELECT RAISE(ABORT, 'Moderation case workspace crosses organization boundary');
END;
