-- Complete the Automation compensation / rollback contract.
ALTER TABLE automation_actions ADD COLUMN compensation_policy_json TEXT;
ALTER TABLE automation_compensation_references ADD COLUMN execution_id TEXT;
ALTER TABLE automation_compensation_references ADD COLUMN failed_step_execution_id TEXT;
ALTER TABLE automation_compensation_references ADD COLUMN failed_attempt_id TEXT;
ALTER TABLE automation_compensation_references ADD COLUMN input_reference TEXT;
ALTER TABLE automation_compensation_references ADD COLUMN output_reference TEXT;
ALTER TABLE automation_compensation_references ADD COLUMN evidence_reference TEXT;
ALTER TABLE automation_compensation_references ADD COLUMN idempotency_key TEXT;
ALTER TABLE automation_compensation_references ADD COLUMN attempt_number INTEGER NOT NULL DEFAULT 1 CHECK (attempt_number >= 1);
ALTER TABLE automation_compensation_references ADD COLUMN error_reference TEXT;
ALTER TABLE automation_compensation_references ADD COLUMN requested_at TEXT;
ALTER TABLE automation_compensation_references ADD COLUMN completed_at TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ux_automation_compensation_execution_action ON automation_compensation_references(execution_id, failed_action_id) WHERE execution_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_automation_compensation_idempotency ON automation_compensation_references(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_automation_compensation_execution_status ON automation_compensation_references(execution_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_automation_compensation_failed_step ON automation_compensation_references(failed_step_execution_id);
CREATE INDEX IF NOT EXISTS idx_automation_actions_compensation ON automation_actions(workflow_version_id, sequence, compensation_policy_json);
