-- Durable keyword-gap evidence from observed DataForSEO Labs domain intersection results.
CREATE TABLE seo_competitive_keyword_gaps (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  competitor_id TEXT REFERENCES seo_competitors(id) ON DELETE SET NULL,
  entity_id TEXT,
  competitor_domain TEXT NOT NULL,
  query_text TEXT NOT NULL,
  keyword TEXT NOT NULL,
  search_volume INTEGER,
  cpc REAL,
  competitor_rank INTEGER,
  phoenix_rank INTEGER,
  location_code INTEGER,
  language_code TEXT,
  gap_type TEXT NOT NULL CHECK (gap_type IN ('competitor-only','shared')),
  observed_at TEXT NOT NULL,
  provenance_json TEXT NOT NULL
);

CREATE INDEX idx_seo_competitive_keyword_gaps_entity
  ON seo_competitive_keyword_gaps(organization_id, workspace_id, entity_id, observed_at DESC);

CREATE INDEX idx_seo_competitive_keyword_gaps_keyword
  ON seo_competitive_keyword_gaps(organization_id, workspace_id, keyword, observed_at DESC);

CREATE TRIGGER trg_seo_competitive_keyword_gap_workspace_scope
BEFORE INSERT ON seo_competitive_keyword_gaps
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id=NEW.workspace_id AND w.organization_id=NEW.organization_id)
BEGIN SELECT RAISE(ABORT,'SEO competitive keyword gap workspace crosses organization boundary'); END;
