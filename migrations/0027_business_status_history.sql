-- Add immutable lifecycle history for the existing physical Business status vocabulary.
CREATE TABLE business_status_history (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  from_status TEXT,
  to_status TEXT NOT NULL CHECK (
    to_status IN ('draft','active','suspended','archived')
  ),
  changed_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_business_status_history_business_time
  ON business_status_history(business_id, changed_at DESC, id DESC);

CREATE TRIGGER IF NOT EXISTS trg_business_status_history_scope
BEFORE INSERT ON business_status_history
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM businesses b
  WHERE b.id = NEW.business_id
)
BEGIN
  SELECT RAISE(ABORT, 'Business status history references an unknown business');
END;
