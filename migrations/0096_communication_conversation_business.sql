-- Bind seller-originated inbox identity to the canonical business record.
-- Existing conversations remain unassigned instead of guessing from shared workspaces.
ALTER TABLE communication_conversations
  ADD COLUMN business_id TEXT REFERENCES businesses(id) ON DELETE RESTRICT;

CREATE INDEX idx_communication_conversations_business_customer
  ON communication_conversations(organization_id, workspace_id, business_id, customer_id, status, updated_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_communication_conversation_business_scope_insert
BEFORE INSERT ON communication_conversations
FOR EACH ROW
WHEN NEW.business_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM businesses b
    WHERE b.id = NEW.business_id
      AND b.organization_id = NEW.organization_id
      AND b.workspace_id = NEW.workspace_id
 )
BEGIN
  SELECT RAISE(ABORT, 'Communication conversation business must match organization and workspace');
END;

CREATE TRIGGER IF NOT EXISTS trg_communication_conversation_business_scope_update
BEFORE UPDATE OF business_id, organization_id, workspace_id ON communication_conversations
FOR EACH ROW
WHEN NEW.business_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM businesses b
    WHERE b.id = NEW.business_id
      AND b.organization_id = NEW.organization_id
      AND b.workspace_id = NEW.workspace_id
 )
BEGIN
  SELECT RAISE(ABORT, 'Communication conversation business must match organization and workspace');
END;
