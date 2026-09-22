-- Establish the canonical provider-neutral Communication delivery boundary.
CREATE TABLE communication_conversations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  customer_id TEXT REFERENCES customers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('open','closed','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_communication_conversations_customer_status
  ON communication_conversations(customer_id, status, updated_at DESC);

CREATE TABLE communication_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES communication_conversations(id) ON DELETE RESTRICT,
  sender_reference TEXT NOT NULL,
  content TEXT NOT NULL,
  classification TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('created','policy_checked','queued','provider_accepted','sent','delivered','read','failed','rejected','expired','cancelled','suppressed')
  ),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_communication_messages_conversation_time
  ON communication_messages(conversation_id, created_at DESC, id DESC);

CREATE TABLE communication_notifications (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  recipient_reference TEXT NOT NULL,
  intent TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','whatsapp','sms','email')),
  template_reference TEXT,
  template_version TEXT,
  locale TEXT,
  variables_json TEXT,
  priority TEXT NOT NULL CHECK (priority IN ('low','normal','high','urgent')),
  status TEXT NOT NULL CHECK (
    status IN ('created','policy_checked','queued','provider_accepted','sent','delivered','read','failed','rejected','expired','cancelled','suppressed')
  ),
  idempotency_key TEXT NOT NULL,
  scheduled_at TEXT,
  expires_at TEXT,
  last_policy_evaluated_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id, idempotency_key)
);

CREATE INDEX idx_communication_notifications_recipient_status
  ON communication_notifications(recipient_reference, status, created_at DESC);

CREATE INDEX idx_communication_notifications_scheduled
  ON communication_notifications(status, scheduled_at);

CREATE TABLE communication_delivery_attempts (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL REFERENCES communication_notifications(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','whatsapp','sms','email')),
  status TEXT NOT NULL CHECK (
    status IN ('accepted','queued','sent','delivered','read','failed','rejected','expired')
  ),
  attempted_at TEXT NOT NULL,
  provider_reference TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  next_retry_at TEXT,
  failure_code TEXT,
  failure_class TEXT CHECK (failure_class IS NULL OR failure_class IN ('transient','permanent')),
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_communication_delivery_attempts_notification_time
  ON communication_delivery_attempts(notification_id, attempted_at DESC, id DESC);

CREATE TRIGGER IF NOT EXISTS trg_communication_message_scope_insert
BEFORE INSERT ON communication_messages
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM communication_conversations c
  WHERE c.id = NEW.conversation_id
)
BEGIN
  SELECT RAISE(ABORT, 'Communication message references an unknown conversation');
END;

CREATE TRIGGER IF NOT EXISTS trg_communication_notification_scope_insert
BEFORE INSERT ON communication_notifications
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1 FROM workspaces w
  WHERE w.id = NEW.workspace_id
    AND w.organization_id = NEW.organization_id
 )
BEGIN
  SELECT RAISE(ABORT, 'Communication notification workspace crosses organization boundary');
END;
