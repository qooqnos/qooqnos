-- Harden Business.primary_category_id without introducing a duplicate category relationship.
-- The referenced category must exist, and a category referenced as a Business
-- primary category cannot be deleted. Scope compatibility remains a domain-policy
-- concern because categories currently encode scope without tenant owner columns.
CREATE TRIGGER IF NOT EXISTS trg_business_primary_category_exists_insert
BEFORE INSERT ON businesses
FOR EACH ROW
WHEN NEW.primary_category_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.id = NEW.primary_category_id
)
BEGIN
  SELECT RAISE(ABORT, 'Business primary category references an unknown category');
END;

CREATE TRIGGER IF NOT EXISTS trg_business_primary_category_exists_update
BEFORE UPDATE OF primary_category_id ON businesses
FOR EACH ROW
WHEN NEW.primary_category_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.id = NEW.primary_category_id
)
BEGIN
  SELECT RAISE(ABORT, 'Business primary category references an unknown category');
END;

CREATE TRIGGER IF NOT EXISTS trg_category_primary_business_delete
BEFORE DELETE ON categories
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM businesses b WHERE b.primary_category_id = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'Category is referenced as a Business primary category');
END;
