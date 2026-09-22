-- Establish the canonical Customer ↔ Business relationship aggregate.
-- CRM owns relationship state; Customer remains the canonical customer identity.

CREATE TABLE customer_relationships (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('prospect','active','inactive')),
  first_interaction_at TEXT,
  last_interaction_at TEXT,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(customer_id, business_id, relationship_type),
  CHECK (
    first_interaction_at IS NULL
    OR last_interaction_at IS NULL
    OR last_interaction_at >= first_interaction_at
  )
);

CREATE INDEX idx_customer_relationships_customer_status
  ON customer_relationships(customer_id, status);

CREATE INDEX idx_customer_relationships_business_status
  ON customer_relationships(business_id, status);

CREATE INDEX idx_customer_relationships_business_type
  ON customer_relationships(business_id, relationship_type);

CREATE TRIGGER IF NOT EXISTS trg_customer_relationship_organization_insert
BEFORE INSERT ON customer_relationships
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM customers c
  INNER JOIN businesses b ON b.organization_id = c.organization_id
  WHERE c.id = NEW.customer_id
    AND b.id = NEW.business_id
)
BEGIN
  SELECT RAISE(ABORT, 'Customer relationship crosses organization boundaries');
END;

CREATE TRIGGER IF NOT EXISTS trg_customer_relationship_organization_update
BEFORE UPDATE OF customer_id, business_id ON customer_relationships
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM customers c
  INNER JOIN businesses b ON b.organization_id = c.organization_id
  WHERE c.id = NEW.customer_id
    AND b.id = NEW.business_id
)
BEGIN
  SELECT RAISE(ABORT, 'Customer relationship crosses organization boundaries');
END;
