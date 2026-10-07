-- Establish the canonical prepaid AI wallet and versioned Arvan token pricing boundary.
CREATE TABLE billing_ai_wallets (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  currency TEXT NOT NULL,
  balance_minor INTEGER NOT NULL DEFAULT 0 CHECK (balance_minor >= 0),
  reserved_minor INTEGER NOT NULL DEFAULT 0 CHECK (reserved_minor >= 0),
  status TEXT NOT NULL CHECK (status IN ('active','suspended','closed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (reserved_minor <= balance_minor),
  UNIQUE(id)
);

CREATE UNIQUE INDEX uq_billing_ai_wallet_scope
  ON billing_ai_wallets(
    organization_id,
    COALESCE(workspace_id, ''),
    user_id,
    currency
  );

CREATE INDEX idx_billing_ai_wallet_scope
  ON billing_ai_wallets(organization_id, workspace_id, user_id, status);

CREATE TRIGGER trg_billing_ai_wallet_scope_insert
BEFORE INSERT ON billing_ai_wallets
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1
  FROM workspaces w
  WHERE w.id = NEW.workspace_id
    AND w.organization_id = NEW.organization_id
 )
BEGIN
  SELECT RAISE(ABORT, 'AI wallet workspace crosses organization boundary');
END;

CREATE TABLE billing_ai_wallet_events (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL REFERENCES billing_ai_wallets(id) ON DELETE RESTRICT,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('topup','reservation','reservation_release','ai_charge','refund','adjustment')
  ),
  balance_delta_minor INTEGER NOT NULL,
  reserved_delta_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  operation_id TEXT,
  provider_id TEXT,
  model_id TEXT,
  pricing_reference TEXT,
  provider_cost_minor INTEGER CHECK (provider_cost_minor IS NULL OR provider_cost_minor >= 0),
  markup_minor INTEGER CHECK (markup_minor IS NULL OR markup_minor >= 0),
  customer_charge_minor INTEGER CHECK (customer_charge_minor IS NULL OR customer_charge_minor >= 0),
  idempotency_key TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  metadata_json TEXT,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX uq_billing_ai_wallet_event_idempotency
  ON billing_ai_wallet_events(wallet_id, idempotency_key);

CREATE INDEX idx_billing_ai_wallet_events_wallet_time
  ON billing_ai_wallet_events(wallet_id, occurred_at DESC, id DESC);

CREATE INDEX idx_billing_ai_wallet_events_operation
  ON billing_ai_wallet_events(operation_id, created_at DESC);

CREATE TRIGGER trg_billing_ai_wallet_event_no_update
BEFORE UPDATE ON billing_ai_wallet_events
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'AI wallet events are append-only');
END;

CREATE TRIGGER trg_billing_ai_wallet_event_no_delete
BEFORE DELETE ON billing_ai_wallet_events
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'AI wallet events cannot be deleted');
END;

CREATE TRIGGER trg_billing_ai_wallet_event_scope_insert
BEFORE INSERT ON billing_ai_wallet_events
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM billing_ai_wallets w
  WHERE w.id = NEW.wallet_id
    AND w.organization_id = NEW.organization_id
    AND (w.workspace_id IS NEW.workspace_id)
    AND w.user_id = NEW.user_id
    AND w.currency = NEW.currency
)
BEGIN
  SELECT RAISE(ABORT, 'AI wallet event scope mismatch');
END;

CREATE TABLE billing_ai_model_prices (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  input_amount_per_million_minor INTEGER NOT NULL CHECK (input_amount_per_million_minor >= 0),
  output_amount_per_million_minor INTEGER NOT NULL CHECK (output_amount_per_million_minor >= 0),
  markup_bps INTEGER NOT NULL DEFAULT 5000 CHECK (markup_bps BETWEEN 0 AND 100000),
  pricing_version TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  status TEXT NOT NULL CHECK (status IN ('active','retired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX uq_billing_ai_model_prices_version
  ON billing_ai_model_prices(provider_id, model_id, currency, pricing_version);

CREATE INDEX idx_billing_ai_model_prices_active
  ON billing_ai_model_prices(provider_id, model_id, currency, status, effective_from DESC);

CREATE TRIGGER trg_billing_ai_model_price_single_active
BEFORE INSERT ON billing_ai_model_prices
FOR EACH ROW
WHEN NEW.status = 'active'
 AND EXISTS (
  SELECT 1
  FROM billing_ai_model_prices p
  WHERE p.provider_id = NEW.provider_id
    AND p.model_id = NEW.model_id
    AND p.currency = NEW.currency
    AND p.status = 'active'
    AND (p.effective_to IS NULL OR p.effective_to > NEW.effective_from)
    AND (NEW.effective_to IS NULL OR NEW.effective_to > p.effective_from)
)
BEGIN
  SELECT RAISE(ABORT, 'Overlapping active AI model pricing');
END;
