-- Bind each compensation reference to both the triggering failure and the side effect being compensated.
ALTER TABLE automation_compensation_references ADD COLUMN compensated_action_id TEXT;
DROP INDEX IF EXISTS ux_automation_compensation_execution_action;
CREATE UNIQUE INDEX IF NOT EXISTS ux_automation_compensation_execution_action_pair ON automation_compensation_references(execution_id, failed_action_id, compensated_action_id) WHERE execution_id IS NOT NULL AND compensated_action_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_automation_compensation_failed_action ON automation_compensation_references(execution_id, failed_action_id, status);
