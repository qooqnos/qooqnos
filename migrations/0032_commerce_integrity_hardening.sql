-- Tighten Commerce cross-tenant integrity without changing migration 0031.
DROP INDEX IF EXISTS uq_commerce_price_snapshot_context;

CREATE UNIQUE INDEX uq_commerce_price_snapshot_context
  ON commerce_price_snapshots(
    organization_id,
    COALESCE(workspace_id, ''),
    calculation_context_hash
  );

CREATE TRIGGER IF NOT EXISTS trg_commerce_cart_customer_scope_insert
BEFORE INSERT ON commerce_carts
FOR EACH ROW
WHEN NEW.customer_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1
   FROM customers c
   WHERE c.id = NEW.customer_id
     AND c.organization_id = NEW.organization_id
 )
BEGIN
  SELECT RAISE(ABORT, 'Commerce cart customer crosses organization boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_commerce_cart_customer_scope_update
BEFORE UPDATE OF organization_id, customer_id ON commerce_carts
FOR EACH ROW
WHEN NEW.customer_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1
   FROM customers c
   WHERE c.id = NEW.customer_id
     AND c.organization_id = NEW.organization_id
 )
BEGIN
  SELECT RAISE(ABORT, 'Commerce cart customer crosses organization boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_commerce_order_event_scope_insert
BEFORE INSERT ON commerce_order_events
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM commerce_orders o
  WHERE o.id = NEW.order_id
    AND o.organization_id = NEW.tenant_id
    AND o.workspace_id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'Commerce order event scope does not match order');
END;
