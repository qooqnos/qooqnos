-- Establish the canonical Commerce transaction persistence boundary.
CREATE TABLE commerce_carts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  customer_id TEXT REFERENCES customers(id) ON DELETE RESTRICT,
  actor_reference TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','expired','converted','abandoned')),
  currency TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_commerce_carts_actor_status
  ON commerce_carts(actor_reference, status, created_at DESC);

CREATE INDEX idx_commerce_carts_customer_status
  ON commerce_carts(customer_id, status, created_at DESC);

CREATE INDEX idx_commerce_carts_expiry
  ON commerce_carts(status, expires_at);

CREATE TABLE commerce_cart_lines (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL REFERENCES commerce_carts(id) ON DELETE RESTRICT,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('offering','product_variant','service')),
  resource_id TEXT NOT NULL,
  variant_reference TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  selected_options_json TEXT,
  source_reference TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_commerce_cart_lines_cart
  ON commerce_cart_lines(cart_id, created_at, id);

CREATE INDEX idx_commerce_cart_lines_resource
  ON commerce_cart_lines(resource_type, resource_id);

CREATE TABLE commerce_checkout_sessions (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL REFERENCES commerce_carts(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('started','validating','committed','failed','expired')),
  idempotency_key TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  catalog_snapshot_refs_json TEXT,
  promotion_qualification_refs_json TEXT,
  loyalty_benefit_refs_json TEXT,
  booking_reservation_refs_json TEXT,
  payment_attempt_ref TEXT,
  failure_code TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(cart_id, idempotency_key)
);

CREATE INDEX idx_commerce_checkout_status
  ON commerce_checkout_sessions(status, started_at DESC);

