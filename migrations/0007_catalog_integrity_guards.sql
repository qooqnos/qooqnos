-- Cross-aggregate integrity that cannot be expressed by the existing simple foreign keys.
CREATE TRIGGER IF NOT EXISTS trg_product_variants_sku_business_unique
BEFORE INSERT ON product_variants
FOR EACH ROW
WHEN NEW.sku IS NOT NULL AND EXISTS (
  SELECT 1
  FROM product_variants pv
  INNER JOIN products p ON p.id = pv.product_id
  INNER JOIN products new_product ON new_product.id = NEW.product_id
  WHERE p.business_id = new_product.business_id
    AND pv.sku = NEW.sku
)
BEGIN
  SELECT RAISE(ABORT, 'SKU already exists in this business');
END;

CREATE TRIGGER IF NOT EXISTS trg_product_variants_sku_business_unique_update
BEFORE UPDATE OF product_id, sku ON product_variants
FOR EACH ROW
WHEN NEW.sku IS NOT NULL AND EXISTS (
  SELECT 1
  FROM product_variants pv
  INNER JOIN products p ON p.id = pv.product_id
  INNER JOIN products new_product ON new_product.id = NEW.product_id
  WHERE p.business_id = new_product.business_id
    AND pv.sku = NEW.sku
    AND pv.id <> NEW.id
)
BEGIN
  SELECT RAISE(ABORT, 'SKU already exists in this business');
END;

CREATE TRIGGER IF NOT EXISTS trg_offerings_service_business_match
BEFORE INSERT ON offerings
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

CREATE TRIGGER IF NOT EXISTS trg_offerings_product_business_match
BEFORE INSERT ON offerings
FOR EACH ROW
WHEN NEW.product_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM products p WHERE p.id = NEW.product_id AND p.business_id = NEW.business_id
)
BEGIN
  SELECT RAISE(ABORT, 'Product does not belong to the offering business');
END;
