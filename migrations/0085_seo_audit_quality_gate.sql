-- Persist deterministic SEO audit gate state for operational dashboards and publication history.
ALTER TABLE seo_audits ADD COLUMN overall_score REAL NOT NULL DEFAULT 0;
ALTER TABLE seo_audits ADD COLUMN status TEXT NOT NULL DEFAULT 'warning';
ALTER TABLE seo_audits ADD COLUMN blocking_issue_codes_json TEXT NOT NULL DEFAULT '[]';

CREATE INDEX idx_seo_audits_status
  ON seo_audits(organization_id, workspace_id, status, generated_at DESC);