CREATE TABLE commerce_price_snapshots (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  currency TEXT NOT NULL,
  line_snapshots_json TEXT NOT NULL,
  subtotal_minor INTEGER NOT NULL CHECK (subtotal_minor >= 0),
  adjustment_total_minor INTEGER NOT NULL,
  tax_total_minor INTEGER NOT NULL CHECK (tax_total_minor >= 0),
  fee_total_minor INTEGER NOT NULL CHECK (fee_total_minor >= 0),
  grand_total_minor INTEGER NOT NULL CHECK (grand_total_minor >= 0),
  catalog_version_refs_json TEXT,
  promotion_version_refs_json TEXT,
  loyalty_version_refs_json TEXT,
  policy_version TEXT NOT NULL,
  calculated_at TEXT NOT NULL,
  calculation_context_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_commerce_price_snapshots_scope_time
  ON commerce_price_snapshots(organization_id, workspace_id, calculated_at DESC);

CREATE UNIQUE INDEX uq_commerce_price_snapshot_context
  ON commerce_price_snapshots(calculation_context_hash);

CREATE TABLE commerce_orders (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  price_snapshot_id TEXT REFERENCES commerce_price_snapshots(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (
    status IN ('draft','pending_confirmation','pending_payment','confirmed','in_fulfillment','completed','cancelled','refund_pending','refunded')
  ),
  currency TEXT NOT NULL,
  subtotal_minor INTEGER NOT NULL CHECK (subtotal_minor >= 0),
  adjustment_total_minor INTEGER NOT NULL,
  tax_total_minor INTEGER NOT NULL CHECK (tax_total_minor >= 0),
  fee_total_minor INTEGER NOT NULL CHECK (fee_total_minor >= 0),
  grand_total_minor INTEGER NOT NULL CHECK (grand_total_minor >= 0),
  payment_status_ref TEXT,
  fulfillment_status_ref TEXT,
  source_channel TEXT NOT NULL CHECK (source_channel IN ('web','app','agent','api','ai_tool')),
  policy_version TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  confirmed_at TEXT,
  completed_at TEXT,
  UNIQUE(organization_id, workspace_id, idempotency_key)
);

CREATE INDEX idx_commerce_orders_customer_status
  ON commerce_orders(customer_id, status, created_at DESC);

CREATE INDEX idx_commerce_orders_business_status
  ON commerce_orders(business_id, status, created_at DESC);

CREATE INDEX idx_commerce_orders_workspace_status
  ON commerce_orders(workspace_id, status, created_at DESC);

CREATE TABLE commerce_order_lines (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES commerce_orders(id) ON DELETE RESTRICT,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('offering','product_variant','service')),
  resource_id TEXT NOT NULL,
  resource_version TEXT,
  variant_reference TEXT,
  description_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_minor_snapshot INTEGER NOT NULL CHECK (unit_price_minor_snapshot >= 0),
  line_subtotal_minor INTEGER NOT NULL CHECK (line_subtotal_minor >= 0),
  line_adjustment_total_minor INTEGER NOT NULL,
  line_total_minor INTEGER NOT NULL CHECK (line_total_minor >= 0),
  promotion_reference TEXT,
  loyalty_reference TEXT,
  booking_reference TEXT,
  fulfillment_reference TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_commerce_order_lines_order
  ON commerce_order_lines(order_id, created_at, id);

CREATE INDEX idx_commerce_order_lines_resource
  ON commerce_order_lines(resource_type, resource_id);

CREATE TABLE commerce_order_adjustments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES commerce_orders(id) ON DELETE RESTRICT,
  order_line_id TEXT REFERENCES commerce_order_lines(id) ON DELETE RESTRICT,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('promotion','loyalty','fee','tax','manual_approved')),
  source_module TEXT NOT NULL,
  source_reference TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_commerce_order_adjustments_order
  ON commerce_order_adjustments(order_id, created_at, id);

CREATE TABLE commerce_transaction_attempts (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES commerce_orders(id) ON DELETE RESTRICT,
  attempt_type TEXT NOT NULL,
  attempt_status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  provider_reference TEXT,
  requested_at TEXT NOT NULL,
  completed_at TEXT,
  failure_code TEXT,
  correlation_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(order_id, idempotency_key)
);

CREATE INDEX idx_commerce_transaction_attempts_order_status
  ON commerce_transaction_attempts(order_id, attempt_status, requested_at DESC);

CREATE TABLE commerce_fulfillment_references (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES commerce_orders(id) ON DELETE RESTRICT,
  order_line_id TEXT REFERENCES commerce_order_lines(id) ON DELETE RESTRICT,
  fulfillment_type TEXT NOT NULL,
  external_module TEXT NOT NULL,
  external_reference TEXT NOT NULL,
  status_reference TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(external_module, external_reference)
);

CREATE INDEX idx_commerce_fulfillment_refs_order
  ON commerce_fulfillment_references(order_id, created_at DESC);

CREATE TABLE commerce_cancellations (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES commerce_orders(id) ON DELETE RESTRICT,
  requested_by TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  decision TEXT NOT NULL,
  effective_at TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_commerce_cancellations_order
  ON commerce_cancellations(order_id, effective_at DESC);

CREATE TABLE commerce_refund_references (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES commerce_orders(id) ON DELETE RESTRICT,
  requested_amount_minor INTEGER NOT NULL CHECK (requested_amount_minor > 0),
  currency TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  billing_reference TEXT NOT NULL,
  refund_status TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  completed_at TEXT,
  correlation_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_commerce_refund_refs_order
  ON commerce_refund_references(order_id, requested_at DESC);

CREATE TABLE commerce_order_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES commerce_orders(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1 CHECK (event_version >= 1),
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  actor_reference TEXT,
  source TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  causation_id TEXT,
  provenance_reference TEXT,
  payload_reference TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(order_id, event_type, event_version)
);

CREATE INDEX idx_commerce_order_events_order_time
  ON commerce_order_events(order_id, occurred_at DESC, id DESC);

CREATE TRIGGER IF NOT EXISTS trg_commerce_cart_scope_insert
BEFORE INSERT ON commerce_carts
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM workspaces w
   WHERE w.id = NEW.workspace_id
     AND w.organization_id = NEW.organization_id
 )
BEGIN
  SELECT RAISE(ABORT, 'Commerce cart workspace crosses organization boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_commerce_order_scope_insert
BEFORE INSERT ON commerce_orders
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM businesses b
  INNER JOIN customers c ON c.id = NEW.customer_id
  WHERE b.id = NEW.business_id
    AND b.organization_id = NEW.organization_id
    AND b.workspace_id = NEW.workspace_id
    AND c.organization_id = NEW.organization_id
)
BEGIN
  SELECT RAISE(ABORT, 'Commerce order scope does not match business/customer');
END;

CREATE TRIGGER IF NOT EXISTS trg_commerce_order_line_mutation_guard
BEFORE UPDATE OF resource_type, resource_id, resource_version, variant_reference,
  description_snapshot, quantity, unit_price_minor_snapshot, line_subtotal_minor,
  line_adjustment_total_minor, line_total_minor, promotion_reference,
  loyalty_reference, booking_reference, fulfillment_reference ON commerce_order_lines
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM commerce_orders o
  WHERE o.id = OLD.order_id
    AND o.status NOT IN ('draft','pending_confirmation')
)
BEGIN
  SELECT RAISE(ABORT, 'Committed Commerce order lines are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_commerce_order_line_delete_guard
BEFORE DELETE ON commerce_order_lines
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM commerce_orders o
  WHERE o.id = OLD.order_id
    AND o.status NOT IN ('draft','pending_confirmation')
)
BEGIN
  SELECT RAISE(ABORT, 'Committed Commerce order lines are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_commerce_price_snapshot_immutable
BEFORE UPDATE OR DELETE ON commerce_price_snapshots
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Commerce price snapshots are immutable');
END;
