-- Establish the canonical reusable Automation & Workflow Engine state model.
CREATE TABLE automation_workflows (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  workspace_id TEXT,
  business_id TEXT,
  name TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('platform','organization','workspace','business')),
  status TEXT NOT NULL CHECK (status IN ('draft','validating','active','paused','retired')),
  active_version_id TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (scope = 'platform' AND organization_id IS NULL AND workspace_id IS NULL AND business_id IS NULL)
    OR (scope = 'organization' AND organization_id IS NOT NULL AND workspace_id IS NULL AND business_id IS NULL)
    OR (scope = 'workspace' AND organization_id IS NOT NULL AND workspace_id IS NOT NULL AND business_id IS NULL)
    OR (scope = 'business' AND organization_id IS NOT NULL AND workspace_id IS NOT NULL AND business_id IS NOT NULL)
  )
);

CREATE INDEX idx_automation_workflows_scope_status
  ON automation_workflows(scope, organization_id, workspace_id, business_id, status);

CREATE TABLE automation_workflow_versions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES automation_workflows(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version >= 1),
  definition_json TEXT NOT NULL,
  definition_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','validating','active','retired')),
  activated_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(workflow_id, version)
);

CREATE INDEX idx_automation_workflow_versions_workflow_status
  ON automation_workflow_versions(workflow_id, status, version DESC);

CREATE TABLE automation_triggers (
  id TEXT PRIMARY KEY,
  workflow_version_id TEXT NOT NULL REFERENCES automation_workflow_versions(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('event','schedule','command')),
  event_type TEXT,
  schedule_id TEXT,
  command_capability TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  created_at TEXT NOT NULL,
  CHECK (
    (type = 'event' AND event_type IS NOT NULL AND schedule_id IS NULL AND command_capability IS NULL)
    OR (type = 'schedule' AND event_type IS NULL AND schedule_id IS NOT NULL AND command_capability IS NULL)
    OR (type = 'command' AND event_type IS NULL AND schedule_id IS NULL AND command_capability IS NOT NULL)
  )
);

CREATE INDEX idx_automation_triggers_version_enabled
  ON automation_triggers(workflow_version_id, enabled);

CREATE TABLE automation_conditions (
  id TEXT PRIMARY KEY,
  workflow_version_id TEXT NOT NULL REFERENCES automation_workflow_versions(id) ON DELETE RESTRICT,
  expression TEXT NOT NULL,
  evaluation_policy_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE automation_actions (
  id TEXT PRIMARY KEY,
  workflow_version_id TEXT NOT NULL REFERENCES automation_workflow_versions(id) ON DELETE RESTRICT,
  capability TEXT NOT NULL,
  input_mapping_json TEXT NOT NULL,
  timeout_policy_json TEXT,
  retry_policy_json TEXT,
  approval_policy_json TEXT,
  sequence INTEGER NOT NULL CHECK (sequence >= 0),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_automation_actions_version_sequence
  ON automation_actions(workflow_version_id, sequence);

CREATE TABLE automation_schedules (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  workspace_id TEXT,
  timezone TEXT NOT NULL,
  recurrence TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT,
  misfire_policy TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  next_run_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_automation_schedules_next_run
  ON automation_schedules(enabled, next_run_at);

CREATE TABLE automation_executions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES automation_workflows(id) ON DELETE RESTRICT,
  workflow_version_id TEXT NOT NULL REFERENCES automation_workflow_versions(id) ON DELETE RESTRICT,
  trigger_id TEXT NOT NULL REFERENCES automation_triggers(id) ON DELETE RESTRICT,
  organization_id TEXT,
  workspace_id TEXT,
  business_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','running','waiting','completed','failed','cancelled')),
  input_reference TEXT,
  correlation_id TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_automation_executions_scope_status
  ON automation_executions(organization_id, workspace_id, business_id, status, created_at DESC);

CREATE INDEX idx_automation_executions_workflow_time
  ON automation_executions(workflow_id, created_at DESC);

CREATE TABLE automation_step_executions (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES automation_executions(id) ON DELETE RESTRICT,
  step_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','running','waiting','completed','failed','skipped')),
  sequence INTEGER NOT NULL CHECK (sequence >= 0),
  input_reference TEXT,
  output_reference TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_automation_step_executions_execution_sequence
  ON automation_step_executions(execution_id, sequence);

CREATE TABLE automation_execution_attempts (
  id TEXT PRIMARY KEY,
  step_execution_id TEXT NOT NULL REFERENCES automation_step_executions(id) ON DELETE RESTRICT,
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running','succeeded','failed','cancelled')),
  error_reference TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE(step_execution_id, attempt_number),
  UNIQUE(idempotency_key)
);

CREATE TABLE automation_execution_errors (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES automation_executions(id) ON DELETE RESTRICT,
  step_execution_id TEXT REFERENCES automation_step_executions(id) ON DELETE RESTRICT,
  attempt_id TEXT REFERENCES automation_execution_attempts(id) ON DELETE RESTRICT,
  error_class TEXT NOT NULL,
  retryable INTEGER NOT NULL CHECK (retryable IN (0,1)),
  safe_message TEXT NOT NULL,
  provider_reference TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_automation_execution_errors_execution
  ON automation_execution_errors(execution_id, created_at DESC);

CREATE TABLE automation_variables (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES automation_executions(id) ON DELETE RESTRICT,
  variable_key TEXT NOT NULL,
  value_reference TEXT NOT NULL,
  classification TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(execution_id, variable_key)
);

CREATE TABLE automation_policies (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  workspace_id TEXT,
  policy_version TEXT NOT NULL,
  max_duration_seconds INTEGER,
  max_steps INTEGER,
  max_retries INTEGER,
  default_timeout_seconds INTEGER,
  max_concurrency INTEGER,
  allowed_capabilities_json TEXT NOT NULL,
  approval_requirements_json TEXT,
  retention_policy TEXT,
  emergency_disabled INTEGER NOT NULL DEFAULT 0 CHECK (emergency_disabled IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE automation_approval_references (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES automation_executions(id) ON DELETE RESTRICT,
  authorization_request_id TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','expired')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE automation_compensation_references (
  id TEXT PRIMARY KEY,
  failed_action_id TEXT NOT NULL,
  compensation_capability TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('defined','requested','completed','failed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TRIGGER IF NOT EXISTS trg_automation_workflow_scope_insert
BEFORE INSERT ON automation_workflows
FOR EACH ROW
WHEN (NEW.scope IN ('organization','workspace','business') AND NEW.organization_id IS NULL)
 OR (NEW.scope IN ('workspace','business') AND NEW.workspace_id IS NULL)
 OR (NEW.scope = 'business' AND NEW.business_id IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'Automation workflow scope is invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_automation_execution_version_scope
BEFORE INSERT ON automation_executions
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM automation_workflow_versions v
  INNER JOIN automation_workflows w ON w.id = v.workflow_id
  WHERE v.id = NEW.workflow_version_id
    AND w.id = NEW.workflow_id
)
BEGIN
  SELECT RAISE(ABORT, 'Automation execution workflow version mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_automation_trigger_schedule_scope
BEFORE INSERT ON automation_triggers
FOR EACH ROW
WHEN NEW.type = 'schedule'
 AND NOT EXISTS (
   SELECT 1 FROM automation_schedules s WHERE s.id = NEW.schedule_id
 )
BEGIN
  SELECT RAISE(ABORT, 'Automation trigger schedule does not exist');
END;
