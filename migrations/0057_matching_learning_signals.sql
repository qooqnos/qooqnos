-- Establish append-only matching learning signals for post-match outcome evidence.
CREATE TABLE match_learning_signals (
  id TEXT PRIMARY KEY,
  match_request_id TEXT NOT NULL REFERENCES match_requests(id) ON DELETE RESTRICT,
  candidate_id TEXT REFERENCES match_candidates(id) ON DELETE RESTRICT,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'impression','viewed','clicked','contacted','connected','booked','purchased',
    'accepted','rejected','ignored','complaint','cancelled'
  )),
  signal_value REAL,
  source TEXT NOT NULL,
  actor_reference TEXT,
  metadata_json TEXT,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (signal_value IS NULL OR signal_value >= 0)
);

CREATE INDEX idx_match_learning_signals_request_time
  ON match_learning_signals(match_request_id, occurred_at DESC, id DESC);

CREATE INDEX idx_match_learning_signals_candidate_time
  ON match_learning_signals(candidate_id, occurred_at DESC, id DESC);

CREATE INDEX idx_match_learning_signals_org_time
  ON match_learning_signals(organization_id, workspace_id, occurred_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_match_learning_signal_scope
BEFORE INSERT ON match_learning_signals
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM match_requests mr
  WHERE mr.id = NEW.match_request_id
    AND mr.organization_id = NEW.organization_id
    AND (
      (mr.workspace_id IS NULL AND NEW.workspace_id IS NULL)
      OR mr.workspace_id = NEW.workspace_id
    )
    AND (
      NEW.candidate_id IS NULL
      OR EXISTS (
        SELECT 1 FROM match_candidates mc
        WHERE mc.id = NEW.candidate_id
          AND mc.match_request_id = mr.id
      )
    )
)
BEGIN
  SELECT RAISE(ABORT, 'Matching learning signal crosses match-request scope');
END;

CREATE TRIGGER IF NOT EXISTS trg_match_learning_signal_update_immutable
BEFORE UPDATE ON match_learning_signals
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Matching learning signals are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_match_learning_signal_delete_immutable
BEFORE DELETE ON match_learning_signals
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Matching learning signals are append-only');
END;
