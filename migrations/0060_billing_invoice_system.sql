-- Establish the canonical Billing invoice and immutable invoice-line boundary.
CREATE TABLE billing_invoices (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  business_id TEXT REFERENCES businesses(id) ON DELETE RESTRICT,
  customer_id TEXT REFERENCES customers(id) ON DELETE RESTRICT,
  order_id TEXT REFERENCES commerce_orders(id) ON DELETE RESTRICT,
  subscription_id TEXT REFERENCES billing_subscriptions(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','issued','partially_paid','paid','overdue','void')),
  currency TEXT NOT NULL,
  subtotal_minor INTEGER NOT NULL CHECK (subtotal_minor >= 0),
  adjustment_total_minor INTEGER NOT NULL DEFAULT 0,
  tax_total_minor INTEGER NOT NULL DEFAULT 0 CHECK (tax_total_minor >= 0),
  total_minor INTEGER NOT NULL CHECK (total_minor >= 0),
  amount_paid_minor INTEGER NOT NULL DEFAULT 0 CHECK (amount_paid_minor >= 0),
  amount_due_minor INTEGER NOT NULL DEFAULT 0 CHECK (amount_due_minor >= 0),
  issue_date TEXT,
  due_date TEXT,
  issued_at TEXT,
  paid_at TEXT,
  voided_at TEXT,
  notes TEXT,
  policy_version TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id, invoice_number),
  UNIQUE(organization_id, idempotency_key),
  CHECK (total_minor = subtotal_minor + adjustment_total_minor + tax_total_minor),
  CHECK (amount_paid_minor + amount_due_minor = total_minor),
  CHECK (issue_date IS NULL OR due_date IS NULL OR due_date >= issue_date)
);

CREATE INDEX idx_billing_invoices_scope_status
  ON billing_invoices(organization_id, workspace_id, status, created_at DESC);

CREATE INDEX idx_billing_invoices_business
  ON billing_invoices(business_id, created_at DESC);

CREATE INDEX idx_billing_invoices_customer
  ON billing_invoices(customer_id, created_at DESC);

CREATE INDEX idx_billing_invoices_order
  ON billing_invoices(order_id, created_at DESC);

CREATE INDEX idx_billing_invoices_subscription
  ON billing_invoices(subscription_id, created_at DESC);

CREATE TABLE billing_invoice_lines (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES billing_invoices(id) ON DELETE RESTRICT,
  line_number INTEGER NOT NULL CHECK (line_number > 0),
  description_snapshot TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
  line_subtotal_minor INTEGER NOT NULL CHECK (line_subtotal_minor >= 0),
  adjustment_total_minor INTEGER NOT NULL DEFAULT 0,
  tax_minor INTEGER NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  line_total_minor INTEGER NOT NULL CHECK (line_total_minor >= 0),
  tax_reference TEXT,
  discount_reference TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(invoice_id, line_number),
  CHECK (line_total_minor = line_subtotal_minor + adjustment_total_minor + tax_minor)
);

CREATE INDEX idx_billing_invoice_lines_invoice
  ON billing_invoice_lines(invoice_id, line_number);

CREATE TABLE billing_invoice_payment_applications (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES billing_invoices(id) ON DELETE RESTRICT,
  payment_reference TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(organization_id, idempotency_key)
);

CREATE INDEX idx_billing_invoice_payment_applications_invoice
  ON billing_invoice_payment_applications(invoice_id, applied_at DESC);

CREATE TRIGGER trg_billing_invoice_business_scope_insert
BEFORE INSERT ON billing_invoices
FOR EACH ROW
WHEN NEW.business_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1 FROM businesses b
  WHERE b.id = NEW.business_id
    AND b.organization_id = NEW.organization_id
    AND (NEW.workspace_id IS NULL OR b.workspace_id = NEW.workspace_id)
 )
BEGIN
  SELECT RAISE(ABORT, 'Billing invoice business crosses organization/workspace boundary');
END;

