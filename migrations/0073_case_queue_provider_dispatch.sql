-- Complete the Case & Support external queue/provider dispatch boundary.
ALTER TABLE case_queues ADD COLUMN dispatch_provider_id TEXT;
ALTER TABLE case_queues ADD COLUMN dispatch_route_reference TEXT;
ALTER TABLE case_queues ADD COLUMN dispatch_enabled INTEGER NOT NULL DEFAULT 0 CHECK (dispatch_enabled IN (0,1));

CREATE INDEX idx_case_queues_dispatch
  ON case_queues(dispatch_enabled, dispatch_provider_id, status);

CREATE TABLE case_dispatches (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  assignment_id TEXT NOT NULL REFERENCES case_assignments(id) ON DELETE RESTRICT,
  queue_id TEXT NOT NULL REFERENCES case_queues(id) ON DELETE RESTRICT,
  provider_id TEXT NOT NULL,
  route_reference TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending','dispatching','accepted','failed','cancelled')),
  external_reference TEXT,
  failure_code TEXT,
  failure_class TEXT CHECK (failure_class IS NULL OR failure_class IN ('transient','permanent')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TEXT NOT NULL,
  accepted_at TEXT,
  last_attempt_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_case_dispatches_due
  ON case_dispatches(status, available_at, created_at);

CREATE INDEX idx_case_dispatches_case
  ON case_dispatches(case_id, created_at DESC);

CREATE TABLE case_dispatch_attempts (
  id TEXT PRIMARY KEY,
  dispatch_id TEXT NOT NULL REFERENCES case_dispatches(id) ON DELETE RESTRICT,
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
  status TEXT NOT NULL CHECK (status IN ('accepted','failed')),
  provider_reference TEXT,
  failure_code TEXT,
  failure_class TEXT CHECK (failure_class IS NULL OR failure_class IN ('transient','permanent')),
  occurred_at TEXT NOT NULL,
  UNIQUE(dispatch_id, attempt_number)
);

CREATE INDEX idx_case_dispatch_attempts_dispatch
  ON case_dispatch_attempts(dispatch_id, attempt_number DESC);

CREATE TRIGGER IF NOT EXISTS trg_case_dispatch_scope
BEFORE INSERT ON case_dispatches
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM cases c
  INNER JOIN case_queues q ON q.id = NEW.queue_id
  INNER JOIN case_assignments a ON a.id = NEW.assignment_id AND a.case_id = c.id
  WHERE c.id = NEW.case_id
    AND (q.organization_id IS NULL OR q.organization_id = c.organization_id)
    AND (q.workspace_id IS NULL OR q.workspace_id = c.workspace_id)
)
BEGIN
  SELECT RAISE(ABORT, 'Case dispatch crosses tenant/workspace boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_case_dispatch_attempts_immutable
BEFORE UPDATE ON case_dispatch_attempts
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Case dispatch attempts are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_case_dispatch_attempts_delete_immutable
BEFORE DELETE ON case_dispatch_attempts
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Case dispatch attempts are append-only');
END;
