-- Loyalty core: versioned programs, append-only points ledger and idempotent reward redemption.
CREATE TABLE loyalty_programs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  business_id TEXT REFERENCES businesses(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','active','paused','retired')),
  current_version_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_loyalty_programs_status ON loyalty_programs(organization_id, workspace_id, status);

CREATE TABLE loyalty_program_versions (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version >= 1),
  rules_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','active','retired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (program_id, version)
);

CREATE TABLE loyalty_memberships (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  program_id TEXT NOT NULL REFERENCES loyalty_programs(id) ON DELETE RESTRICT,
  customer_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('invited','active','suspended','expired')),
  tier_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, workspace_id, program_id, customer_id)
);

CREATE INDEX idx_loyalty_memberships_customer ON loyalty_memberships(organization_id, workspace_id, customer_id);

CREATE TABLE loyalty_ledger_entries (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  membership_id TEXT NOT NULL REFERENCES loyalty_memberships(id) ON DELETE RESTRICT,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('earn','adjustment','expire','reverse','redeem')),
  points_delta INTEGER NOT NULL CHECK (points_delta <> 0),
  reference_type TEXT,
  reference_id TEXT,
  idempotency_key TEXT NOT NULL,
  provenance_json TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (organization_id, workspace_id, idempotency_key)
);

CREATE INDEX idx_loyalty_ledger_membership ON loyalty_ledger_entries(organization_id, workspace_id, membership_id, created_at DESC);

CREATE TABLE loyalty_rewards (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  program_id TEXT NOT NULL REFERENCES loyalty_programs(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  points_cost INTEGER NOT NULL CHECK (points_cost > 0),
  reward_reference TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('defined','available','reserved','redeemed','expired','revoked')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_loyalty_rewards_program_status ON loyalty_rewards(organization_id, workspace_id, program_id, status);

CREATE TABLE loyalty_reward_redemptions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  reward_id TEXT NOT NULL REFERENCES loyalty_rewards(id) ON DELETE RESTRICT,
  membership_id TEXT NOT NULL REFERENCES loyalty_memberships(id) ON DELETE RESTRICT,
  ledger_entry_id TEXT NOT NULL REFERENCES loyalty_ledger_entries(id) ON DELETE RESTRICT,
  points_cost INTEGER NOT NULL CHECK (points_cost > 0),
  benefit_reference TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (organization_id, workspace_id, idempotency_key)
);

CREATE TRIGGER trg_loyalty_program_workspace_scope
BEFORE INSERT ON loyalty_programs
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM workspaces w WHERE w.id=NEW.workspace_id AND w.organization_id=NEW.organization_id
)
BEGIN SELECT RAISE(ABORT,'Loyalty program workspace crosses organization boundary'); END;

CREATE TRIGGER trg_loyalty_membership_workspace_scope
BEFORE INSERT ON loyalty_memberships
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM loyalty_programs p
  WHERE p.id=NEW.program_id AND p.organization_id=NEW.organization_id AND p.workspace_id=NEW.workspace_id
)
BEGIN SELECT RAISE(ABORT,'Loyalty membership crosses program workspace scope'); END;

CREATE TRIGGER trg_loyalty_ledger_workspace_scope
BEFORE INSERT ON loyalty_ledger_entries
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM loyalty_memberships m
  WHERE m.id=NEW.membership_id AND m.organization_id=NEW.organization_id AND m.workspace_id=NEW.workspace_id
)
BEGIN SELECT RAISE(ABORT,'Loyalty ledger entry crosses membership workspace scope'); END;

CREATE TRIGGER trg_loyalty_reward_workspace_scope
BEFORE INSERT ON loyalty_rewards
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM loyalty_programs p
  WHERE p.id=NEW.program_id AND p.organization_id=NEW.organization_id AND p.workspace_id=NEW.workspace_id
)
BEGIN SELECT RAISE(ABORT,'Loyalty reward crosses program workspace scope'); END;

CREATE TRIGGER trg_loyalty_redemption_workspace_scope
BEFORE INSERT ON loyalty_reward_redemptions
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM loyalty_memberships m
  WHERE m.id=NEW.membership_id AND m.organization_id=NEW.organization_id AND m.workspace_id=NEW.workspace_id
)
BEGIN SELECT RAISE(ABORT,'Loyalty redemption crosses membership workspace scope'); END;
