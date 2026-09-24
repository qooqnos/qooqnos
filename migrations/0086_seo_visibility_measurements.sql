-- Durable execution state for real search-engine / AI citation measurements.
CREATE TABLE seo_measurement_runs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  provider_id TEXT NOT NULL,
  surface TEXT NOT NULL,
  query_id TEXT,
  query_text TEXT NOT NULL,
  locale TEXT NOT NULL,
  entity_id TEXT,
  entity_type TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('running','succeeded','partial','failed')),
  observation_count INTEGER NOT NULL DEFAULT 0,
  error_text TEXT,
  provenance_json TEXT NOT NULL
);

CREATE INDEX idx_seo_measurement_runs_scope
  ON seo_measurement_runs(organization_id, workspace_id, started_at DESC);

CREATE INDEX idx_seo_measurement_runs_query
  ON seo_measurement_runs(organization_id, workspace_id, query_text, locale, started_at DESC);

CREATE TABLE seo_measurement_citations (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES seo_measurement_runs(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  entity_id TEXT,
  citation_url TEXT NOT NULL,
  citation_title TEXT,
  citation_position INTEGER,
  citation_count INTEGER NOT NULL DEFAULT 1,
  source_type TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  provenance_json TEXT NOT NULL
);

CREATE INDEX idx_seo_measurement_citations_run
  ON seo_measurement_citations(organization_id, workspace_id, run_id);

CREATE INDEX idx_seo_measurement_citations_entity
  ON seo_measurement_citations(organization_id, workspace_id, entity_id, observed_at DESC);

CREATE TRIGGER trg_seo_measurement_run_workspace_scope
BEFORE INSERT ON seo_measurement_runs
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id=NEW.workspace_id AND w.organization_id=NEW.organization_id)
BEGIN SELECT RAISE(ABORT,'SEO measurement run workspace crosses organization boundary'); END;

CREATE TRIGGER trg_seo_measurement_citation_workspace_scope
BEFORE INSERT ON seo_measurement_citations
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id=NEW.workspace_id AND w.organization_id=NEW.organization_id)
BEGIN SELECT RAISE(ABORT,'SEO measurement citation workspace crosses organization boundary'); END;
