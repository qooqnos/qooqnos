-- Establish tenant/workspace-scoped, non-authoritative AI memory.
CREATE TABLE ai_memory (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  owner_scope TEXT NOT NULL CHECK (owner_scope IN ('user','workspace')),
  owner_reference TEXT NOT NULL,
  memory_type TEXT NOT NULL,
  content_reference TEXT NOT NULL,
  provenance_json TEXT NOT NULL,
  consent_reference TEXT,
  classification TEXT NOT NULL CHECK (classification IN ('public','internal','confidential','sensitive','restricted')),
  version INTEGER NOT NULL CHECK (version >= 1),
  created_at TEXT NOT NULL,
  expires_at TEXT,
  deleted_at TEXT
);

CREATE INDEX idx_ai_memory_owner
  ON ai_memory(organization_id, workspace_id, owner_scope, owner_reference, memory_type, created_at DESC);

CREATE INDEX idx_ai_memory_expiry
  ON ai_memory(organization_id, expires_at)
  WHERE deleted_at IS NULL AND expires_at IS NOT NULL;

CREATE TRIGGER trg_ai_memory_workspace_scope_insert
BEFORE INSERT ON ai_memory
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM workspaces w
   WHERE w.id = NEW.workspace_id
     AND w.organization_id = NEW.organization_id
 )
BEGIN
  SELECT RAISE(ABORT, 'AI memory workspace crosses organization boundary');
END;

CREATE TRIGGER trg_ai_memory_owner_scope
BEFORE INSERT ON ai_memory
FOR EACH ROW
WHEN NEW.owner_scope = 'workspace'
 AND NEW.workspace_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Workspace AI memory requires workspace scope');
END;

CREATE TRIGGER trg_ai_memory_expiry
BEFORE INSERT ON ai_memory
FOR EACH ROW
WHEN NEW.expires_at IS NOT NULL AND NEW.expires_at <= NEW.created_at
BEGIN
  SELECT RAISE(ABORT, 'AI memory expiry must be after creation');
END;
