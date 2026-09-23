-- Allow explicit suppression records to distinguish optional communications from required transactional/security traffic.
ALTER TABLE communication_suppression_records
  ADD COLUMN applies_to_required INTEGER NOT NULL DEFAULT 1
  CHECK (applies_to_required IN (0,1));

DROP TRIGGER IF EXISTS trg_communication_notification_policy_insert;

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
