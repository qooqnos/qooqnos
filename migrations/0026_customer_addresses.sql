-- Establish canonical structured CustomerAddress storage.
CREATE TABLE customer_addresses (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  country_code TEXT NOT NULL,
  administrative_area TEXT,
  locality TEXT,
  district TEXT,
  postal_code TEXT,
  street_line_1 TEXT,
  street_line_2 TEXT,
  building_number TEXT,
  unit TEXT,
  formatted TEXT,
  locale TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_customer_addresses_customer
  ON customer_addresses(customer_id, created_at DESC);

CREATE INDEX idx_customer_addresses_country_locality
  ON customer_addresses(country_code, locality);

CREATE TRIGGER IF NOT EXISTS trg_customer_address_insert_scope
BEFORE INSERT ON customer_addresses
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM customers c
  WHERE c.id = NEW.customer_id
)
BEGIN
  SELECT RAISE(ABORT, 'Customer address references an unknown customer');
END;

CREATE TRIGGER IF NOT EXISTS trg_customer_address_update_scope
BEFORE UPDATE OF customer_id ON customer_addresses
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM customers c
  WHERE c.id = NEW.customer_id
)
BEGIN
  SELECT RAISE(ABORT, 'Customer address references an unknown customer');
END;
