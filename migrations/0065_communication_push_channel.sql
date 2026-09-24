-- Expand the canonical Communication channel vocabulary with push delivery.
-- SQLite CHECK constraints are immutable, so the affected tables are rebuilt in-place.
DROP TRIGGER IF EXISTS trg_communication_notification_scope_insert;
DROP TRIGGER IF EXISTS trg_communication_notification_policy_insert;

ALTER TABLE communication_notifications RENAME TO communication_notifications_legacy;
CREATE TABLE communication_notifications (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  recipient_reference TEXT NOT NULL,
  intent TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','whatsapp','sms','email','push')),
  template_reference TEXT,
  template_version TEXT,
  locale TEXT,
  variables_json TEXT,
  priority TEXT NOT NULL CHECK (priority IN ('low','normal','high','urgent')),
  status TEXT NOT NULL CHECK (status IN ('created','policy_checked','queued','provider_accepted','sent','delivered','read','failed','rejected','expired','cancelled','suppressed')),
  idempotency_key TEXT NOT NULL,
  scheduled_at TEXT,
  expires_at TEXT,
  last_policy_evaluated_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  policy_version TEXT,
  UNIQUE(organization_id, idempotency_key)
);
INSERT INTO communication_notifications SELECT * FROM communication_notifications_legacy;
DROP TABLE communication_notifications_legacy;
CREATE INDEX idx_communication_notifications_recipient_status
  ON communication_notifications(recipient_reference, status, created_at DESC);
CREATE INDEX idx_communication_notifications_scheduled
  ON communication_notifications(status, scheduled_at);

ALTER TABLE communication_delivery_attempts RENAME TO communication_delivery_attempts_legacy;
CREATE TABLE communication_delivery_attempts (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL REFERENCES communication_notifications(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','whatsapp','sms','email','push')),
  status TEXT NOT NULL CHECK (status IN ('accepted','queued','sent','delivered','read','failed','rejected','expired')),
  attempted_at TEXT NOT NULL,
  provider_reference TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  next_retry_at TEXT,
  failure_code TEXT,
  failure_class TEXT CHECK (failure_class IS NULL OR failure_class IN ('transient','permanent')),
  metadata_json TEXT,
  created_at TEXT NOT NULL
);
INSERT INTO communication_delivery_attempts SELECT * FROM communication_delivery_attempts_legacy;
DROP TABLE communication_delivery_attempts_legacy;
CREATE INDEX idx_communication_delivery_attempts_notification_time
  ON communication_delivery_attempts(notification_id, attempted_at DESC, id DESC);

ALTER TABLE communication_preferences RENAME TO communication_preferences_legacy;
CREATE TABLE communication_preferences (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  recipient_reference TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('transactional','security','marketing','reminders','product_updates')),
  channel TEXT CHECK (channel IS NULL OR channel IN ('in_app','whatsapp','sms','email','push')),
  status TEXT NOT NULL CHECK (status IN ('allowed','denied')),
  source TEXT NOT NULL,
  consent_reference TEXT,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);
INSERT INTO communication_preferences SELECT * FROM communication_preferences_legacy;
DROP TABLE communication_preferences_legacy;
CREATE INDEX idx_communication_preferences_lookup
  ON communication_preferences(organization_id, workspace_id, recipient_reference, category, channel, effective_from DESC);

ALTER TABLE communication_suppression_records RENAME TO communication_suppression_records_legacy;
CREATE TABLE communication_suppression_records (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  recipient_reference TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('global','category','channel','intent')),
  category TEXT CHECK (category IS NULL OR category IN ('transactional','security','marketing','reminders','product_updates')),
  channel TEXT CHECK (channel IS NULL OR channel IN ('in_app','whatsapp','sms','email','push')),
  intent TEXT,
  reason_code TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','released','expired')),
  effective_from TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  applies_to_required INTEGER NOT NULL DEFAULT 1 CHECK (applies_to_required IN (0,1)),
  CHECK (
    (scope = 'global')
    OR (scope = 'category' AND category IS NOT NULL)
    OR (scope = 'channel' AND channel IS NOT NULL)
    OR (scope = 'intent' AND intent IS NOT NULL)
  ),
  CHECK (expires_at IS NULL OR expires_at > effective_from)
);
INSERT INTO communication_suppression_records SELECT * FROM communication_suppression_records_legacy;
DROP TABLE communication_suppression_records_legacy;
CREATE INDEX idx_communication_suppressions_lookup
  ON communication_suppression_records(organization_id, workspace_id, recipient_reference, status, effective_from DESC);

