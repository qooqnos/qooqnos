-- Add the idempotency and initial lifecycle evidence required by atomic Booking finalization.
ALTER TABLE bookings ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX uq_bookings_scope_idempotency
  ON bookings(organization_id, workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX idx_bookings_idempotency
  ON bookings(idempotency_key);

CREATE TRIGGER IF NOT EXISTS trg_booking_idempotency_required
BEFORE INSERT ON bookings
FOR EACH ROW
WHEN NEW.idempotency_key IS NULL OR trim(NEW.idempotency_key) = ''
BEGIN
  SELECT RAISE(ABORT, 'Booking idempotency key is required');
END;
