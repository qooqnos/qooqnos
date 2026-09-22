-- Establish short-lived booking holds and immutable booking/appointment history.
CREATE TABLE booking_holds (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  resource_id TEXT REFERENCES resources(id) ON DELETE RESTRICT,
  slot_reference TEXT NOT NULL,
  actor_reference TEXT,
  status TEXT NOT NULL CHECK (status IN ('active','released','expired','consumed')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX uq_booking_holds_active_slot
  ON booking_holds(business_id, COALESCE(resource_id, ''), slot_reference)
  WHERE status = 'active';

CREATE INDEX idx_booking_holds_expiry
  ON booking_holds(status, expires_at);

CREATE INDEX idx_booking_holds_actor
  ON booking_holds(actor_reference, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_booking_hold_scope_insert
BEFORE INSERT ON booking_holds
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM businesses b
  LEFT JOIN resources r ON r.id = NEW.resource_id
  WHERE b.id = NEW.business_id
    AND b.organization_id = NEW.organization_id
    AND b.workspace_id = NEW.workspace_id
    AND (NEW.resource_id IS NULL OR r.business_id = NEW.business_id)
)
BEGIN
  SELECT RAISE(ABORT, 'Booking hold scope is invalid');
END;

CREATE TABLE booking_status_history (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  from_status TEXT,
  to_status TEXT NOT NULL CHECK (
    to_status IN ('requested','pending_confirmation','confirmed','rescheduled','cancelled','completed','no_show')
  ),
  changed_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_booking_status_history_booking_time
  ON booking_status_history(booking_id, changed_at DESC, id DESC);

CREATE TABLE appointment_events (
  id TEXT PRIMARY KEY,
  appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1 CHECK (event_version >= 1),
  payload_json TEXT,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX uq_appointment_event
  ON appointment_events(appointment_id, event_type, event_version);

CREATE INDEX idx_appointment_events_appointment_time
  ON appointment_events(appointment_id, occurred_at DESC, id DESC);
