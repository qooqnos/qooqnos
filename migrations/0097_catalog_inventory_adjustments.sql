-- Audited, versioned stock changes for existing inventory records only.
INSERT OR IGNORE INTO permissions (id, resource, action, created_at)
VALUES ('catalog.inventory.adjust', 'catalog.inventory', 'adjust', '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT granted.role_id, inventory_permission.id
  FROM role_permissions granted
  INNER JOIN permissions existing_permission ON existing_permission.id = granted.permission_id
  INNER JOIN permissions inventory_permission ON inventory_permission.id = 'catalog.inventory.adjust'
 WHERE existing_permission.id = 'catalog.product_variant.create';

CREATE TABLE inventory_adjustments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  product_variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  version_before INTEGER NOT NULL CHECK (version_before > 0),
  version_after INTEGER NOT NULL CHECK (version_after = version_before + 1),
  quantity_before INTEGER NOT NULL CHECK (quantity_before >= 0),
  quantity_after INTEGER NOT NULL CHECK (quantity_after >= 0),
  quantity_reserved INTEGER NOT NULL CHECK (quantity_reserved >= 0 AND quantity_reserved <= quantity_after),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 250),
  actor_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (inventory_item_id, version_after)
);

CREATE INDEX idx_inventory_adjustments_business_created
  ON inventory_adjustments (organization_id, workspace_id, business_id, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_inventory_adjustments_scope_insert
BEFORE INSERT ON inventory_adjustments
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM inventory_items ii
  INNER JOIN product_variants pv ON pv.id = ii.product_variant_id
  INNER JOIN products p ON p.id = pv.product_id
  INNER JOIN businesses b ON b.id = p.business_id
  WHERE ii.id = NEW.inventory_item_id
    AND ii.product_variant_id = NEW.product_variant_id
    AND ii.location_id = NEW.location_id
    AND p.business_id = NEW.business_id
    AND b.organization_id = NEW.organization_id
    AND b.workspace_id = NEW.workspace_id
    AND ii.version = NEW.version_after
    AND ii.quantity_on_hand = NEW.quantity_after
    AND ii.quantity_reserved = NEW.quantity_reserved
)
BEGIN
  SELECT RAISE(ABORT, 'Inventory adjustment must match the updated scoped inventory record');
END;

CREATE TRIGGER IF NOT EXISTS trg_inventory_adjustments_immutable_update
BEFORE UPDATE ON inventory_adjustments
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Inventory adjustment audit records are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_inventory_adjustments_immutable_delete
BEFORE DELETE ON inventory_adjustments
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Inventory adjustment audit records are immutable');
END;
