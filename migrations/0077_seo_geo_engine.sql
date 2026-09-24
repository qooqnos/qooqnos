-- Establish tenant-scoped, derived SEO/GEO representations and observability.
CREATE TABLE seo_entity_representations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  locale TEXT NOT NULL,
  source_module TEXT NOT NULL,
  source_version TEXT NOT NULL,
  publication_state TEXT NOT NULL,
  visibility TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  indexability TEXT NOT NULL CHECK (indexability IN ('index','noindex','restricted','excluded')),
  representation_json TEXT NOT NULL,
  source_updated_at TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  UNIQUE (organization_id, workspace_id, entity_id, entity_type, locale)
);

CREATE INDEX idx_seo_entity_representations_entity
  ON seo_entity_representations(organization_id, workspace_id, entity_id, locale);

CREATE TABLE seo_artifacts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  representation_id TEXT NOT NULL REFERENCES seo_entity_representations(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('metadata','structured-data','answer','sitemap','robots','internal-links')),
  artifact_version INTEGER NOT NULL CHECK (artifact_version >= 1),
  payload_json TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  UNIQUE (representation_id, artifact_type, artifact_version)
);

CREATE TABLE seo_dependencies (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT,
  representation_id TEXT NOT NULL REFERENCES seo_entity_representations(id) ON DELETE CASCADE,
  dependency_entity_id TEXT NOT NULL,
  dependency_entity_type TEXT NOT NULL,
  dependency_version TEXT NOT NULL,
  PRIMARY KEY (representation_id, dependency_entity_id, dependency_entity_type)
);

CREATE TABLE seo_audits (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  scores_json TEXT NOT NULL,
  issues_json TEXT NOT NULL
);

CREATE INDEX idx_seo_audits_entity
  ON seo_audits(organization_id, workspace_id, entity_id, generated_at DESC);

CREATE TABLE seo_measurements (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  observed_at TEXT NOT NULL,
  surface TEXT NOT NULL,
  metric TEXT NOT NULL,
  entity_id TEXT,
  query_class TEXT,
  value_numeric REAL,
  value_text TEXT,
  provenance_json TEXT NOT NULL
);

CREATE INDEX idx_seo_measurements_scope
  ON seo_measurements(organization_id, workspace_id, surface, metric, observed_at DESC);

CREATE TRIGGER trg_seo_representation_workspace_scope
BEFORE INSERT ON seo_entity_representations
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id=NEW.workspace_id AND w.organization_id=NEW.organization_id)
BEGIN SELECT RAISE(ABORT,'SEO representation workspace crosses organization boundary'); END;

CREATE TRIGGER trg_seo_artifact_workspace_scope
BEFORE INSERT ON seo_artifacts
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id=NEW.workspace_id AND w.organization_id=NEW.organization_id)
BEGIN SELECT RAISE(ABORT,'SEO artifact workspace crosses organization boundary'); END;