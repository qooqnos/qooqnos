-- Enforce Catalog's authoritative business lifecycle invariant at the database boundary.
-- Product creation is valid only for businesses that are still editable.
CREATE TRIGGER IF NOT EXISTS trg_products_business_editable
BEFORE INSERT ON products
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM businesses
  WHERE id = NEW.business_id
    AND status IN ('draft', 'active')
)
BEGIN
  SELECT RAISE(ABORT, 'Business is not available for catalog changes');
END;
