-- Establish canonical schedule and availability rule/exception storage.
CREATE TABLE schedules (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  location_id TEXT REFERENCES locations(id) ON DELETE RESTRICT,
  resource_id TEXT REFERENCES resources(id) ON DELETE RESTRICT,
  timezone TEXT NOT NULL,
  recurrence_definition TEXT NOT NULL,
  booking_horizon_minutes INTEGER CHECK (
    booking_horizon_minutes IS NULL OR booking_horizon_minutes >= 0
  ),
  lead_time_minutes INTEGER CHECK (
    lead_time_minutes IS NULL OR lead_time_minutes >= 0
  ),
  buffer_before_seconds INTEGER CHECK (
    buffer_before_seconds IS NULL OR buffer_before_seconds >= 0
  ),
  buffer_after_seconds INTEGER CHECK (
    buffer_after_seconds IS NULL OR buffer_after_seconds >= 0
  ),
  status TEXT NOT NULL CHECK (status IN ('active','inactive','archived')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_schedules_business_status
  ON schedules(business_id, status);

CREATE INDEX idx_schedules_resource_status
  ON schedules(resource_id, status);

CREATE TRIGGER IF NOT EXISTS trg_schedule_scope_insert
BEFORE INSERT ON schedules
FOR EACH ROW
WHEN
  NOT EXISTS (
    SELECT 1 FROM businesses b
    WHERE b.id = NEW.business_id
  )
  OR (NEW.location_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM locations l
    WHERE l.id = NEW.location_id
      AND l.business_id = NEW.business_id
  ))
  OR (NEW.resource_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM resources r
    WHERE r.id = NEW.resource_id
      AND r.business_id = NEW.business_id
  ))
BEGIN
  SELECT RAISE(ABORT, 'Schedule references an invalid Business/Location/Resource scope');
END;

CREATE TABLE availability_rules (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES schedules(id) ON DELETE RESTRICT,
  rule_type TEXT NOT NULL,
  recurrence_payload TEXT NOT NULL,
  start_constraint TEXT,
  end_constraint TEXT,
  capacity INTEGER CHECK (capacity IS NULL OR capacity > 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_availability_rules_schedule_version
  ON availability_rules(schedule_id, version DESC);

CREATE TABLE availability_exceptions (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES schedules(id) ON DELETE RESTRICT,
  effective_start TEXT NOT NULL,
  effective_end TEXT NOT NULL,
  exception_type TEXT NOT NULL,
  capacity INTEGER CHECK (capacity IS NULL OR capacity >= 0),
  closure_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (effective_end > effective_start)
);

CREATE INDEX idx_availability_exceptions_schedule_time
  ON availability_exceptions(schedule_id, effective_start, effective_end);

CREATE TRIGGER IF NOT EXISTS trg_availability_exception_scope_insert
BEFORE INSERT ON availability_exceptions
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM schedules s
  WHERE s.id = NEW.schedule_id
)
BEGIN
  SELECT RAISE(ABORT, 'Availability exception references an unknown schedule');
END;
