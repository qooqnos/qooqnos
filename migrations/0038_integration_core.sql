-- Establish the canonical external Integration boundary.
CREATE TABLE integration_providers (
  id TEXT PRIMARY KEY,
  provider_key TEXT NOT NULL UNIQUE,
  provider_name TEXT NOT NULL,
  adapter_version TEXT NOT NULL,
  capabilities_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','inactive','retired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE integration_accounts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  provider_id TEXT NOT NULL REFERENCES integration_providers(id) ON DELETE RESTRICT,
  account_type TEXT NOT NULL,
  external_account_reference TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','connected','degraded','disconnected','revoked')),
  credential_reference TEXT,
  metadata_json TEXT,
  connected_at TEXT,
  disconnected_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider_id, external_account_reference)
);

CREATE INDEX idx_integration_accounts_scope_status
  ON integration_accounts(organization_id, workspace_id, status);

CREATE TABLE integration_webhooks (
  id TEXT PRIMARY KEY,
  integration_account_id TEXT NOT NULL REFERENCES integration_accounts(id) ON DELETE RESTRICT,
  external_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  signature_status TEXT NOT NULL CHECK (signature_status IN ('verified','invalid','missing','not_required')),
  received_at TEXT NOT NULL,
  payload_reference TEXT,
  processing_status TEXT NOT NULL CHECK (processing_status IN ('received','queued','processing','processed','failed','ignored')),
  processed_at TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  last_error_reference TEXT,
  correlation_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(integration_account_id, external_event_id)
);

CREATE INDEX idx_integration_webhooks_processing
  ON integration_webhooks(processing_status, received_at);

CREATE TABLE integration_sync_jobs (
  id TEXT PRIMARY KEY,
  integration_account_id TEXT NOT NULL REFERENCES integration_accounts(id) ON DELETE RESTRICT,
  sync_type TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound','bidirectional')),
  status TEXT NOT NULL CHECK (status IN ('queued','running','paused','completed','failed','cancelled')),
  cursor_reference TEXT,
  checkpoint_reference TEXT,
  item_count INTEGER NOT NULL DEFAULT 0 CHECK (item_count >= 0),
  error_count INTEGER NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  started_at TEXT,
  completed_at TEXT,
  next_run_at TEXT,
  correlation_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_integration_sync_jobs_next
  ON integration_sync_jobs(status, next_run_at);

CREATE TABLE integration_external_references (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  integration_account_id TEXT REFERENCES integration_accounts(id) ON DELETE RESTRICT,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  external_type TEXT NOT NULL,
  external_reference TEXT NOT NULL,
  status TEXT,
  metadata_json TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(integration_account_id, external_type, external_reference)
);

CREATE INDEX idx_integration_external_refs_resource
  ON integration_external_references(resource_type, resource_id);

CREATE TRIGGER IF NOT EXISTS trg_integration_account_scope
BEFORE INSERT ON integration_accounts
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM workspaces w
   WHERE w.id = NEW.workspace_id
     AND w.organization_id = NEW.organization_id
 )
BEGIN
  SELECT RAISE(ABORT, 'Integration account workspace crosses organization boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_integration_external_scope
BEFORE INSERT ON integration_external_references
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM organizations o WHERE o.id = NEW.organization_id
)
BEGIN
  SELECT RAISE(ABORT, 'Integration external reference organization is invalid');
END;
