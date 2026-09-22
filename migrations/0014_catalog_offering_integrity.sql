-- Harden the canonical Catalog Offer model without introducing duplicate entities.
-- An Offering must reference exactly one typed Service or Product belonging to its Business.
CREATE TRIGGER IF NOT EXISTS trg_offerings_type_service_product_insert
BEFORE INSERT ON offerings
FOR EACH ROW
WHEN
  (NEW.offering_type = 'service' AND (NEW.service_id IS NULL OR NEW.product_id IS NOT NULL))
  OR
  (NEW.offering_type = 'product' AND (NEW.product_id IS NULL OR NEW.service_id IS NOT NULL))
BEGIN
  SELECT RAISE(ABORT, 'Offering type must match exactly one underlying catalog entity');
END;

CREATE TRIGGER IF NOT EXISTS trg_offerings_type_service_product_update
BEFORE UPDATE OF offering_type, service_id, product_id ON offerings
FOR EACH ROW
WHEN
  (NEW.offering_type = 'service' AND (NEW.service_id IS NULL OR NEW.product_id IS NOT NULL))
  OR
  (NEW.offering_type = 'product' AND (NEW.product_id IS NULL OR NEW.service_id IS NOT NULL))
BEGIN
  SELECT RAISE(ABORT, 'Offering type must match exactly one underlying catalog entity');
END;

CREATE TRIGGER IF NOT EXISTS trg_offerings_service_business_match_update
BEFORE UPDATE OF business_id, service_id ON offerings
FOR EACH ROW
WHEN NEW.service_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM services s
  WHERE s.id = NEW.service_id
    AND s.business_id IS NOT NULL
    AND s.business_id <> NEW.business_id
)
BEGIN
  SELECT RAISE(ABORT, 'Service does not belong to the offering business');
END;

CREATE TRIGGER IF NOT EXISTS trg_offerings_product_business_match_update
BEFORE UPDATE OF business_id, product_id ON offerings
FOR EACH ROW
WHEN NEW.product_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM products p
  WHERE p.id = NEW.product_id
    AND p.business_id = NEW.business_id
)
BEGIN
  SELECT RAISE(ABORT, 'Product does not belong to the offering business');
END;

CREATE TRIGGER IF NOT EXISTS trg_offerings_service_exists_insert
BEFORE INSERT ON offerings
FOR EACH ROW
WHEN NEW.offering_type = 'service' AND NOT EXISTS (
  SELECT 1 FROM services s WHERE s.id = NEW.service_id
)
BEGIN
  SELECT RAISE(ABORT, 'Service offering references an unknown service');
END;

CREATE TRIGGER IF NOT EXISTS trg_offerings_service_exists_update
BEFORE UPDATE OF offering_type, service_id ON offerings
FOR EACH ROW
WHEN NEW.offering_type = 'service' AND NOT EXISTS (
  SELECT 1 FROM services s WHERE s.id = NEW.service_id
)
BEGIN
  SELECT RAISE(ABORT, 'Service offering references an unknown service');
END;

CREATE TRIGGER IF NOT EXISTS trg_offerings_product_exists_insert
BEFORE INSERT ON offerings
FOR EACH ROW
WHEN NEW.offering_type = 'product' AND NOT EXISTS (
  SELECT 1 FROM products p WHERE p.id = NEW.product_id
)
BEGIN
  SELECT RAISE(ABORT, 'Product offering references an unknown product');
END;

CREATE TRIGGER IF NOT EXISTS trg_offerings_product_exists_update
BEFORE UPDATE OF offering_type, product_id ON offerings
FOR EACH ROW
WHEN NEW.offering_type = 'product' AND NOT EXISTS (
  SELECT 1 FROM products p WHERE p.id = NEW.product_id
)
BEGIN
  SELECT RAISE(ABORT, 'Product offering references an unknown product');
END;
