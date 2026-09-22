-- Establish canonical marketplace Customer identity and preference state.
-- Authentication remains owned by Identity; user_id is only an optional mapping.

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('active','suspended','deactivated')),
  locale TEXT,
  timezone TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id, user_id)
);

CREATE TABLE customer_preferences (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  attribute TEXT NOT NULL,
  value_reference TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  persistence TEXT NOT NULL,
  consent_scope TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT
);

CREATE INDEX idx_customers_organization_status
  ON customers(organization_id, status);

CREATE INDEX idx_customers_user
  ON customers(user_id);

CREATE INDEX idx_customer_preferences_customer
  ON customer_preferences(customer_id, expires_at);

CREATE INDEX idx_customer_preferences_attribute
  ON customer_preferences(customer_id, attribute);
