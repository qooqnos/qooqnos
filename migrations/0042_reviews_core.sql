-- Establish Trust Review storage using only target types present in the canonical Review target contract.
CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  rating_value INTEGER NOT NULL CHECK (rating_value >= 1 AND rating_value <= 5),
  content TEXT,
  moderation_state TEXT NOT NULL,
  business_id TEXT REFERENCES businesses(id) ON DELETE RESTRICT,
  offering_id TEXT REFERENCES offerings(id) ON DELETE RESTRICT,
  product_id TEXT REFERENCES products(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((business_id IS NOT NULL) + (offering_id IS NOT NULL) + (product_id IS NOT NULL) = 1)
);

CREATE INDEX idx_reviews_customer_time ON reviews(customer_id, created_at DESC);
CREATE INDEX idx_reviews_business_id ON reviews(business_id);
CREATE INDEX idx_reviews_offering_id ON reviews(offering_id);
CREATE INDEX idx_reviews_product_id ON reviews(product_id);

CREATE TRIGGER IF NOT EXISTS trg_reviews_scope_insert
BEFORE INSERT ON reviews
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM customers c
  WHERE c.id = NEW.customer_id
    AND c.organization_id = NEW.organization_id
)
BEGIN
  SELECT RAISE(ABORT, 'Review customer crosses organization boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_reviews_workspace_scope_insert
BEFORE INSERT ON reviews
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1 FROM workspaces w
  WHERE w.id = NEW.workspace_id
    AND w.organization_id = NEW.organization_id
 )
BEGIN
  SELECT RAISE(ABORT, 'Review workspace crosses organization boundary');
END;
