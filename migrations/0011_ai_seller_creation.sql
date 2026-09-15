CREATE TABLE seller_ai_creation_sessions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('initiated','analyzing','draft_ready','needs_seller_input','seller_review','confirmed','validating','catalog_saved','publication_pending','published','failed','cancelled','expired','blocked_by_policy','blocked_by_entitlement','blocked_by_missing_required_data')),
  current_draft_version INTEGER NOT NULL DEFAULT 0 CHECK (current_draft_version >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE seller_ai_inputs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES seller_ai_creation_sessions(id) ON DELETE CASCADE,
  media_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  raw_text TEXT,
  input_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (media_asset_id IS NOT NULL OR raw_text IS NOT NULL)
);

CREATE TABLE seller_ai_drafts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES seller_ai_creation_sessions(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL CHECK (status IN ('draft','seller_review','confirmed','superseded','rejected')),
  draft_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(session_id, version)
);

CREATE TABLE seller_ai_field_provenance (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES seller_ai_drafts(id) ON DELETE CASCADE,
  field_path TEXT NOT NULL,
  provenance TEXT NOT NULL CHECK (provenance IN ('seller_input','seller_confirmed','ai_extracted','ai_generated','system_derived','external_verified','policy_validated')),
  confidence TEXT NOT NULL CHECK (confidence IN ('confirmed','high_confidence','needs_review','unknown','conflicting','rejected')),
  source_refs_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(draft_id, field_path)
);

CREATE INDEX idx_seller_ai_sessions_scope_status ON seller_ai_creation_sessions(organization_id, workspace_id, status);
CREATE INDEX idx_seller_ai_inputs_session ON seller_ai_inputs(session_id, created_at);
CREATE INDEX idx_seller_ai_drafts_session_version ON seller_ai_drafts(session_id, version);
CREATE INDEX idx_seller_ai_provenance_draft ON seller_ai_field_provenance(draft_id, field_path);
