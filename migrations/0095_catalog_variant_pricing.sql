-- Add price overrides at the product-variant level while preserving offering-level base prices.
-- Existing prices remain offering-scoped because the new nullable column defaults to NULL.
ALTER TABLE prices
  ADD COLUMN product_variant_id TEXT REFERENCES product_variants(id) ON DELETE CASCADE;

CREATE INDEX idx_prices_variant_effective
  ON prices(offering_id, product_variant_id, status, effective_from, effective_to);

CREATE TRIGGER IF NOT EXISTS trg_prices_variant_matches_offering
BEFORE INSERT ON prices
FOR EACH ROW
WHEN NEW.product_variant_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1
     FROM product_variants pv
     INNER JOIN products p ON p.id = pv.product_id
     INNER JOIN offerings o ON o.product_id = p.id
    WHERE pv.id = NEW.product_variant_id
      AND o.id = NEW.offering_id
      AND o.offering_type = 'product'
      AND p.business_id = o.business_id
 )
BEGIN
  SELECT RAISE(ABORT, 'Variant price must belong to the offering product');
END;

CREATE TRIGGER IF NOT EXISTS trg_prices_variant_matches_offering_update
BEFORE UPDATE OF offering_id, product_variant_id ON prices
FOR EACH ROW
WHEN NEW.product_variant_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1
     FROM product_variants pv
     INNER JOIN products p ON p.id = pv.product_id
     INNER JOIN offerings o ON o.product_id = p.id
    WHERE pv.id = NEW.product_variant_id
      AND o.id = NEW.offering_id
      AND o.offering_type = 'product'
      AND p.business_id = o.business_id
 )
BEGIN
  SELECT RAISE(ABORT, 'Variant price must belong to the offering product');
END;
