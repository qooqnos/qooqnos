-- Establish versioned Discovery index generations and observable query/evaluation evidence.
CREATE TABLE search_index_versions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  generation INTEGER NOT NULL CHECK (generation >= 1),
  index_schema_version TEXT NOT NULL,
  embedding_model_version TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft','building','validating','active','retired','failed')),
  source_checkpoint_reference TEXT,
  created_by TEXT NOT NULL,
  activated_at TEXT,
  retired_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id, workspace_id, generation)
);

CREATE UNIQUE INDEX uq_search_index_active_generation
  ON search_index_versions(organization_id, workspace_id)
  WHERE status = 'active';

CREATE INDEX idx_search_index_versions_scope_status
  ON search_index_versions(organization_id, workspace_id, status, generation DESC);

CREATE TABLE discovery_query_traces (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  request_id TEXT NOT NULL,
  normalized_intent_json TEXT,
  candidate_counts_json TEXT,
  retrieval_sources_json TEXT,
  policy_exclusions_json TEXT,
  ranking_policy_version TEXT NOT NULL,
  cache_status TEXT,
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  degradation_state TEXT,
  result_ids_json TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(organization_id, workspace_id, request_id)
);

CREATE INDEX idx_discovery_query_traces_scope_time
  ON discovery_query_traces(organization_id, workspace_id, created_at DESC);

CREATE TABLE discovery_evaluation_records (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  evaluation_type TEXT NOT NULL CHECK (evaluation_type IN ('retrieval','ranking','matching','explanation','end_to_end')),
  dataset_reference TEXT NOT NULL,
  query_version TEXT,
  index_schema_version TEXT,
  embedding_model_version TEXT,
  ranking_policy_version TEXT,
  metrics_json TEXT NOT NULL,
  evaluator_version TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_discovery_evaluation_scope_time
  ON discovery_evaluation_records(organization_id, workspace_id, evaluation_type, generated_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_search_index_scope_insert
BEFORE INSERT ON search_index_versions
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM workspaces w
  WHERE w.id = NEW.workspace_id
    AND w.organization_id = NEW.organization_id
)
BEGIN
  SELECT RAISE(ABORT, 'Search index workspace crosses organization boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_discovery_trace_scope_insert
BEFORE INSERT ON discovery_query_traces
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM workspaces w
  WHERE w.id = NEW.workspace_id
    AND w.organization_id = NEW.organization_id
)
BEGIN
  SELECT RAISE(ABORT, 'Discovery trace workspace crosses organization boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_discovery_eval_workspace_scope_insert
BEFORE INSERT ON discovery_evaluation_records
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM workspaces w
   WHERE w.id = NEW.workspace_id
     AND w.organization_id = NEW.organization_id
 )
BEGIN
  SELECT RAISE(ABORT, 'Discovery evaluation workspace crosses organization boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_search_index_activation
BEFORE UPDATE OF status ON search_index_versions
FOR EACH ROW
WHEN NEW.status = 'active'
BEGIN
  UPDATE search_index_versions
  SET status = 'retired', retired_at = COALESCE(retired_at, NEW.updated_at)
  WHERE organization_id = NEW.organization_id
    AND workspace_id = NEW.workspace_id
    AND id <> NEW.id
    AND status = 'active';
END;
