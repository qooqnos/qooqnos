-- Establish the canonical Fulfillment & Service Delivery execution boundary.
CREATE TABLE fulfillment_orders (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  source_type TEXT NOT NULL CHECK (source_type IN ('commerce_order','booking')),
  source_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','planned','ready','in_progress','partially_completed','completed','cancelled','failed','closed')),
  fulfillment_type TEXT NOT NULL CHECK (fulfillment_type IN ('physical','digital','service','hybrid')),
  plan_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  cancelled_at TEXT
);

CREATE INDEX idx_fulfillment_orders_scope_status
  ON fulfillment_orders(organization_id, workspace_id, business_id, status, created_at DESC);

CREATE UNIQUE INDEX uq_fulfillment_source
  ON fulfillment_orders(source_type, source_id);

CREATE TABLE fulfillment_items (
  id TEXT PRIMARY KEY,
  fulfillment_id TEXT NOT NULL REFERENCES fulfillment_orders(id) ON DELETE RESTRICT,
  source_type TEXT NOT NULL CHECK (source_type IN ('commerce_order_line','booking_item','direct_commitment')),
  source_id TEXT NOT NULL,
  source_line_id TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  fulfillment_type TEXT NOT NULL CHECK (fulfillment_type IN ('physical','digital','service')),
  status TEXT NOT NULL CHECK (status IN ('pending','ready','in_progress','partially_completed','completed','cancelled','failed','requires_rework')),
  promised_from TEXT,
  promised_to TEXT,
  destination_ref TEXT,
  service_location_ref TEXT,
  assigned_actor_ref TEXT,
  completion_evidence_ref TEXT,
  exception_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (promised_to IS NULL OR promised_from IS NULL OR promised_to >= promised_from)
);

CREATE INDEX idx_fulfillment_items_fulfillment_status
  ON fulfillment_items(fulfillment_id, status, created_at);

CREATE UNIQUE INDEX uq_fulfillment_item_source
  ON fulfillment_items(source_type, source_id, COALESCE(source_line_id, ''));

CREATE TABLE fulfillment_plans (
  id TEXT PRIMARY KEY,
  fulfillment_id TEXT NOT NULL REFERENCES fulfillment_orders(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version >= 1),
  status TEXT NOT NULL CHECK (status IN ('draft','active','superseded','cancelled')),
  strategy TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  activated_at TEXT,
  supersedes_plan_id TEXT REFERENCES fulfillment_plans(id) ON DELETE RESTRICT,
  UNIQUE(fulfillment_id, version)
);

CREATE INDEX idx_fulfillment_plans_active
  ON fulfillment_plans(fulfillment_id, status, version DESC);

CREATE TABLE fulfillment_tasks (
  id TEXT PRIMARY KEY,
  fulfillment_id TEXT NOT NULL REFERENCES fulfillment_orders(id) ON DELETE RESTRICT,
  fulfillment_item_id TEXT REFERENCES fulfillment_items(id) ON DELETE RESTRICT,
  task_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','ready','assigned','in_progress','completed','failed','cancelled','blocked')),
  priority INTEGER NOT NULL DEFAULT 100,
  assigned_actor_ref TEXT,
  scheduled_from TEXT,
  scheduled_to TEXT,
  started_at TEXT,
  completed_at TEXT,
  failure_reason_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (scheduled_to IS NULL OR scheduled_from IS NULL OR scheduled_to >= scheduled_from)
);

CREATE INDEX idx_fulfillment_tasks_queue
  ON fulfillment_tasks(status, priority, scheduled_from);

CREATE INDEX idx_fulfillment_tasks_fulfillment
  ON fulfillment_tasks(fulfillment_id, status, created_at);

CREATE TABLE fulfillment_assignments (
  id TEXT PRIMARY KEY,
  fulfillment_task_id TEXT NOT NULL REFERENCES fulfillment_tasks(id) ON DELETE RESTRICT,
  actor_ref TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  unassigned_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('assigned','active','ended','cancelled')),
  CHECK (unassigned_at IS NULL OR unassigned_at >= assigned_at)
);

