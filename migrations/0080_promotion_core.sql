-- Promotion & Campaign core: versioned policy, deterministic qualification and idempotent redemption.
CREATE TABLE promotions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  business_id TEXT REFERENCES businesses(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  promotion_type TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('platform','organization','workspace','business','location','campaign')),
  status TEXT NOT NULL CHECK (status IN ('draft','scheduled','active','paused','expired','retired')),
  current_version_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_promotions_scope_status ON promotions(organization_id, workspace_id, scope, status);

CREATE TABLE promotion_versions (
  id TEXT PRIMARY KEY,
  promotion_id TEXT NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version >= 1),
  benefit_json TEXT NOT NULL,
  eligibility_rules_json TEXT NOT NULL,
  stack_policy_json TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft','scheduled','active','retired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (promotion_id, version)
);

CREATE INDEX idx_promotion_versions_active ON promotion_versions(promotion_id, status, effective_from);

CREATE TABLE promotion_qualifications (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  promotion_id TEXT NOT NULL REFERENCES promotions(id) ON DELETE RESTRICT,
  promotion_version_id TEXT NOT NULL REFERENCES promotion_versions(id) ON DELETE RESTRICT,
  subject_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('qualified','rejected')),
  reasons_json TEXT NOT NULL,
  benefit_json TEXT,
  idempotency_key TEXT NOT NULL,
  evaluated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (organization_id, workspace_id, idempotency_key)
);

CREATE INDEX idx_promotion_qualifications_subject ON promotion_qualifications(organization_id, workspace_id, subject_id, promotion_id, evaluated_at);

CREATE TABLE promotion_redemptions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  promotion_id TEXT NOT NULL REFERENCES promotions(id) ON DELETE RESTRICT,
  promotion_version_id TEXT NOT NULL REFERENCES promotion_versions(id) ON DELETE RESTRICT,
  qualification_id TEXT NOT NULL REFERENCES promotion_qualifications(id) ON DELETE RESTRICT,
  subject_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  benefit_reference TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('redeemed','revoked')),
  idempotency_key TEXT NOT NULL,
  redeemed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (organization_id, workspace_id, idempotency_key)
);

CREATE INDEX idx_promotion_redemptions_subject ON promotion_redemptions(organization_id, workspace_id, subject_id, promotion_id, status);

CREATE TRIGGER trg_promotions_workspace_scope
BEFORE INSERT ON promotions
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM workspaces w
  WHERE w.id=NEW.workspace_id AND w.organization_id=NEW.organization_id
)
BEGIN SELECT RAISE(ABORT,'Promotion workspace crosses organization boundary'); END;

CREATE TRIGGER trg_promotion_version_workspace_scope
BEFORE INSERT ON promotion_versions
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM promotions p
  WHERE p.id=NEW.promotion_id
)
BEGIN SELECT RAISE(ABORT,'Promotion version requires a valid promotion'); END;

CREATE TRIGGER trg_promotion_qualification_workspace_scope
BEFORE INSERT ON promotion_qualifications
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM promotions p
  WHERE p.id=NEW.promotion_id
    AND p.organization_id=NEW.organization_id
    AND p.workspace_id=NEW.workspace_id
)
BEGIN SELECT RAISE(ABORT,'Promotion qualification crosses workspace scope'); END;

CREATE TRIGGER trg_promotion_redemption_workspace_scope
BEFORE INSERT ON promotion_redemptions
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM promotions p
  WHERE p.id=NEW.promotion_id
    AND p.organization_id=NEW.organization_id
    AND p.workspace_id=NEW.workspace_id
)
BEGIN SELECT RAISE(ABORT,'Promotion redemption crosses workspace scope'); END;
