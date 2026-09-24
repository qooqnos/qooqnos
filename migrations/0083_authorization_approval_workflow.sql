-- Authorization governance: explicit approval requests with immutable requester/approver separation.
CREATE TABLE approval_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  requested_by TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  required_approver_role TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','cancelled','expired')),
  decided_by TEXT,
  decision_reason TEXT,
  idempotency_key TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, workspace_id, idempotency_key)
);

CREATE INDEX idx_approval_requests_pending ON approval_requests(organization_id, workspace_id, status, created_at);
CREATE INDEX idx_approval_requests_resource ON approval_requests(organization_id, workspace_id, resource_type, resource_id, status);

CREATE TRIGGER trg_approval_request_workspace_scope
BEFORE INSERT ON approval_requests
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM workspaces w WHERE w.id=NEW.workspace_id AND w.organization_id=NEW.organization_id
)
BEGIN SELECT RAISE(ABORT,'Approval request workspace crosses organization boundary'); END;

CREATE TRIGGER trg_approval_request_decision_separation
BEFORE UPDATE OF status, decided_by ON approval_requests
FOR EACH ROW
WHEN NEW.status IN ('approved','rejected') AND NEW.decided_by = NEW.requested_by
BEGIN SELECT RAISE(ABORT,'Approval request violates separation of duties'); END;
