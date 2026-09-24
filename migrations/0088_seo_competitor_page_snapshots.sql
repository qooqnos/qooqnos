-- Durable on-page competitor snapshots from observed competitor URLs.
CREATE TABLE seo_competitor_page_snapshots (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  competitor_id TEXT REFERENCES seo_competitors(id) ON DELETE SET NULL,
  query_text TEXT,
  result_url TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  status_code INTEGER,
  title TEXT,
  description TEXT,
  canonical_url TEXT,
  h1_count INTEGER,
  word_count INTEGER,
  internal_links_count INTEGER,
  external_links_count INTEGER,
  images_count INTEGER,
  title_length INTEGER,
  description_length INTEGER,
  no_h1_tag INTEGER,
  no_title INTEGER,
  no_description INTEGER,
  seo_friendly_url INTEGER,
  structured_data_errors INTEGER,
  provenance_json TEXT NOT NULL
);

CREATE INDEX idx_seo_competitor_page_snapshots_domain
  ON seo_competitor_page_snapshots(organization_id, workspace_id, competitor_id, observed_at DESC);

CREATE INDEX idx_seo_competitor_page_snapshots_url
  ON seo_competitor_page_snapshots(organization_id, workspace_id, result_url, observed_at DESC);

CREATE TRIGGER trg_seo_competitor_page_snapshot_workspace_scope
BEFORE INSERT ON seo_competitor_page_snapshots
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id=NEW.workspace_id AND w.organization_id=NEW.organization_id)
BEGIN SELECT RAISE(ABORT,'SEO competitor page snapshot workspace crosses organization boundary'); END;
