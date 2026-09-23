-- Establish the canonical versioned Communication template registry.
CREATE TABLE communication_templates (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  workspace_id TEXT,
  template_key TEXT NOT NULL,
  intent TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','whatsapp','sms','email')),
  owner_reference TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','active','retired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id, workspace_id, template_key, channel)
);

CREATE INDEX idx_communication_templates_scope_status
  ON communication_templates(organization_id, workspace_id, status);

CREATE TABLE communication_template_versions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES communication_templates(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version >= 1),
  locale TEXT NOT NULL,
  variables_schema_json TEXT NOT NULL,
  content_reference TEXT NOT NULL,
  content_checksum TEXT NOT NULL,
  approval_state TEXT NOT NULL CHECK (approval_state IN ('not_required','pending','approved','rejected','expired')),
  effective_from TEXT,
  effective_to TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(template_id, version, locale),
  CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from)
);

CREATE INDEX idx_communication_template_versions_lookup
  ON communication_template_versions(template_id, locale, version DESC, approval_state);

CREATE TRIGGER IF NOT EXISTS trg_communication_template_scope_insert
BEFORE INSERT ON communication_templates
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM workspaces w
   WHERE w.id = NEW.workspace_id
     AND (NEW.organization_id IS NULL OR w.organization_id = NEW.organization_id)
 )
BEGIN
  SELECT RAISE(ABORT, 'Communication template workspace crosses organization boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_communication_template_scope_update
BEFORE UPDATE OF organization_id, workspace_id ON communication_templates
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM workspaces w
   WHERE w.id = NEW.workspace_id
     AND (NEW.organization_id IS NULL OR w.organization_id = NEW.organization_id)
 )
BEGIN
  SELECT RAISE(ABORT, 'Communication template workspace crosses organization boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_communication_template_version_update_immutable
BEFORE UPDATE OF template_id, version, locale, variables_schema_json, content_reference, content_checksum, approval_state, effective_from, effective_to, created_by ON communication_template_versions
FOR EACH ROW
WHEN OLD.approval_state = 'approved'
BEGIN
  SELECT RAISE(ABORT, 'Approved Communication template versions are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_communication_template_version_delete_immutable
BEFORE DELETE ON communication_template_versions
FOR EACH ROW
WHEN OLD.approval_state = 'approved'
BEGIN
  SELECT RAISE(ABORT, 'Approved Communication template versions are immutable');
END;
