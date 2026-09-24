-- Advertising core: tenant-scoped campaigns, immutable versions, budgets and idempotent sponsored delivery measurement.
CREATE TABLE advertising_accounts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  currency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','suspended','closed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE advertising_campaigns (
  id TEXT PRIMARY KEY,
  advertising_account_id TEXT NOT NULL REFERENCES advertising_accounts(id) ON DELETE RESTRICT,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  objective TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','reviewing','active','paused','completed','rejected')),
  current_version_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_advertising_campaigns_status ON advertising_campaigns(organization_id, workspace_id, status);

CREATE TABLE advertising_campaign_versions (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES advertising_campaigns(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version >= 1),
  targeting_rules_json TEXT NOT NULL,
  placement_rules_json TEXT NOT NULL,
  pacing_policy_json TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft','active','retired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (campaign_id, version)
);

CREATE TABLE advertising_ads (
  id TEXT PRIMARY KEY,
  campaign_version_id TEXT NOT NULL REFERENCES advertising_campaign_versions(id) ON DELETE RESTRICT,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  creative_reference TEXT NOT NULL,
  moderation_status TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','reviewing','approved','active','paused','expired','rejected')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE advertising_budgets (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES advertising_campaigns(id) ON DELETE RESTRICT,
  total_limit_minor INTEGER CHECK (total_limit_minor IS NULL OR total_limit_minor >= 0),
  daily_limit_minor INTEGER CHECK (daily_limit_minor IS NULL OR daily_limit_minor >= 0),
  currency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','paused','exhausted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_advertising_budgets_campaign ON advertising_budgets(campaign_id, status);

CREATE TABLE advertising_delivery_decisions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  ad_id TEXT NOT NULL REFERENCES advertising_ads(id) ON DELETE RESTRICT,
  placement_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('served','rejected')),
  reason TEXT,
  policy_version TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  deduplication_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (organization_id, workspace_id, deduplication_key)
);

CREATE TABLE advertising_impressions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  delivery_decision_id TEXT NOT NULL REFERENCES advertising_delivery_decisions(id) ON DELETE RESTRICT,
  context_reference TEXT,
  deduplication_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (organization_id, workspace_id, deduplication_key)
);

CREATE TABLE advertising_clicks (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  impression_id TEXT NOT NULL REFERENCES advertising_impressions(id) ON DELETE RESTRICT,
  deduplication_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (organization_id, workspace_id, deduplication_key)
);

CREATE TRIGGER trg_advertising_account_workspace_scope
BEFORE INSERT ON advertising_accounts
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM workspaces w WHERE w.id=NEW.workspace_id AND w.organization_id=NEW.organization_id
)
BEGIN SELECT RAISE(ABORT,'Advertising account workspace crosses organization boundary'); END;

CREATE TRIGGER trg_advertising_campaign_workspace_scope
BEFORE INSERT ON advertising_campaigns
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM advertising_accounts a
  WHERE a.id=NEW.advertising_account_id AND a.organization_id=NEW.organization_id AND a.workspace_id=NEW.workspace_id
)
BEGIN SELECT RAISE(ABORT,'Advertising campaign crosses account workspace scope'); END;

CREATE TRIGGER trg_advertising_ad_campaign_scope
BEFORE INSERT ON advertising_ads
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM advertising_campaign_versions cv
  INNER JOIN advertising_campaigns c ON c.id=cv.campaign_id
  WHERE cv.id=NEW.campaign_version_id
)
BEGIN SELECT RAISE(ABORT,'Advertising ad requires a valid campaign version'); END;

CREATE TRIGGER trg_advertising_delivery_workspace_scope
BEFORE INSERT ON advertising_delivery_decisions
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM advertising_ads a
  INNER JOIN advertising_campaign_versions cv ON cv.id=a.campaign_version_id
  INNER JOIN advertising_campaigns c ON c.id=cv.campaign_id
  WHERE a.id=NEW.ad_id AND c.organization_id=NEW.organization_id AND c.workspace_id=NEW.workspace_id
)
BEGIN SELECT RAISE(ABORT,'Advertising delivery crosses workspace scope'); END;

CREATE TRIGGER trg_advertising_impression_workspace_scope
BEFORE INSERT ON advertising_impressions
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM advertising_delivery_decisions d
  WHERE d.id=NEW.delivery_decision_id AND d.organization_id=NEW.organization_id AND d.workspace_id=NEW.workspace_id
)
BEGIN SELECT RAISE(ABORT,'Advertising impression crosses delivery workspace scope'); END;

CREATE TRIGGER trg_advertising_click_workspace_scope
BEFORE INSERT ON advertising_clicks
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM advertising_impressions i
  WHERE i.id=NEW.impression_id AND i.organization_id=NEW.organization_id AND i.workspace_id=NEW.workspace_id
)
BEGIN SELECT RAISE(ABORT,'Advertising click crosses impression workspace scope'); END;
