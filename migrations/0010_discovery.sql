CREATE TABLE search_documents (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  document_version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  body TEXT,
  metadata_json TEXT,
  eligibility TEXT NOT NULL CHECK (eligibility IN ('eligible','ineligible')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(source_type, source_id)
);

CREATE TABLE embedding_records (
  id TEXT PRIMARY KEY,
  search_document_id TEXT NOT NULL REFERENCES search_documents(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  dimensions INTEGER NOT NULL CHECK (dimensions > 0),
  vector_ref TEXT NOT NULL,
  document_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(search_document_id, model_id, document_version)
);

CREATE TABLE ranking_features (
  search_document_id TEXT PRIMARY KEY REFERENCES search_documents(id) ON DELETE CASCADE,
  features_json TEXT NOT NULL,
  document_version INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE indexing_jobs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','processing','succeeded','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_search_documents_scope_eligibility ON search_documents(organization_id, workspace_id, eligibility);
CREATE INDEX idx_search_documents_source ON search_documents(source_type, source_id);
CREATE INDEX idx_embedding_documents ON embedding_records(search_document_id, document_version);
CREATE INDEX idx_indexing_jobs_status_available ON indexing_jobs(status, available_at);
