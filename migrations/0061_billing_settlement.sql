-- Establish canonical Billing settlement and provider payout accounting.
CREATE TABLE billing_settlements (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL,
  settlement_currency TEXT NOT NULL,
  gross_amount_minor INTEGER NOT NULL CHECK (gross_amount_minor > 0),
  fee_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (fee_amount_minor >= 0),
  refund_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (refund_amount_minor >= 0),
  net_amount_minor INTEGER NOT NULL CHECK (net_amount_minor >= 0),
  status TEXT NOT NULL CHECK (status IN ('pending','approved','processing','paid','failed','cancelled')),
  provider_reference TEXT,
  provider_status TEXT,
  ledger_transaction_id TEXT,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  requested_by TEXT,
  approved_by TEXT,
  requested_at TEXT NOT NULL,
  processed_at TEXT,
  completed_at TEXT,
  failure_code TEXT,
  correlation_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (fee_amount_minor + refund_amount_minor <= gross_amount_minor),
  CHECK (net_amount_minor = gross_amount_minor - fee_amount_minor - refund_amount_minor),
  CHECK (length(settlement_currency) = 3 AND settlement_currency = upper(settlement_currency)),
  CHECK (period_end > period_start),
  UNIQUE(organization_id, idempotency_key)
);

CREATE INDEX idx_billing_settlements_business_status
  ON billing_settlements(organization_id, business_id, status, created_at DESC);
CREATE INDEX idx_billing_settlements_provider_reference
  ON billing_settlements(organization_id, provider, provider_reference);
CREATE INDEX idx_billing_settlements_period
  ON billing_settlements(organization_id, business_id, period_start, period_end);

CREATE TABLE billing_settlement_items (
  id TEXT PRIMARY KEY,
  settlement_id TEXT NOT NULL REFERENCES billing_settlements(id) ON DELETE RESTRICT,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  source_type TEXT NOT NULL CHECK (source_type IN ('payment','refund','fee','adjustment')),
  source_reference TEXT NOT NULL,
  gross_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (gross_amount_minor >= 0),
  fee_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (fee_amount_minor >= 0),
  refund_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (refund_amount_minor >= 0),
  net_amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(currency) = 3 AND currency = upper(currency)),
  CHECK (net_amount_minor = gross_amount_minor - fee_amount_minor - refund_amount_minor),
  UNIQUE(settlement_id, source_type, source_reference)
);

CREATE INDEX idx_billing_settlement_items_source
  ON billing_settlement_items(organization_id, source_type, source_reference);

CREATE TRIGGER trg_billing_settlement_business_scope
BEFORE INSERT ON billing_settlements
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM businesses b
  WHERE b.id = NEW.business_id
    AND b.organization_id = NEW.organization_id
    AND (NEW.workspace_id IS NULL OR b.workspace_id = NEW.workspace_id)
)
BEGIN
  SELECT RAISE(ABORT, 'Billing settlement crosses organization/workspace boundary');
END;

CREATE TRIGGER trg_billing_settlement_item_scope
BEFORE INSERT ON billing_settlement_items
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM billing_settlements s
  WHERE s.id = NEW.settlement_id
    AND s.organization_id = NEW.organization_id
    AND s.business_id = NEW.business_id
    AND s.workspace_id IS NEW.workspace_id
    AND s.settlement_currency = NEW.currency
)
BEGIN
  SELECT RAISE(ABORT, 'Settlement item crosses settlement financial scope');
END;

CREATE TRIGGER trg_billing_settlement_item_no_update
BEFORE UPDATE ON billing_settlement_items
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Settlement items are immutable');
END;

CREATE TRIGGER trg_billing_settlement_item_no_delete
BEFORE DELETE ON billing_settlement_items
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Settlement items cannot be deleted');
END;

CREATE TRIGGER trg_billing_settlement_net_matches_items
BEFORE UPDATE OF ledger_transaction_id ON billing_settlements
FOR EACH ROW
WHEN NEW.ledger_transaction_id IS NOT NULL
 AND (
   (SELECT COALESCE(SUM(net_amount_minor),0) FROM billing_settlement_items WHERE settlement_id = NEW.id) <> NEW.net_amount_minor
   OR (SELECT COUNT(*) FROM billing_settlement_items WHERE settlement_id = NEW.id) = 0
 )
BEGIN
  SELECT RAISE(ABORT, 'Settlement ledger posting requires complete settlement items');
END;

CREATE TRIGGER trg_billing_settlement_ledger_currency
BEFORE UPDATE OF ledger_transaction_id ON billing_settlements
FOR EACH ROW
WHEN NEW.ledger_transaction_id IS NOT NULL
 AND EXISTS (
   SELECT 1 FROM billing_ledger_transactions t
   WHERE t.id = NEW.ledger_transaction_id AND t.currency <> NEW.settlement_currency
 )
BEGIN
  SELECT RAISE(ABORT, 'Settlement ledger currency mismatch');
END;
