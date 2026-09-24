-- Durable competitive-intelligence snapshots from observed external SERPs.
CREATE TABLE seo_competitors (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  domain TEXT NOT NULL,
  display_name TEXT,
  competitor_type TEXT NOT NULL CHECK (competitor_type IN ('direct','alternative','publisher','directory','discovered')),
  lifecycle_state TEXT NOT NULL CHECK (lifecycle_state IN ('active','paused','archived')),
  first_observed_at TEXT NOT NULL,
  last_observed_at TEXT NOT NULL,
  provenance_json TEXT NOT NULL,
  UNIQUE (organization_id, workspace_id, domain)
);

CREATE INDEX idx_seo_competitors_scope
  ON seo_competitors(organization_id, workspace_id, lifecycle_state, last_observed_at DESC);

CREATE TABLE seo_competitive_runs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  provider_id TEXT NOT NULL,
  query_id TEXT,
  query_text TEXT NOT NULL,
  locale TEXT NOT NULL,
  location_context TEXT,
  device TEXT,
  depth INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('running','succeeded','partial','failed')),
  result_count INTEGER NOT NULL DEFAULT 0,
  error_text TEXT,
  provenance_json TEXT NOT NULL
);

CREATE INDEX idx_seo_competitive_runs_scope
  ON seo_competitive_runs(organization_id, workspace_id, started_at DESC);

CREATE TABLE seo_competitive_observations (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES seo_competitive_runs(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  competitor_id TEXT REFERENCES seo_competitors(id) ON DELETE SET NULL,
  entity_id TEXT,
  query_text TEXT NOT NULL,
  result_type TEXT NOT NULL,
  domain TEXT NOT NULL,
  result_url TEXT NOT NULL,
  title TEXT,
  snippet TEXT,
  rank_group INTEGER,
  rank_absolute INTEGER,
  ai_citation INTEGER NOT NULL DEFAULT 0,
  observed_at TEXT NOT NULL,
  provenance_json TEXT NOT NULL
);

CREATE INDEX idx_seo_competitive_observations_query
  ON seo_competitive_observations(organization_id, workspace_id, query_text, observed_at DESC);

CREATE INDEX idx_seo_competitive_observations_domain
  ON seo_competitive_observations(organization_id, workspace_id, domain, observed_at DESC);

CREATE TABLE seo_competitive_changes (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  competitor_id TEXT,
  query_text TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('new-entry','lost-entry','rank-up','rank-down','url-changed','ai-citation-gained','ai-citation-lost')),
  previous_rank INTEGER,
  current_rank INTEGER,
  previous_url TEXT,
  current_url TEXT,
  detected_at TEXT NOT NULL,
  provenance_json TEXT NOT NULL
);

CREATE INDEX idx_seo_competitive_changes_scope
  ON seo_competitive_changes(organization_id, workspace_id, detected_at DESC);

CREATE TRIGGER trg_seo_competitor_workspace_scope
BEFORE INSERT ON seo_competitors
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id=NEW.workspace_id AND w.organization_id=NEW.organization_id)
BEGIN SELECT RAISE(ABORT,'SEO competitor workspace crosses organization boundary'); END;

CREATE TRIGGER trg_seo_competitive_run_workspace_scope
BEFORE INSERT ON seo_competitive_runs
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id=NEW.workspace_id AND w.organization_id=NEW.organization_id)
BEGIN SELECT RAISE(ABORT,'SEO competitive run workspace crosses organization boundary'); END;

CREATE TRIGGER trg_seo_competitive_observation_workspace_scope
BEFORE INSERT ON seo_competitive_observations
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id=NEW.workspace_id AND w.organization_id=NEW.organization_id)
BEGIN SELECT RAISE(ABORT,'SEO competitive observation workspace crosses organization boundary'); END;

CREATE TRIGGER trg_seo_competitive_change_workspace_scope
BEFORE INSERT ON seo_competitive_changes
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id=NEW.workspace_id AND w.organization_id=NEW.organization_id)
BEGIN SELECT RAISE(ABORT,'SEO competitive change workspace crosses organization boundary'); END;