CREATE INDEX idx_fulfillment_assignments_task_status
  ON fulfillment_assignments(fulfillment_task_id, status, assigned_at DESC);

CREATE TABLE shipments (
  id TEXT PRIMARY KEY,
  fulfillment_item_id TEXT NOT NULL REFERENCES fulfillment_items(id) ON DELETE RESTRICT,
  carrier_ref TEXT,
  service_level TEXT,
  tracking_reference TEXT,
  origin_ref TEXT,
  destination_ref TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft','ready','dispatched','in_transit','out_for_delivery','delivered','cancelled','returned','lost','failed')),
  dispatched_at TEXT,
  delivered_at TEXT,
  proof_of_delivery_ref TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (delivered_at IS NULL OR dispatched_at IS NULL OR delivered_at >= dispatched_at)
);

CREATE INDEX idx_shipments_item_status
  ON shipments(fulfillment_item_id, status, created_at DESC);

CREATE UNIQUE INDEX uq_shipments_tracking_reference
  ON shipments(carrier_ref, tracking_reference)
  WHERE tracking_reference IS NOT NULL;

CREATE TABLE shipment_packages (
  id TEXT PRIMARY KEY,
  shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
  package_reference TEXT NOT NULL,
  package_type TEXT NOT NULL,
  weight_ref TEXT,
  dimensions_ref TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(shipment_id, package_reference)
);

CREATE TABLE tracking_events (
  id TEXT PRIMARY KEY,
  shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  source TEXT NOT NULL,
  external_event_id TEXT,
  location_ref TEXT,
  normalized_status TEXT NOT NULL,
  provider_payload_ref TEXT,
  event_version INTEGER NOT NULL DEFAULT 1 CHECK (event_version >= 1),
  deduplication_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(shipment_id, deduplication_key)
);

CREATE INDEX idx_tracking_events_shipment_time
  ON tracking_events(shipment_id, occurred_at DESC, received_at DESC);

CREATE TABLE delivery_attempts (
  id TEXT PRIMARY KEY,
  shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
  attempted_at TEXT NOT NULL,
  actor_ref TEXT,
  status TEXT NOT NULL,
  failure_reason_code TEXT,
  evidence_ref TEXT,
  next_action_ref TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(shipment_id, attempt_number)
);

CREATE TABLE service_deliveries (
  id TEXT PRIMARY KEY,
  fulfillment_item_id TEXT NOT NULL REFERENCES fulfillment_items(id) ON DELETE RESTRICT,
  booking_ref TEXT NOT NULL,
  provider_ref TEXT,
  service_location_ref TEXT,
  status TEXT NOT NULL CHECK (status IN ('scheduled','ready','in_progress','completed','cancelled','no_show','failed','requires_rework')),
  scheduled_from TEXT,
  scheduled_to TEXT,
  started_at TEXT,
  ended_at TEXT,
  completion_id TEXT,
  exception_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (scheduled_to IS NULL OR scheduled_from IS NULL OR scheduled_to >= scheduled_from)
);

CREATE UNIQUE INDEX uq_service_delivery_booking
  ON service_deliveries(booking_ref);

CREATE TABLE service_completions (
  id TEXT PRIMARY KEY,
  service_delivery_id TEXT NOT NULL REFERENCES service_deliveries(id) ON DELETE RESTRICT,
  completed_by_actor_ref TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  confirmation_type TEXT NOT NULL,
  customer_confirmation_ref TEXT,
  provider_confirmation_ref TEXT,
  evidence_ref TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','confirmed','rejected')),
  created_at TEXT NOT NULL,
  UNIQUE(service_delivery_id)
);

CREATE TABLE digital_deliveries (
  id TEXT PRIMARY KEY,
  fulfillment_item_id TEXT NOT NULL REFERENCES fulfillment_items(id) ON DELETE RESTRICT,
  entitlement_ref TEXT,
  delivery_channel TEXT NOT NULL,
  recipient_scope_ref TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT,
  delivery_status TEXT NOT NULL,
  evidence_ref TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (expires_at IS NULL OR expires_at >= issued_at)
);

