-- Durable backlink-gap evidence from observed external referring-domain intersections.
CREATE TABLE seo_competitive_link_gaps (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  competitor_id TEXT REFERENCES seo_competitors(id) ON DELETE SET NULL,
  entity_id TEXT,
  competitor_domain TEXT NOT NULL,
  referring_domain TEXT NOT NULL,
  competitor_backlinks INTEGER,
  competitor_domain_rank REAL,
  observed_at TEXT NOT NULL,
  provenance_json TEXT NOT NULL
);

CREATE INDEX idx_seo_competitive_link_gaps_entity
  ON seo_competitive_link_gaps(organization_id, workspace_id, entity_id, observed_at DESC);

CREATE INDEX idx_seo_competitive_link_gaps_referrer
  ON seo_competitive_link_gaps(organization_id, workspace_id, referring_domain, observed_at DESC);

CREATE TRIGGER trg_seo_competitive_link_gap_workspace_scope
BEFORE INSERT ON seo_competitive_link_gaps
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id=NEW.workspace_id AND w.organization_id=NEW.organization_id)
BEGIN SELECT RAISE(ABORT,'SEO competitive link gap workspace crosses organization boundary'); END;
