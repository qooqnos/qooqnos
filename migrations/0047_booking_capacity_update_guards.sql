-- Harden Booking capacity checks on appointment status/resource mutations.
CREATE TRIGGER IF NOT EXISTS trg_appointment_capacity_status_update
BEFORE UPDATE OF status, starts_at, ends_at ON appointments
FOR EACH ROW
WHEN NEW.status IN ('scheduled','confirmed')
 AND EXISTS (
   SELECT 1
   FROM appointment_resources ar
   INNER JOIN resources r ON r.id = ar.resource_id
   WHERE ar.appointment_id = NEW.id
     AND (
       SELECT COUNT(*)
       FROM appointment_resources ar2
       INNER JOIN appointments a2 ON a2.id = ar2.appointment_id
       WHERE ar2.resource_id = ar.resource_id
         AND ar2.appointment_id <> NEW.id
         AND a2.status IN ('scheduled','confirmed')
         AND a2.starts_at < NEW.ends_at
         AND a2.ends_at > NEW.starts_at
     ) >= r.capacity
 )
BEGIN
  SELECT RAISE(ABORT, 'Booking resource capacity is exhausted for the appointment interval');
END;

CREATE TRIGGER IF NOT EXISTS trg_resource_capacity_update_guard
BEFORE UPDATE OF capacity ON resources
FOR EACH ROW
WHEN NEW.capacity < (
  SELECT COUNT(DISTINCT ar.appointment_id)
  FROM appointment_resources ar
  INNER JOIN appointments a ON a.id = ar.appointment_id
  WHERE ar.resource_id = NEW.id
    AND a.status IN ('scheduled','confirmed')
)
BEGIN
  SELECT RAISE(ABORT, 'Resource capacity cannot be lowered below active commitments');
END;
