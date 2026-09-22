-- Add atomic Billing usage counters for hard quota enforcement.
CREATE TABLE billing_usage_counters (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  business_id TEXT REFERENCES businesses(id) ON DELETE RESTRICT,
  meter_id TEXT NOT NULL REFERENCES billing_usage_meters(id) ON DELETE RESTRICT,
  period_key TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_at TEXT NOT NULL,
);

CREATE UNIQUE INDEX uq_billing_usage_counter_scope
  ON billing_usage_counters(
    organization_id,
    COALESCE(workspace_id, ''),
    meter_id,
    period_key
  );

CREATE INDEX idx_billing_usage_counters_meter_period
  ON billing_usage_counters(meter_id, period_key, organization_id, workspace_id);

CREATE TRIGGER IF NOT EXISTS trg_billing_usage_counter_business_scope_insert
BEFORE INSERT ON billing_usage_counters
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
  SELECT RAISE(ABORT, 'Billing usage counter business crosses scope boundary');
END;
