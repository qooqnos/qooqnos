-- Establish the canonical Billing plan, subscription, entitlement, usage and provider-reference boundary.
CREATE TABLE billing_plans (
  id TEXT PRIMARY KEY,
  plan_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft','active','retired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE billing_prices (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES billing_plans(id) ON DELETE RESTRICT,
  currency TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('monthly','yearly','one_time')),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  tax_treatment_reference TEXT,
  provider_price_reference TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX idx_billing_prices_plan_effective
  ON billing_prices(plan_id, effective_from DESC);

CREATE TABLE billing_plan_entitlements (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES billing_plans(id) ON DELETE RESTRICT,
  entitlement_key TEXT NOT NULL,
  value_type TEXT NOT NULL CHECK (value_type IN ('integer','number','boolean','text','json')),
  value_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(plan_id, entitlement_key, version)
);

CREATE INDEX idx_billing_plan_entitlements_key
  ON billing_plan_entitlements(entitlement_key, plan_id, version DESC);

CREATE TABLE billing_subscriptions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  plan_id TEXT NOT NULL REFERENCES billing_plans(id) ON DELETE RESTRICT,
  billing_price_id TEXT NOT NULL REFERENCES billing_prices(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (
    status IN ('trialing','active','past_due','grace_period','suspended','cancelled','expired')
  ),
  starts_at TEXT NOT NULL,
  trial_ends_at TEXT,
  current_period_start TEXT NOT NULL,
  current_period_end TEXT,
  grace_until TEXT,
  cancelled_at TEXT,
  expires_at TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_billing_subscriptions_business_status
  ON billing_subscriptions(business_id, status, current_period_start DESC);

CREATE INDEX idx_billing_subscriptions_org_status
  ON billing_subscriptions(organization_id, status);

CREATE UNIQUE INDEX uq_billing_active_business_subscription
  ON billing_subscriptions(business_id)
  WHERE status IN ('trialing','active','past_due','grace_period','suspended');

CREATE TABLE billing_subscription_events (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES billing_subscriptions(id) ON DELETE RESTRICT,
  from_status TEXT,
  to_status TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  actor_reference TEXT,
  provider_event_reference TEXT,
  occurred_at TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(subscription_id, event_type, occurred_at, correlation_id)
);

CREATE INDEX idx_billing_subscription_events_subscription_time
  ON billing_subscription_events(subscription_id, occurred_at DESC, id DESC);

CREATE TABLE billing_usage_meters (
  id TEXT PRIMARY KEY,
  meter_key TEXT NOT NULL UNIQUE,
  unit TEXT NOT NULL,
  aggregation TEXT NOT NULL CHECK (aggregation IN ('sum','count','max','gauge')),
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly','rolling','lifetime')),
  hard_limit INTEGER,
  status TEXT NOT NULL CHECK (status IN ('active','retired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (hard_limit IS NULL OR hard_limit >= 0)
);

CREATE TABLE billing_usage_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  business_id TEXT REFERENCES businesses(id) ON DELETE RESTRICT,
  meter_id TEXT NOT NULL REFERENCES billing_usage_meters(id) ON DELETE RESTRICT,
  source_event_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  period_start TEXT,
  period_end TEXT,
  occurred_at TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(meter_id, source_event_id)
);

CREATE INDEX idx_billing_usage_events_scope_meter
  ON billing_usage_events(organization_id, workspace_id, meter_id, occurred_at DESC);

CREATE TABLE billing_entitlement_snapshots (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES billing_subscriptions(id) ON DELETE RESTRICT,
  entitlement_key TEXT NOT NULL,
  value_type TEXT NOT NULL CHECK (value_type IN ('integer','number','boolean','text','json')),
  value_json TEXT NOT NULL,
  source_plan_id TEXT NOT NULL REFERENCES billing_plans(id) ON DELETE RESTRICT,
  source_plan_version INTEGER NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  created_at TEXT NOT NULL,
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX idx_billing_entitlement_snapshots_subscription
  ON billing_entitlement_snapshots(subscription_id, entitlement_key, effective_from DESC);

CREATE TABLE billing_provider_refs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  business_id TEXT REFERENCES businesses(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL,
  reference_type TEXT NOT NULL,
  external_reference TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider, reference_type, external_reference)
);

CREATE INDEX idx_billing_provider_refs_scope
  ON billing_provider_refs(organization_id, workspace_id, provider, reference_type);

CREATE TABLE billing_reconciliation_cases (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL,
  reference_type TEXT NOT NULL,
  external_reference TEXT,
  local_reference TEXT,
  status TEXT NOT NULL CHECK (status IN ('open','investigating','resolved','ignored')),
  category TEXT NOT NULL,
  details_json TEXT,
  opened_at TEXT NOT NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (resolved_at IS NULL OR resolved_at >= opened_at)
);

CREATE INDEX idx_billing_reconciliation_status
  ON billing_reconciliation_cases(status, opened_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_billing_subscription_scope_insert
BEFORE INSERT ON billing_subscriptions
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM businesses b
  WHERE b.id = NEW.business_id
    AND b.organization_id = NEW.organization_id
    AND (NEW.workspace_id IS NULL OR b.workspace_id = NEW.workspace_id)
)
BEGIN
  SELECT RAISE(ABORT, 'Billing subscription crosses organization/workspace boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_billing_usage_business_scope_insert
BEFORE INSERT ON billing_usage_events
FOR EACH ROW
WHEN NEW.business_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1
  FROM businesses b
  WHERE b.id = NEW.business_id
    AND b.organization_id = NEW.organization_id
    AND (NEW.workspace_id IS NULL OR b.workspace_id = NEW.workspace_id)
 )
BEGIN
  SELECT RAISE(ABORT, 'Billing usage business crosses scope boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_billing_provider_ref_business_scope_insert
BEFORE INSERT ON billing_provider_refs
FOR EACH ROW
WHEN NEW.business_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1
  FROM businesses b
  WHERE b.id = NEW.business_id
    AND b.organization_id = NEW.organization_id
    AND (NEW.workspace_id IS NULL OR b.workspace_id = NEW.workspace_id)
 )
BEGIN
  SELECT RAISE(ABORT, 'Billing provider reference crosses scope boundary');
END;
