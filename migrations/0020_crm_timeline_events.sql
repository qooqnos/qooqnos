-- Establish the canonical CRM timeline event store.
-- CRM stores normalized event references/projections; the originating domain remains
-- authoritative for the underlying business fact.

CREATE TABLE crm_timeline_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  relationship_id TEXT NOT NULL REFERENCES customer_relationships(id) ON DELETE CASCADE,
  source_module TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL CHECK (event_version >= 1),
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  actor_reference TEXT,
  visibility TEXT NOT NULL,
  redaction_class TEXT NOT NULL,
  payload_json TEXT,
  projection_version INTEGER NOT NULL CHECK (projection_version >= 1),
  UNIQUE(source_module, source_event_id)
);

CREATE INDEX idx_crm_timeline_relationship_time
  ON crm_timeline_events(relationship_id, occurred_at DESC, id DESC);

CREATE INDEX idx_crm_timeline_workspace_time
  ON crm_timeline_events(workspace_id, occurred_at DESC, id DESC);

CREATE INDEX idx_crm_timeline_source
  ON crm_timeline_events(source_module, source_event_id);

CREATE TRIGGER IF NOT EXISTS trg_crm_timeline_scope_insert
BEFORE INSERT ON crm_timeline_events
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM customer_relationships cr
  INNER JOIN customers c ON c.id = cr.customer_id
  INNER JOIN businesses b ON b.id = cr.business_id
  WHERE cr.id = NEW.relationship_id
    AND c.organization_id = NEW.organization_id
    AND b.organization_id = NEW.organization_id
    AND b.workspace_id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'CRM timeline event scope does not match relationship');
END;

CREATE TRIGGER IF NOT EXISTS trg_crm_timeline_scope_update
BEFORE UPDATE OF organization_id, workspace_id, relationship_id ON crm_timeline_events
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM customer_relationships cr
  INNER JOIN customers c ON c.id = cr.customer_id
  INNER JOIN businesses b ON b.id = cr.business_id
  WHERE cr.id = NEW.relationship_id
    AND c.organization_id = NEW.organization_id
    AND b.organization_id = NEW.organization_id
    AND b.workspace_id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'CRM timeline event scope does not match relationship');
END;
