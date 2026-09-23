-- Add Communication intent policy, recipient preferences and suppression enforcement.
ALTER TABLE communication_notifications ADD COLUMN policy_version TEXT;

CREATE TABLE communication_intents (
  id TEXT PRIMARY KEY,
  intent_key TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('transactional','security','marketing','reminders','product_updates')),
  requires_opt_in INTEGER NOT NULL CHECK (requires_opt_in IN (0,1)),
  allowed_channels_json TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','retired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE communication_preferences (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  recipient_reference TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('transactional','security','marketing','reminders','product_updates')),
  channel TEXT CHECK (channel IS NULL OR channel IN ('in_app','whatsapp','sms','email')),
  status TEXT NOT NULL CHECK (status IN ('allowed','denied')),
  source TEXT NOT NULL,
  consent_reference TEXT,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX idx_communication_preferences_lookup
  ON communication_preferences(
    organization_id,
    workspace_id,
    recipient_reference,
    category,
    channel,
    effective_from DESC
  );

CREATE TABLE communication_suppression_records (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  recipient_reference TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('global','category','channel','intent')),
  category TEXT CHECK (category IS NULL OR category IN ('transactional','security','marketing','reminders','product_updates')),
  channel TEXT CHECK (channel IS NULL OR channel IN ('in_app','whatsapp','sms','email')),
  intent TEXT,
  reason_code TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','released','expired')),
  effective_from TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (scope = 'global')
    OR (scope = 'category' AND category IS NOT NULL)
    OR (scope = 'channel' AND channel IS NOT NULL)
    OR (scope = 'intent' AND intent IS NOT NULL)
  ),
  CHECK (expires_at IS NULL OR expires_at > effective_from)
);

CREATE INDEX idx_communication_suppressions_lookup
  ON communication_suppression_records(
    organization_id,
    workspace_id,
    recipient_reference,
    status,
    effective_from DESC
  );

CREATE TABLE communication_policy_decisions (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL REFERENCES communication_notifications(id) ON DELETE RESTRICT,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  result TEXT NOT NULL CHECK (result IN ('allowed','denied','suppressed')),
  reason_code TEXT,
  policy_version TEXT NOT NULL,
  preference_reference TEXT,
  suppression_reference TEXT,
  evaluated_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_communication_policy_decisions_notification
  ON communication_policy_decisions(notification_id, evaluated_at DESC);

INSERT INTO communication_intents
  (id, intent_key, category, requires_opt_in, allowed_channels_json, policy_version, status, created_at, updated_at)
VALUES
  ('comm-intent-booking-confirmed', 'booking.confirmed', 'transactional', 0, '["in_app","whatsapp","sms","email"]', '1', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('comm-intent-booking-reminder', 'booking.reminder', 'reminders', 0, '["in_app","whatsapp","sms","email"]', '1', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('comm-intent-booking-cancelled', 'booking.cancelled', 'transactional', 0, '["in_app","whatsapp","sms","email"]', '1', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('comm-intent-booking-rescheduled', 'booking.rescheduled', 'transactional', 0, '["in_app","whatsapp","sms","email"]', '1', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('comm-intent-crm-follow-up', 'crm.follow_up', 'product_updates', 1, '["in_app","whatsapp","sms","email"]', '1', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('comm-intent-account-security-alert', 'account.security_alert', 'security', 0, '["in_app","whatsapp","sms","email"]', '1', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('comm-intent-business-verification-update', 'business.verification_update', 'transactional', 0, '["in_app","whatsapp","sms","email"]', '1', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('comm-intent-marketing-campaign', 'marketing.campaign', 'marketing', 1, '["in_app","whatsapp","sms","email"]', '1', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

CREATE TRIGGER IF NOT EXISTS trg_communication_notification_policy_insert
BEFORE INSERT ON communication_notifications
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM communication_intents ci
      WHERE ci.intent_key = NEW.intent
        AND ci.status = 'active'
    )
    THEN RAISE(ABORT, 'Communication intent policy is not active')
  END;

  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM communication_intents ci
      WHERE ci.intent_key = NEW.intent
        AND ci.status = 'active'
        AND EXISTS (
          SELECT 1
          FROM json_each(ci.allowed_channels_json) ac
          WHERE ac.value = NEW.channel
        )
    )
    THEN RAISE(ABORT, 'Communication channel is not allowed for intent')
  END;

  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM communication_suppression_records s
      INNER JOIN communication_intents ci
        ON ci.intent_key = NEW.intent
       AND ci.status = 'active'
      WHERE s.organization_id = NEW.organization_id
        AND ((s.workspace_id IS NULL AND NEW.workspace_id IS NULL) OR s.workspace_id = NEW.workspace_id)
        AND s.recipient_reference = NEW.recipient_reference
        AND s.status = 'active'
        AND s.effective_from <= CURRENT_TIMESTAMP
        AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP)
        AND (
          s.scope = 'global'
          OR (s.scope = 'category' AND s.category = ci.category)
          OR (s.scope = 'channel' AND s.channel = NEW.channel)
          OR (s.scope = 'intent' AND s.intent = NEW.intent)
        )
    )
    THEN RAISE(ABORT, 'Communication recipient is suppressed by policy')
  END;

  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM communication_intents ci
      WHERE ci.intent_key = NEW.intent
        AND ci.status = 'active'
        AND ci.requires_opt_in = 1
    )
    AND NOT EXISTS (
      SELECT 1
      FROM communication_preferences p
      WHERE p.id = (
        SELECT latest.id
        FROM communication_preferences latest
        WHERE latest.organization_id = NEW.organization_id
          AND (latest.workspace_id IS NULL OR latest.workspace_id = NEW.workspace_id)
          AND latest.recipient_reference = NEW.recipient_reference
          AND latest.category = (
            SELECT ci2.category
            FROM communication_intents ci2
            WHERE ci2.intent_key = NEW.intent
              AND ci2.status = 'active'
          )
          AND (latest.channel IS NULL OR latest.channel = NEW.channel)
          AND latest.effective_from <= CURRENT_TIMESTAMP
          AND (latest.effective_to IS NULL OR latest.effective_to > CURRENT_TIMESTAMP)
        ORDER BY
          CASE WHEN latest.workspace_id = NEW.workspace_id THEN 0 ELSE 1 END,
          CASE WHEN latest.channel = NEW.channel THEN 0 ELSE 1 END,
          latest.created_at DESC,
          latest.id DESC
        LIMIT 1
      )
      AND p.status = 'allowed'
    )
    THEN RAISE(ABORT, 'Communication opt-in is required')
  END;
END;
