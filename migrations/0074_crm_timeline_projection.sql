-- Establish the canonical CRM timeline read model.
-- This table is rebuildable projection state; crm_timeline_events remains authoritative.

CREATE TABLE crm_timeline_projections (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  relationship_id TEXT NOT NULL REFERENCES customer_relationships(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  timeline_event_id TEXT NOT NULL UNIQUE REFERENCES crm_timeline_events(id) ON DELETE CASCADE,
  source_module TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL CHECK (event_version >= 1),
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  actor_reference TEXT,
  visibility TEXT NOT NULL,
  redaction_class TEXT NOT NULL,
  projection_version INTEGER NOT NULL CHECK (projection_version >= 1),
  projected_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(source_module, source_event_id)
);

CREATE INDEX idx_crm_timeline_projection_relationship_time
  ON crm_timeline_projections(relationship_id, occurred_at DESC, timeline_event_id DESC);

CREATE INDEX idx_crm_timeline_projection_customer_time
  ON crm_timeline_projections(customer_id, occurred_at DESC, timeline_event_id DESC);

CREATE INDEX idx_crm_timeline_projection_business_time
  ON crm_timeline_projections(business_id, occurred_at DESC, timeline_event_id DESC);

CREATE INDEX idx_crm_timeline_projection_workspace_time
  ON crm_timeline_projections(workspace_id, occurred_at DESC, timeline_event_id DESC);

CREATE TRIGGER IF NOT EXISTS trg_crm_timeline_projection_scope_insert
BEFORE INSERT ON crm_timeline_projections
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM customer_relationships cr
  INNER JOIN customers c ON c.id = cr.customer_id
  INNER JOIN businesses b ON b.id = cr.business_id
  INNER JOIN crm_timeline_events e ON e.id = NEW.timeline_event_id
  WHERE cr.id = NEW.relationship_id
    AND c.id = NEW.customer_id
    AND b.id = NEW.business_id
    AND e.relationship_id = NEW.relationship_id
    AND e.organization_id = NEW.organization_id
    AND e.workspace_id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'CRM timeline projection scope does not match source event');
END;

CREATE TRIGGER IF NOT EXISTS trg_crm_timeline_projection_scope_update
BEFORE UPDATE OF organization_id, workspace_id, relationship_id, customer_id, business_id, timeline_event_id
ON crm_timeline_projections
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM customer_relationships cr
  INNER JOIN customers c ON c.id = cr.customer_id
  INNER JOIN businesses b ON b.id = cr.business_id
  INNER JOIN crm_timeline_events e ON e.id = NEW.timeline_event_id
  WHERE cr.id = NEW.relationship_id
    AND c.id = NEW.customer_id
    AND b.id = NEW.business_id
    AND e.relationship_id = NEW.relationship_id
    AND e.organization_id = NEW.organization_id
    AND e.workspace_id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'CRM timeline projection scope does not match source event');
END;
