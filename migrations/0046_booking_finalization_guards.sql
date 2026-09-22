-- Add Booking idempotency and transactional resource-capacity finalization guards.
ALTER TABLE bookings ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX uq_booking_idempotency
  ON bookings(organization_id, workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS trg_appointment_resource_capacity_insert
BEFORE INSERT ON appointment_resources
FOR EACH ROW
WHEN (
  SELECT COUNT(*)
  FROM appointment_resources ar
  INNER JOIN appointments a ON a.id = ar.appointment_id
  INNER JOIN appointments new_a ON new_a.id = NEW.appointment_id
  WHERE ar.resource_id = NEW.resource_id
    AND a.status IN ('scheduled','confirmed')
    AND a.starts_at < new_a.ends_at
    AND a.ends_at > new_a.starts_at
) >= (
  SELECT r.capacity
  FROM resources r
  WHERE r.id = NEW.resource_id
)
BEGIN
  SELECT RAISE(ABORT, 'Booking resource capacity is exhausted for the requested interval');
END;

CREATE TRIGGER IF NOT EXISTS trg_appointment_resource_capacity_update
BEFORE UPDATE OF appointment_id, resource_id ON appointment_resources
FOR EACH ROW
WHEN (
  SELECT COUNT(*)
  FROM appointment_resources ar
  INNER JOIN appointments a ON a.id = ar.appointment_id
  INNER JOIN appointments new_a ON new_a.id = NEW.appointment_id
  WHERE ar.resource_id = NEW.resource_id
    AND ar.appointment_id <> OLD.appointment_id
    AND a.status IN ('scheduled','confirmed')
    AND a.starts_at < new_a.ends_at
    AND a.ends_at > new_a.starts_at
) >= (
  SELECT r.capacity
  FROM resources r
  WHERE r.id = NEW.resource_id
)
BEGIN
  SELECT RAISE(ABORT, 'Booking resource capacity is exhausted for the requested interval');
END;