CREATE TRIGGER trg_billing_invoice_customer_scope_insert
BEFORE INSERT ON billing_invoices
FOR EACH ROW
WHEN NEW.customer_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1 FROM customers c
  WHERE c.id = NEW.customer_id
    AND c.organization_id = NEW.organization_id
 )
BEGIN
  SELECT RAISE(ABORT, 'Billing invoice customer crosses organization boundary');
END;

CREATE TRIGGER trg_billing_invoice_order_scope_insert
BEFORE INSERT ON billing_invoices
FOR EACH ROW
WHEN NEW.order_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1 FROM commerce_orders o
  WHERE o.id = NEW.order_id
    AND o.organization_id = NEW.organization_id
    AND (NEW.workspace_id IS NULL OR o.workspace_id = NEW.workspace_id)
 )
BEGIN
  SELECT RAISE(ABORT, 'Billing invoice order crosses organization/workspace boundary');
END;

CREATE TRIGGER trg_billing_invoice_subscription_scope_insert
BEFORE INSERT ON billing_invoices
FOR EACH ROW
WHEN NEW.subscription_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1 FROM billing_subscriptions s
  WHERE s.id = NEW.subscription_id
    AND s.organization_id = NEW.organization_id
    AND (NEW.workspace_id IS NULL OR s.workspace_id = NEW.workspace_id)
 )
BEGIN
  SELECT RAISE(ABORT, 'Billing invoice subscription crosses organization/workspace boundary');
END;

CREATE TRIGGER trg_billing_invoice_line_mutation_guard
BEFORE UPDATE OF invoice_id, line_number, description_snapshot, resource_type, resource_id,
  quantity, unit_price_minor, line_subtotal_minor, adjustment_total_minor, tax_minor,
  line_total_minor, tax_reference, discount_reference, metadata_json ON billing_invoice_lines
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM billing_invoices i
  WHERE i.id = OLD.invoice_id
    AND i.status <> 'draft'
)
BEGIN
  SELECT RAISE(ABORT, 'Issued Billing invoice lines are immutable');
END;

CREATE TRIGGER trg_billing_invoice_line_delete_guard
BEFORE DELETE ON billing_invoice_lines
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM billing_invoices i
  WHERE i.id = OLD.invoice_id
    AND i.status <> 'draft'
)
BEGIN
  SELECT RAISE(ABORT, 'Issued Billing invoice lines are immutable');
END;

CREATE TRIGGER trg_billing_invoice_update_guard
BEFORE UPDATE OF organization_id, workspace_id, business_id, customer_id, order_id,
  subscription_id, invoice_number, currency, subtotal_minor, adjustment_total_minor,
  tax_total_minor, total_minor, amount_paid_minor, amount_due_minor, issue_date,
  due_date, policy_version, idempotency_key, correlation_id, notes ON billing_invoices
FOR EACH ROW
WHEN OLD.status <> 'draft'
BEGIN
  SELECT RAISE(ABORT, 'Issued Billing invoices are immutable');
END;

CREATE TRIGGER trg_billing_invoice_delete_guard
BEFORE DELETE ON billing_invoices
FOR EACH ROW
WHEN OLD.status <> 'draft'
BEGIN
  SELECT RAISE(ABORT, 'Issued Billing invoices cannot be deleted');
END;

CREATE TRIGGER trg_billing_invoice_payment_currency
BEFORE INSERT ON billing_invoice_payment_applications
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM billing_invoices i
  WHERE i.id = NEW.invoice_id
    AND i.currency <> NEW.currency
)
BEGIN
  SELECT RAISE(ABORT, 'Invoice payment currency does not match invoice currency');
END;

CREATE TRIGGER trg_billing_invoice_payment_scope
BEFORE INSERT ON billing_invoice_payment_applications
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM billing_invoices i
  WHERE i.id = NEW.invoice_id
)
BEGIN
  SELECT RAISE(ABORT, 'Invoice payment application references missing invoice');
END;
