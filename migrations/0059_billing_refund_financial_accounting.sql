-- Establish canonical Billing refund execution references and double-entry financial accounting.
CREATE TABLE billing_refunds (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  business_id TEXT REFERENCES businesses(id) ON DELETE RESTRICT,
  payment_reference TEXT NOT NULL,
  order_reference TEXT,
  requested_amount_minor INTEGER NOT NULL CHECK (requested_amount_minor > 0),
  refunded_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (refunded_amount_minor >= 0),
  currency TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('requested','approved','processing','succeeded','failed','cancelled')
  ),
  provider TEXT,
  provider_reference TEXT,
  provider_status TEXT,
  ledger_transaction_id TEXT,
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
  CHECK (refunded_amount_minor <= requested_amount_minor),
  CHECK (length(trim(payment_reference)) > 0),
  CHECK (length(currency) = 3 AND currency = upper(currency)),
  UNIQUE(organization_id, idempotency_key)
);

CREATE INDEX idx_billing_refunds_payment
  ON billing_refunds(organization_id, payment_reference, created_at DESC);

CREATE INDEX idx_billing_refunds_status
  ON billing_refunds(organization_id, status, created_at DESC);

CREATE TRIGGER trg_billing_refunds_business_scope_insert
BEFORE INSERT ON billing_refunds
FOR EACH ROW
WHEN NEW.business_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1 FROM businesses b
  WHERE b.id = NEW.business_id
    AND b.organization_id = NEW.organization_id
    AND (NEW.workspace_id IS NULL OR b.workspace_id = NEW.workspace_id)
 )
BEGIN
  SELECT RAISE(ABORT, 'Billing refund crosses organization/workspace boundary');
END;

CREATE TABLE billing_ledger_accounts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  business_id TEXT REFERENCES businesses(id) ON DELETE RESTRICT,
  account_code TEXT NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (
    account_type IN ('asset','liability','equity','revenue','expense')
  ),
  currency TEXT NOT NULL,
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit','credit')),
  status TEXT NOT NULL CHECK (status IN ('active','closed')),
  parent_account_id TEXT REFERENCES billing_ledger_accounts(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (length(currency) = 3 AND currency = upper(currency)),
  UNIQUE(organization_id, workspace_id, business_id, account_code)
);

CREATE INDEX idx_billing_ledger_accounts_scope
  ON billing_ledger_accounts(organization_id, workspace_id, business_id, status);

CREATE TABLE billing_ledger_transactions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  business_id TEXT REFERENCES businesses(id) ON DELETE RESTRICT,
  transaction_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(organization_id, idempotency_key),
  UNIQUE(organization_id, source_type, source_id, transaction_type),
  CHECK (length(currency) = 3 AND currency = upper(currency))
);

CREATE INDEX idx_billing_ledger_transactions_source
  ON billing_ledger_transactions(organization_id, source_type, source_id, occurred_at DESC);

CREATE TABLE billing_ledger_entries (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES billing_ledger_transactions(id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL REFERENCES billing_ledger_accounts(id) ON DELETE RESTRICT,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  business_id TEXT REFERENCES businesses(id) ON DELETE RESTRICT,
  direction TEXT NOT NULL CHECK (direction IN ('debit','credit')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL,
  source_reference TEXT NOT NULL,
  reversal_of_entry_id TEXT REFERENCES billing_ledger_entries(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  CHECK (length(currency) = 3 AND currency = upper(currency))
);

CREATE INDEX idx_billing_ledger_entries_transaction
  ON billing_ledger_entries(transaction_id, id);

CREATE INDEX idx_billing_ledger_entries_account_time
  ON billing_ledger_entries(account_id, created_at DESC, id);

CREATE TRIGGER trg_billing_ledger_entry_scope_insert
BEFORE INSERT ON billing_ledger_entries
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM billing_ledger_accounts a
  WHERE a.id = NEW.account_id
    AND a.organization_id = NEW.organization_id
    AND (a.workspace_id IS NULL OR a.workspace_id = NEW.workspace_id)
    AND (a.business_id IS NULL OR a.business_id = NEW.business_id)
    AND a.currency = NEW.currency
)
BEGIN
  SELECT RAISE(ABORT, 'Ledger entry account crosses financial scope or currency');
END;

CREATE TRIGGER trg_billing_ledger_transaction_scope_insert
BEFORE INSERT ON billing_ledger_transactions
FOR EACH ROW
WHEN NEW.business_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1 FROM businesses b
  WHERE b.id = NEW.business_id
    AND b.organization_id = NEW.organization_id
    AND (NEW.workspace_id IS NULL OR b.workspace_id = NEW.workspace_id)
 )
BEGIN
  SELECT RAISE(ABORT, 'Ledger transaction crosses organization/workspace boundary');
END;

CREATE TRIGGER trg_billing_ledger_transaction_no_update
BEFORE UPDATE ON billing_ledger_transactions
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Posted ledger transactions are immutable');
END;

CREATE TRIGGER trg_billing_ledger_transaction_no_delete
BEFORE DELETE ON billing_ledger_transactions
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Posted ledger transactions cannot be deleted');
END;

CREATE TRIGGER trg_billing_ledger_entry_no_update
BEFORE UPDATE ON billing_ledger_entries
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Ledger entries are immutable');
END;

CREATE TRIGGER trg_billing_ledger_entry_no_delete
BEFORE DELETE ON billing_ledger_entries
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Ledger entries cannot be deleted');
END;

CREATE TRIGGER trg_billing_refund_ledger_currency
BEFORE UPDATE OF ledger_transaction_id, currency ON billing_refunds
FOR EACH ROW
WHEN NEW.ledger_transaction_id IS NOT NULL
 AND EXISTS (
  SELECT 1 FROM billing_ledger_transactions t
  WHERE t.id = NEW.ledger_transaction_id
    AND t.currency <> NEW.currency
 )
BEGIN
  SELECT RAISE(ABORT, 'Refund ledger transaction currency mismatch');
END;