CREATE TABLE fulfillment_exceptions (
  id TEXT PRIMARY KEY,
  fulfillment_id TEXT NOT NULL REFERENCES fulfillment_orders(id) ON DELETE RESTRICT,
  fulfillment_item_id TEXT REFERENCES fulfillment_items(id) ON DELETE RESTRICT,
  exception_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status TEXT NOT NULL CHECK (status IN ('open','investigating','resolved','cancelled')),
  reason_code TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  detected_by TEXT NOT NULL,
  resolution_code TEXT,
  resolved_at TEXT,
  resolved_by TEXT,
  rework_task_ref TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (resolved_at IS NULL OR resolved_at >= detected_at)
);

CREATE INDEX idx_fulfillment_exceptions_open
  ON fulfillment_exceptions(status, severity, detected_at DESC);

CREATE TABLE fulfillment_status_history (
  id TEXT PRIMARY KEY,
  aggregate_type TEXT NOT NULL CHECK (aggregate_type IN ('fulfillment_order','fulfillment_item','task','shipment','service_delivery')),
  aggregate_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  reason_code TEXT,
  correlation_id TEXT NOT NULL,
  policy_version TEXT
);

CREATE INDEX idx_fulfillment_status_history_aggregate
  ON fulfillment_status_history(aggregate_type, aggregate_id, changed_at DESC, id DESC);

CREATE TABLE fulfillment_completion_evidence (
  id TEXT PRIMARY KEY,
  evidence_type TEXT NOT NULL,
  evidence_ref TEXT NOT NULL,
  source TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  captured_by TEXT NOT NULL,
  verification_status TEXT NOT NULL,
  metadata_ref TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_fulfillment_completion_evidence_ref
  ON fulfillment_completion_evidence(evidence_type, evidence_ref);

CREATE TRIGGER IF NOT EXISTS trg_fulfillment_order_scope
BEFORE INSERT ON fulfillment_orders
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM businesses b
  WHERE b.id = NEW.business_id
    AND b.organization_id = NEW.organization_id
    AND b.workspace_id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'Fulfillment order scope crosses business boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_fulfillment_source_scope
BEFORE INSERT ON fulfillment_orders
FOR EACH ROW
WHEN NEW.source_type = 'commerce_order'
 AND NOT EXISTS (
   SELECT 1
   FROM commerce_orders o
   WHERE o.id = NEW.source_id
     AND o.organization_id = NEW.organization_id
     AND o.workspace_id = NEW.workspace_id
     AND o.business_id = NEW.business_id
 )
BEGIN
  SELECT RAISE(ABORT, 'Fulfillment Commerce source scope is invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_fulfillment_booking_source_scope
BEFORE INSERT ON fulfillment_orders
FOR EACH ROW
WHEN NEW.source_type = 'booking'
 AND NOT EXISTS (
   SELECT 1
   FROM bookings b
   WHERE b.id = NEW.source_id
     AND b.organization_id = NEW.organization_id
     AND b.workspace_id = NEW.workspace_id
     AND b.business_id = NEW.business_id
 )
BEGIN
  SELECT RAISE(ABORT, 'Fulfillment Booking source scope is invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_fulfillment_item_parent_scope
BEFORE INSERT ON fulfillment_items
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM fulfillment_orders f
  WHERE f.id = NEW.fulfillment_id
)
BEGIN
  SELECT RAISE(ABORT, 'Fulfillment item parent does not exist');
END;

CREATE TRIGGER IF NOT EXISTS trg_fulfillment_status_history_immutable
BEFORE UPDATE ON fulfillment_status_history
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Fulfillment status history is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_fulfillment_status_history_delete_immutable
BEFORE DELETE ON fulfillment_status_history
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Fulfillment status history is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_tracking_event_immutable
BEFORE UPDATE ON tracking_events
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Tracking events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_tracking_event_delete_immutable
BEFORE DELETE ON tracking_events
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Tracking events are append-only');
END;
