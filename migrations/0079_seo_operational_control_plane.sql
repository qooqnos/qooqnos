-- Complete the operational SEO/GEO control plane: publication jobs, query intelligence and experiments.
CREATE TABLE seo_publication_jobs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  locale TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','processing','succeeded','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TEXT NOT NULL,
  locked_at TEXT,
  last_error TEXT,
  source_event_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, workspace_id, entity_id, entity_type, locale, reason, source_event_id)
);

CREATE INDEX idx_seo_publication_jobs_ready ON seo_publication_jobs(status, available_at, created_at);

CREATE TABLE seo_queries (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  query_text TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  locale TEXT NOT NULL,
  intent TEXT NOT NULL,
  location_id TEXT,
  entity_id TEXT,
  entity_type TEXT,
  lifecycle_state TEXT NOT NULL CHECK (lifecycle_state IN ('active','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, workspace_id, normalized_query, locale, intent, location_id, entity_id)
);

CREATE INDEX idx_seo_queries_lookup ON seo_queries(organization_id, workspace_id, locale, intent, normalized_query);

CREATE TABLE seo_experiments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  target_population TEXT NOT NULL,
  control_definition_json TEXT NOT NULL,
  variant_definition_json TEXT NOT NULL,
  success_metric TEXT NOT NULL,
  guardrails_json TEXT NOT NULL,
  observation_window_start TEXT NOT NULL,
  observation_window_end TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','running','stopped','completed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_seo_experiments_status ON seo_experiments(organization_id, workspace_id, status, observation_window_start);

CREATE TABLE seo_experiment_assignments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  experiment_id TEXT NOT NULL REFERENCES seo_experiments(id) ON DELETE CASCADE,
  subject_key TEXT NOT NULL,
  arm TEXT NOT NULL CHECK (arm IN ('control','variant')),
  assigned_at TEXT NOT NULL,
  UNIQUE (experiment_id, subject_key)
);

CREATE INDEX idx_seo_experiment_assignments_subject ON seo_experiment_assignments(organization_id, workspace_id, subject_key);

CREATE TRIGGER trg_seo_publication_job_workspace_scope
BEFORE INSERT ON seo_publication_jobs
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id=NEW.workspace_id AND w.organization_id=NEW.organization_id)
BEGIN SELECT RAISE(ABORT,'SEO publication job workspace crosses organization boundary'); END;

CREATE TRIGGER trg_seo_query_workspace_scope
BEFORE INSERT ON seo_queries
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id=NEW.workspace_id AND w.organization_id=NEW.organization_id)
BEGIN SELECT RAISE(ABORT,'SEO query workspace crosses organization boundary'); END;

CREATE TRIGGER trg_seo_experiment_workspace_scope
BEFORE INSERT ON seo_experiments
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id=NEW.workspace_id AND w.organization_id=NEW.organization_id)
BEGIN SELECT RAISE(ABORT,'SEO experiment workspace crosses organization boundary'); END;

CREATE TRIGGER trg_seo_assignment_workspace_scope
BEFORE INSERT ON seo_experiment_assignments
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id=NEW.workspace_id AND w.organization_id=NEW.organization_id)
BEGIN SELECT RAISE(ABORT,'SEO experiment assignment workspace crosses organization boundary'); END;