CREATE TRIGGER IF NOT EXISTS trg_communication_notification_scope_insert
BEFORE INSERT ON communication_notifications
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1 FROM workspaces w
  WHERE w.id = NEW.workspace_id AND w.organization_id = NEW.organization_id
)
BEGIN
  SELECT RAISE(ABORT, 'Communication notification workspace crosses organization boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_communication_notification_policy_insert
BEFORE INSERT ON communication_notifications
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM communication_intents ci
      WHERE ci.intent_key = NEW.intent AND ci.status = 'active'
    ) THEN RAISE(ABORT, 'Communication intent policy is not active')
  END;

  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM communication_intents ci
      WHERE ci.intent_key = NEW.intent AND ci.status = 'active'
        AND EXISTS (
          SELECT 1 FROM json_each(ci.allowed_channels_json) ac WHERE ac.value = NEW.channel
        )
    ) THEN RAISE(ABORT, 'Communication channel is not allowed for intent')
  END;

  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM communication_suppression_records s
      INNER JOIN communication_intents ci
        ON ci.intent_key = NEW.intent AND ci.status = 'active'
      WHERE s.organization_id = NEW.organization_id
        AND (s.workspace_id IS NULL OR s.workspace_id = NEW.workspace_id)
        AND s.recipient_reference = NEW.recipient_reference
        AND s.status = 'active'
        AND s.effective_from <= CURRENT_TIMESTAMP
        AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP)
        AND (s.applies_to_required = 1 OR ci.category NOT IN ('transactional','security'))
        AND (
          s.scope = 'global'
          OR (s.scope = 'category' AND s.category = ci.category)
          OR (s.scope = 'channel' AND s.channel = NEW.channel)
          OR (s.scope = 'intent' AND s.intent = NEW.intent)
        )
    ) THEN RAISE(ABORT, 'Communication recipient is suppressed by policy')
  END;

  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM communication_intents ci
      WHERE ci.intent_key = NEW.intent AND ci.status = 'active' AND ci.requires_opt_in = 1
    )
    AND NOT EXISTS (
      SELECT 1 FROM communication_preferences p
      WHERE p.id = (
        SELECT latest.id FROM communication_preferences latest
        WHERE latest.organization_id = NEW.organization_id
          AND (latest.workspace_id IS NULL OR latest.workspace_id = NEW.workspace_id)
          AND latest.recipient_reference = NEW.recipient_reference
          AND latest.category = (
            SELECT ci2.category FROM communication_intents ci2
            WHERE ci2.intent_key = NEW.intent AND ci2.status = 'active'
          )
          AND (latest.channel IS NULL OR latest.channel = NEW.channel)
          AND latest.effective_from <= CURRENT_TIMESTAMP
          AND (latest.effective_to IS NULL OR latest.effective_to > CURRENT_TIMESTAMP)
        ORDER BY CASE WHEN latest.workspace_id = NEW.workspace_id THEN 0 ELSE 1 END,
                 CASE WHEN latest.channel = NEW.channel THEN 0 ELSE 1 END,
                 latest.created_at DESC, latest.id DESC
        LIMIT 1
      ) AND p.status = 'allowed'
    ) THEN RAISE(ABORT, 'Communication opt-in is required')
  END;
END;

-- Add a push-native transactional/security intent without changing historical policy rows.
INSERT INTO communication_intents
  (id, intent_key, category, requires_opt_in, allowed_channels_json, policy_version, status, created_at, updated_at)
VALUES
  ('comm-intent-account-security-push', 'account.security_push_alert', 'security', 0, '["push"]', '1', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
