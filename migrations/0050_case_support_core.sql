-- Establish the canonical Case & Support Operations engine.
CREATE TABLE cases (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  case_type_id TEXT NOT NULL REFERENCES case_types(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('open','triaged','assigned','in_progress','waiting','escalated','resolved','closed','reopened')),
  priority TEXT NOT NULL CHECK (priority IN ('low','normal','high','urgent')),
  severity TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  requester_type TEXT NOT NULL,
  requester_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_reference TEXT,
  queue_id TEXT REFERENCES case_queues(id) ON DELETE RESTRICT,
  assignee_id TEXT,
  sla_id TEXT REFERENCES case_slas(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  opened_at TEXT NOT NULL,
  resolved_at TEXT,
  closed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (resolved_at IS NULL OR resolved_at >= opened_at),
  CHECK (closed_at IS NULL OR closed_at >= opened_at)
);

CREATE INDEX idx_cases_scope_status
  ON cases(organization_id, workspace_id, status, priority, updated_at DESC);

CREATE INDEX idx_cases_subject
  ON cases(organization_id, subject_type, subject_id, created_at DESC);

CREATE UNIQUE INDEX uq_cases_source
  ON cases(organization_id, source_type, source_reference)
  WHERE source_reference IS NOT NULL;

CREATE TABLE case_types (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  description TEXT,
  required_capabilities_json TEXT NOT NULL,
  default_priority TEXT NOT NULL CHECK (default_priority IN ('low','normal','high','urgent')),
  default_sla_id TEXT,
  policy_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','active','retired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(code, version)
);

CREATE INDEX idx_case_types_status_code
  ON case_types(status, code, version DESC);

CREATE TABLE case_queues (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  supported_case_types_json TEXT NOT NULL,
  required_capabilities_json TEXT NOT NULL,
  language_scope_json TEXT,
  jurisdiction_scope_json TEXT,
  status TEXT NOT NULL CHECK (status IN ('active','paused','retired')),
  routing_policy_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_case_queues_scope_status
  ON case_queues(organization_id, workspace_id, status, name);

CREATE TABLE case_assignments (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  queue_id TEXT REFERENCES case_queues(id) ON DELETE RESTRICT,
  assignee_type TEXT NOT NULL,
  assignee_id TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  reason TEXT,
  assigned_at TEXT NOT NULL,
  unassigned_at TEXT,
  CHECK (unassigned_at IS NULL OR unassigned_at >= assigned_at)
);

CREATE INDEX idx_case_assignments_case_time
  ON case_assignments(case_id, assigned_at DESC, id DESC);

CREATE TABLE case_participants (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  role TEXT NOT NULL,
  visibility_scope TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  left_at TEXT,
  UNIQUE(case_id, actor_type, actor_id, role),
  CHECK (left_at IS NULL OR left_at >= joined_at)
);

CREATE INDEX idx_case_participants_case
  ON case_participants(case_id, joined_at);

CREATE TABLE case_events (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  actor_type TEXT,
  actor_id TEXT,
  from_status TEXT,
  to_status TEXT,
  payload_reference TEXT,
  correlation_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_case_events_case_time
  ON case_events(case_id, occurred_at DESC, id DESC);

CREATE TABLE case_notes (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  author_id TEXT NOT NULL,
  visibility TEXT NOT NULL,
  content_reference TEXT NOT NULL,
  classification TEXT NOT NULL,
  created_at TEXT NOT NULL,
  edited_at TEXT
);

CREATE INDEX idx_case_notes_case_time
  ON case_notes(case_id, created_at DESC);

CREATE TABLE case_evidence_references (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  source_module TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  classification TEXT NOT NULL,
  access_policy_reference TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(case_id, source_module, source_type, source_id, evidence_type)
);

CREATE TABLE case_links (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  linked_type TEXT NOT NULL,
  linked_id TEXT NOT NULL,
  relationship TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(case_id, linked_type, linked_id, relationship)
);

CREATE INDEX idx_case_links_target
  ON case_links(linked_type, linked_id, created_at DESC);

CREATE TABLE case_escalations (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  escalation_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  target_queue_id TEXT REFERENCES case_queues(id) ON DELETE RESTRICT,
  target_actor_id TEXT,
  policy_version TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  escalated_at TEXT NOT NULL,
  resolved_at TEXT,
  CHECK (resolved_at IS NULL OR resolved_at >= escalated_at)
);

CREATE INDEX idx_case_escalations_case_time
  ON case_escalations(case_id, escalated_at DESC);

CREATE TABLE case_resolutions (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  outcome_code TEXT NOT NULL,
  summary_reference TEXT NOT NULL,
  resolver_id TEXT NOT NULL,
  authoritative_references_json TEXT NOT NULL,
  follow_up_required INTEGER NOT NULL DEFAULT 0 CHECK (follow_up_required IN (0,1)),
  resolved_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_case_resolutions_case_time
  ON case_resolutions(case_id, resolved_at DESC);

CREATE TABLE case_slas (
  id TEXT PRIMARY KEY,
  case_type_id TEXT NOT NULL REFERENCES case_types(id) ON DELETE RESTRICT,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('platform','organization','workspace')),
  organization_id TEXT REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  first_response_target_seconds INTEGER NOT NULL CHECK (first_response_target_seconds >= 0),
  resolution_target_seconds INTEGER NOT NULL CHECK (resolution_target_seconds >= 0),
  calendar_id TEXT,
  timezone TEXT NOT NULL,
  pause_conditions_json TEXT,
  escalation_thresholds_json TEXT,
  policy_version TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  CHECK (
    (scope_type = 'platform' AND organization_id IS NULL AND workspace_id IS NULL)
    OR (scope_type = 'organization' AND organization_id IS NOT NULL AND workspace_id IS NULL)
    OR (scope_type = 'workspace' AND organization_id IS NOT NULL AND workspace_id IS NOT NULL)
  )
);

CREATE INDEX idx_case_slas_lookup
  ON case_slas(case_type_id, scope_type, organization_id, workspace_id, effective_from DESC);

CREATE TABLE case_actions (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  capability TEXT NOT NULL,
  target_reference TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  authorization_reference TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('requested','approved','running','succeeded','failed','cancelled')),
  result_reference TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE(case_id, idempotency_key)
);

CREATE INDEX idx_case_actions_case_status
  ON case_actions(case_id, status, created_at DESC);

CREATE TABLE case_templates (
  id TEXT PRIMARY KEY,
  case_type_id TEXT NOT NULL REFERENCES case_types(id) ON DELETE RESTRICT,
  required_fields_json TEXT NOT NULL,
  routing_policy_json TEXT NOT NULL,
  default_sla_id TEXT REFERENCES case_slas(id) ON DELETE RESTRICT,
  default_priority TEXT NOT NULL CHECK (default_priority IN ('low','normal','high','urgent')),
  response_templates_json TEXT,
  policy_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','active','retired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_case_templates_type_status
  ON case_templates(case_type_id, status, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_case_scope_queue
BEFORE INSERT ON cases
FOR EACH ROW
WHEN NEW.queue_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1
  FROM case_queues q
  WHERE q.id = NEW.queue_id
    AND (q.organization_id IS NULL OR q.organization_id = NEW.organization_id)
    AND (q.workspace_id IS NULL OR q.workspace_id = NEW.workspace_id)
 )
BEGIN
  SELECT RAISE(ABORT, 'Case queue crosses tenant/workspace boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_case_scope_sla
BEFORE INSERT ON cases
FOR EACH ROW
WHEN NEW.sla_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1
  FROM case_slas s
  WHERE s.id = NEW.sla_id
    AND (s.organization_id IS NULL OR s.organization_id = NEW.organization_id)
    AND (s.workspace_id IS NULL OR s.workspace_id = NEW.workspace_id)
 )
BEGIN
  SELECT RAISE(ABORT, 'Case SLA crosses tenant/workspace boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_case_assignment_scope
BEFORE INSERT ON case_assignments
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM cases c WHERE c.id = NEW.case_id
)
BEGIN
  SELECT RAISE(ABORT, 'Case assignment references unknown case');
END;

CREATE TRIGGER IF NOT EXISTS trg_case_event_immutable
BEFORE UPDATE ON case_events
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Case events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_case_event_delete_immutable
BEFORE DELETE ON case_events
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Case events are append-only');
END;
