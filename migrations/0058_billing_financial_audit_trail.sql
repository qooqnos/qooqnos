-- Establish the canonical append-only financial audit evidence boundary.
CREATE TABLE billing_financial_audit_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  business_id TEXT REFERENCES businesses(id) ON DELETE RESTRICT,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('succeeded','failed','rejected')),
  amount_minor INTEGER,
  currency TEXT,
  reason_code TEXT,
  reason TEXT,
  source TEXT NOT NULL,
  request_id TEXT,
  correlation_id TEXT NOT NULL,
  idempotency_key TEXT,
  before_json TEXT,
  after_json TEXT,
  metadata_json TEXT,
  integrity_hash TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (amount_minor IS NULL OR amount_minor BETWEEN -9007199254740991 AND 9007199254740991),
  CHECK (currency IS NULL OR (length(currency) = 3 AND currency = upper(currency))),
  CHECK (idempotency_key IS NULL OR length(trim(idempotency_key)) > 0)
);

CREATE INDEX idx_billing_financial_audit_scope_time
  ON billing_financial_audit_events(organization_id, workspace_id, occurred_at DESC, id DESC);

CREATE INDEX idx_billing_financial_audit_entity_time
  ON billing_financial_audit_events(entity_type, entity_id, occurred_at DESC, id DESC);

CREATE INDEX idx_billing_financial_audit_correlation
  ON billing_financial_audit_events(correlation_id, occurred_at DESC);

CREATE UNIQUE INDEX uq_billing_financial_audit_idempotency
  ON billing_financial_audit_events(organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TRIGGER trg_billing_financial_audit_no_update
BEFORE UPDATE ON billing_financial_audit_events
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Financial audit events are append-only');
END;

CREATE TRIGGER trg_billing_financial_audit_no_delete
BEFORE DELETE ON billing_financial_audit_events
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Financial audit events are append-only');
END;
