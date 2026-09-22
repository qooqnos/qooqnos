-- Establish the canonical Booking core and scheduling resources.
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (
    status IN ('requested','pending_confirmation','confirmed','rescheduled','cancelled','completed','no_show')
  ),
  currency TEXT NOT NULL,
  total_amount_minor INTEGER,
  policy_snapshot TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_bookings_customer_status
  ON bookings(customer_id, status, created_at DESC);

CREATE INDEX idx_bookings_business_status
  ON bookings(business_id, status, created_at DESC);

CREATE INDEX idx_bookings_workspace_status
  ON bookings(workspace_id, status, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_booking_scope_insert
BEFORE INSERT ON bookings
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM businesses b
  INNER JOIN customers c ON c.organization_id = b.organization_id
  INNER JOIN workspaces w ON w.id = b.workspace_id AND w.organization_id = b.organization_id
  WHERE b.id = NEW.business_id
    AND b.organization_id = NEW.organization_id
    AND b.workspace_id = NEW.workspace_id
    AND c.id = NEW.customer_id
    AND (NEW.total_amount_minor IS NULL OR NEW.total_amount_minor >= 0)
)
BEGIN
  SELECT RAISE(ABORT, 'Booking scope or customer/business relationship is invalid');
END;

CREATE TABLE booking_items (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  offering_id TEXT NOT NULL REFERENCES offerings(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  title_snapshot TEXT NOT NULL,
  price_minor_snapshot INTEGER NOT NULL CHECK (price_minor_snapshot >= 0),
  currency_snapshot TEXT NOT NULL,
  duration_seconds_snapshot INTEGER CHECK (
    duration_seconds_snapshot IS NULL OR duration_seconds_snapshot >= 0
  ),
  policy_snapshot TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_booking_items_booking
  ON booking_items(booking_id, id);

CREATE INDEX idx_booking_items_offering
  ON booking_items(offering_id);

CREATE TRIGGER IF NOT EXISTS trg_booking_item_scope_insert
BEFORE INSERT ON booking_items
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM bookings b
  INNER JOIN offerings o ON o.id = NEW.offering_id
  WHERE b.id = NEW.booking_id
    AND o.business_id = b.business_id
)
BEGIN
  SELECT RAISE(ABORT, 'Booking item offering does not belong to booking business');
END;

CREATE TABLE appointments (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (
    status IN ('scheduled','confirmed','cancelled','completed','no_show')
  ),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  timezone TEXT,
  location_id TEXT REFERENCES locations(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (ends_at > starts_at)
);

CREATE INDEX idx_appointments_booking
  ON appointments(booking_id, starts_at);

CREATE INDEX idx_appointments_time
  ON appointments(starts_at, ends_at, status);

CREATE TRIGGER IF NOT EXISTS trg_appointment_scope_insert
BEFORE INSERT ON appointments
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM bookings b
  LEFT JOIN locations l ON l.id = NEW.location_id
  WHERE b.id = NEW.booking_id
    AND (NEW.location_id IS NULL OR l.business_id = b.business_id)
)
BEGIN
  SELECT RAISE(ABORT, 'Appointment location does not belong to booking business');
END;

CREATE TABLE resources (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  location_id TEXT REFERENCES locations(id) ON DELETE RESTRICT,
  resource_type TEXT NOT NULL CHECK (
    resource_type IN ('person','room','equipment','vehicle','service_area','other')
  ),
  status TEXT NOT NULL CHECK (status IN ('active','inactive','archived')),
  capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity > 0),
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_resources_business_status
  ON resources(business_id, status);

CREATE INDEX idx_resources_location_status
  ON resources(location_id, status);

CREATE TRIGGER IF NOT EXISTS trg_resource_location_scope_insert
BEFORE INSERT ON resources
FOR EACH ROW
WHEN NEW.location_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1 FROM locations l
  WHERE l.id = NEW.location_id
    AND l.business_id = NEW.business_id
 )
BEGIN
  SELECT RAISE(ABORT, 'Resource location does not belong to resource business');
END;

CREATE TABLE appointment_resources (
  appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE RESTRICT,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (appointment_id, resource_id)
);

CREATE INDEX idx_appointment_resources_resource
  ON appointment_resources(resource_id, appointment_id);

CREATE TRIGGER IF NOT EXISTS trg_appointment_resource_scope_insert
BEFORE INSERT ON appointment_resources
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM appointments a
  INNER JOIN bookings b ON b.id = a.booking_id
  INNER JOIN resources r ON r.id = NEW.resource_id
  WHERE a.id = NEW.appointment_id
    AND r.business_id = b.business_id
)
BEGIN
  SELECT RAISE(ABORT, 'Appointment resource does not belong to booking business');
END;
