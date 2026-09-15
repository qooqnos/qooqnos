CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  storage_provider TEXT NOT NULL CHECK (storage_provider IN ('r2')),
  storage_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  checksum TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','ready','failed','deleted')),
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE media_variants (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  variant_key TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  width INTEGER,
  height INTEGER,
  checksum TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','ready','failed','deleted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(asset_id, variant_key)
);

CREATE TABLE media_processing_jobs (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  operation_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('queued','processing','succeeded','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  input_json TEXT,
  output_json TEXT,
  error_code TEXT,
  available_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE media_links (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  purpose TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at TEXT NOT NULL,
  UNIQUE(asset_id, owner_type, owner_id, purpose)
);

CREATE INDEX idx_media_assets_scope ON media_assets(organization_id, workspace_id, status);
CREATE INDEX idx_media_assets_owner ON media_assets(owner_type, owner_id);
CREATE INDEX idx_media_variants_asset ON media_variants(asset_id, status);
CREATE INDEX idx_media_jobs_status_available ON media_processing_jobs(status, available_at);
CREATE INDEX idx_media_links_owner ON media_links(owner_type, owner_id, purpose, position);
