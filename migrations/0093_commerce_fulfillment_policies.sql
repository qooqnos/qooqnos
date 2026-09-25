-- Establish the canonical Commerce shipping and returns policy boundary.
-- SEO/GEO consumes this data as a projection; it is not authoritative state.

CREATE TABLE commerce_fulfillment_policies (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('product','product_variant','offering')),
  resource_id TEXT,
  destination_country TEXT,
  destination_region TEXT,
  destination_postal_code TEXT,
  shipping_rate_minor INTEGER CHECK (shipping_rate_minor IS NULL OR shipping_rate_minor >= 0),
  shipping_currency TEXT,
  handling_time_min_days INTEGER CHECK (handling_time_min_days IS NULL OR handling_time_min_days >= 0),
  handling_time_max_days INTEGER CHECK (handling_time_max_days IS NULL OR handling_time_max_days >= 0),
  return_window_days INTEGER CHECK (return_window_days IS NULL OR return_window_days >= 0),
  return_fees TEXT CHECK (return_fees IS NULL OR return_fees IN ('FreeReturn','ReturnFeesCustomerResponsibility','ReturnShippingFees')),
  return_method TEXT CHECK (return_method IS NULL OR return_method IN ('ReturnByMail','ReturnInStore','ReturnAtKiosk')),
  policy_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','active','retired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (handling_time_max_days IS NULL OR handling_time_min_days IS NULL OR handling_time_max_days >= handling_time_min_days),
  CHECK (shipping_rate_minor IS NULL OR shipping_currency IS NOT NULL),
  CHECK (shipping_currency IS NULL OR shipping_rate_minor IS NOT NULL)
);

CREATE INDEX idx_commerce_fulfillment_policies_resource
  ON commerce_fulfillment_policies(organization_id, workspace_id, business_id, resource_type, resource_id, status);

CREATE INDEX idx_commerce_fulfillment_policies_destination
  ON commerce_fulfillment_policies(organization_id, workspace_id, business_id, destination_country, destination_region, destination_postal_code, status);

CREATE UNIQUE INDEX uq_commerce_fulfillment_policy_active
  ON commerce_fulfillment_policies(
    organization_id, workspace_id, business_id, resource_type,
    COALESCE(resource_id, ''), COALESCE(destination_country, ''),
    COALESCE(destination_region, ''), COALESCE(destination_postal_code, '')
  )
  WHERE status = 'active';

CREATE TRIGGER IF NOT EXISTS trg_commerce_fulfillment_policy_scope
BEFORE INSERT ON commerce_fulfillment_policies
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM businesses b
  WHERE b.id = NEW.business_id
    AND b.organization_id = NEW.organization_id
    AND b.workspace_id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'Commerce fulfillment policy scope is invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_commerce_fulfillment_policy_update_scope
BEFORE UPDATE ON commerce_fulfillment_policies
FOR EACH ROW
WHEN NEW.organization_id <> OLD.organization_id
  OR NEW.workspace_id <> OLD.workspace_id
  OR NEW.business_id <> OLD.business_id
  OR NEW.resource_type <> OLD.resource_type
  OR COALESCE(NEW.resource_id, '') <> COALESCE(OLD.resource_id, '')
BEGIN
  SELECT RAISE(ABORT, 'Commerce fulfillment policy identity is immutable');
END;
