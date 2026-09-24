-- Harden the canonical Billing reconciliation contract around provider/local financial truth.
ALTER TABLE billing_reconciliation_cases ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT;
ALTER TABLE billing_reconciliation_cases ADD COLUMN business_id TEXT REFERENCES businesses(id) ON DELETE RESTRICT;
ALTER TABLE billing_reconciliation_cases ADD COLUMN expected_amount_minor INTEGER;
ALTER TABLE billing_reconciliation_cases ADD COLUMN observed_amount_minor INTEGER;
ALTER TABLE billing_reconciliation_cases ADD COLUMN currency TEXT;
ALTER TABLE billing_reconciliation_cases ADD COLUMN correlation_id TEXT;
ALTER TABLE billing_reconciliation_cases ADD COLUMN idempotency_key TEXT;
ALTER TABLE billing_reconciliation_cases ADD COLUMN resolution_code TEXT;
ALTER TABLE billing_reconciliation_cases ADD COLUMN resolved_by TEXT;

CREATE UNIQUE INDEX uq_billing_reconciliation_idempotency
  ON billing_reconciliation_cases(organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX idx_billing_reconciliation_scope
  ON billing_reconciliation_cases(organization_id, workspace_id, business_id, status, opened_at DESC);

CREATE INDEX idx_billing_reconciliation_reference
  ON billing_reconciliation_cases(organization_id, provider, reference_type, external_reference, local_reference);

CREATE TRIGGER trg_billing_reconciliation_scope_insert
BEFORE INSERT ON billing_reconciliation_cases
FOR EACH ROW
WHEN NEW.business_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM businesses b
   WHERE b.id = NEW.business_id
     AND b.organization_id = NEW.organization_id
     AND (NEW.workspace_id IS NULL OR b.workspace_id = NEW.workspace_id)
 )
BEGIN
  SELECT RAISE(ABORT, 'Billing reconciliation case crosses organization/workspace boundary');
END;

CREATE TABLE billing_reconciliation_case_events (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES billing_reconciliation_cases(id) ON DELETE RESTRICT,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('opened','investigating','resolved','ignored','note')),
  from_status TEXT,
  to_status TEXT,
  actor_reference TEXT,
  details_json TEXT,
  occurred_at TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(case_id, event_type, occurred_at, correlation_id)
);

CREATE INDEX idx_billing_reconciliation_case_events_case
  ON billing_reconciliation_case_events(case_id, occurred_at DESC, id DESC);

CREATE TRIGGER trg_billing_reconciliation_case_event_no_update
BEFORE UPDATE ON billing_reconciliation_case_events
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Reconciliation case events are immutable');
END;

CREATE TRIGGER trg_billing_reconciliation_case_event_no_delete
BEFORE DELETE ON billing_reconciliation_case_events
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Reconciliation case events cannot be deleted');
END;
