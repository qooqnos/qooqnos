-- Enforce canonical Review target tenant/workspace scope on insert and update.

CREATE TRIGGER IF NOT EXISTS trg_reviews_business_scope_insert
BEFORE INSERT ON reviews
FOR EACH ROW
WHEN NEW.business_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1
  FROM businesses b
  WHERE b.id = NEW.business_id
    AND b.organization_id = NEW.organization_id
    AND (NEW.workspace_id IS NULL OR b.workspace_id = NEW.workspace_id)
 )
BEGIN
  SELECT RAISE(ABORT, 'Review business target crosses scope boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_reviews_offering_scope_insert
BEFORE INSERT ON reviews
FOR EACH ROW
WHEN NEW.offering_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1
  FROM offerings o
  INNER JOIN businesses b ON b.id = o.business_id
  WHERE o.id = NEW.offering_id
    AND b.organization_id = NEW.organization_id
    AND (NEW.workspace_id IS NULL OR b.workspace_id = NEW.workspace_id)
 )
BEGIN
  SELECT RAISE(ABORT, 'Review offering target crosses scope boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_reviews_product_scope_insert
BEFORE INSERT ON reviews
FOR EACH ROW
WHEN NEW.product_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1
  FROM products p
  INNER JOIN businesses b ON b.id = p.business_id
  WHERE p.id = NEW.product_id
    AND b.organization_id = NEW.organization_id
    AND (NEW.workspace_id IS NULL OR b.workspace_id = NEW.workspace_id)
 )
BEGIN
  SELECT RAISE(ABORT, 'Review product target crosses scope boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_reviews_workspace_scope_update
BEFORE UPDATE OF organization_id, workspace_id, customer_id ON reviews
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1
  FROM workspaces w
  WHERE w.id = NEW.workspace_id
    AND w.organization_id = NEW.organization_id
 )
BEGIN
  SELECT RAISE(ABORT, 'Review workspace crosses organization boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_reviews_business_scope_update
BEFORE UPDATE OF organization_id, workspace_id, business_id ON reviews
FOR EACH ROW
WHEN NEW.business_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1
  FROM businesses b
  WHERE b.id = NEW.business_id
    AND b.organization_id = NEW.organization_id
    AND (NEW.workspace_id IS NULL OR b.workspace_id = NEW.workspace_id)
 )
BEGIN
  SELECT RAISE(ABORT, 'Review business target crosses scope boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_reviews_offering_scope_update
BEFORE UPDATE OF organization_id, workspace_id, offering_id ON reviews
FOR EACH ROW
WHEN NEW.offering_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1
  FROM offerings o
  INNER JOIN businesses b ON b.id = o.business_id
  WHERE o.id = NEW.offering_id
    AND b.organization_id = NEW.organization_id
    AND (NEW.workspace_id IS NULL OR b.workspace_id = NEW.workspace_id)
 )
BEGIN
  SELECT RAISE(ABORT, 'Review offering target crosses scope boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_reviews_product_scope_update
BEFORE UPDATE OF organization_id, workspace_id, product_id ON reviews
FOR EACH ROW
WHEN NEW.product_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1
  FROM products p
  INNER JOIN businesses b ON b.id = p.business_id
  WHERE p.id = NEW.product_id
    AND b.organization_id = NEW.organization_id
    AND (NEW.workspace_id IS NULL OR b.workspace_id = NEW.workspace_id)
 )
BEGIN
  SELECT RAISE(ABORT, 'Review product target crosses scope boundary');
END;
