ALTER TABLE seller_ai_creation_sessions ADD COLUMN business_id TEXT REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE seller_ai_creation_sessions ADD COLUMN catalog_product_id TEXT REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE seller_ai_creation_sessions ADD COLUMN idempotency_key TEXT;
ALTER TABLE seller_ai_creation_sessions ADD COLUMN request_id TEXT;
ALTER TABLE seller_ai_creation_sessions ADD COLUMN correlation_id TEXT;
ALTER TABLE seller_ai_creation_sessions ADD COLUMN expires_at TEXT;

CREATE UNIQUE INDEX uq_seller_ai_sessions_scope_idempotency
  ON seller_ai_creation_sessions(organization_id, workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX idx_seller_ai_sessions_business
  ON seller_ai_creation_sessions(organization_id, workspace_id, business_id);

CREATE INDEX idx_seller_ai_sessions_catalog_product
  ON seller_ai_creation_sessions(catalog_product_id);
