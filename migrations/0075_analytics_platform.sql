-- Canonical Analytics ingestion, facts, aggregates and metric definitions.
-- Analytics is rebuildable projection state; domain modules remain authoritative.

CREATE TABLE analytics_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  event_version INTEGER NOT NULL CHECK (event_version >= 1),
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  organization_id TEXT,
  workspace_id TEXT,
  actor_reference TEXT,
  request_id TEXT,
  source_module TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  locale TEXT,
  country_context TEXT,
  privacy_classification TEXT NOT NULL DEFAULT 'product'
    CHECK (privacy_classification IN ('operational','product','business','security','billing','ai_evaluation','sensitive')),
  payload_hash TEXT NOT NULL,
  ingestion_status TEXT NOT NULL DEFAULT 'accepted'
    CHECK (ingestion_status IN ('accepted','quarantined')),
  created_at TEXT NOT NULL,
  UNIQUE(source_module, id)
);

CREATE INDEX idx_analytics_events_scope_time
  ON analytics_events(organization_id, workspace_id, occurred_at DESC, id DESC);
CREATE INDEX idx_analytics_events_name_time
  ON analytics_events(event_name, occurred_at DESC, id DESC);

CREATE TABLE analytics_facts (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE REFERENCES analytics_events(id) ON DELETE CASCADE,
  organization_id TEXT,
  workspace_id TEXT,
  fact_name TEXT NOT NULL,
  numeric_value REAL NOT NULL DEFAULT 1,
  dimensions_json TEXT,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_analytics_facts_scope_fact_time
  ON analytics_facts(organization_id, workspace_id, fact_name, occurred_at DESC);

CREATE TABLE analytics_metric_definitions (
  id TEXT PRIMARY KEY,
  metric_key TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  owner_module TEXT NOT NULL,
  formula TEXT NOT NULL,
  source_events_json TEXT NOT NULL,
  filters_json TEXT,
  timezone_policy TEXT NOT NULL DEFAULT 'workspace',
  attribution_window_seconds INTEGER,
  privacy_classification TEXT NOT NULL DEFAULT 'business',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft','active','retired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(metric_key, version)
);

CREATE TABLE analytics_metric_aggregates (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  workspace_id TEXT,
  metric_key TEXT NOT NULL,
  metric_version INTEGER NOT NULL CHECK (metric_version >= 1),
  bucket_start TEXT NOT NULL,
  bucket_granularity TEXT NOT NULL CHECK (bucket_granularity IN ('hour','day')),
  value REAL NOT NULL,
  source_cursor TEXT,
  calculated_at TEXT NOT NULL,
  projection_version INTEGER NOT NULL DEFAULT 1 CHECK (projection_version >= 1),
  UNIQUE(organization_id, workspace_id, metric_key, metric_version, bucket_start, bucket_granularity)
);

CREATE INDEX idx_analytics_metric_scope_time
  ON analytics_metric_aggregates(organization_id, workspace_id, metric_key, bucket_start DESC);

CREATE TABLE analytics_ingestion_quarantine (
  id TEXT PRIMARY KEY,
  source_event_id TEXT NOT NULL,
  source_module TEXT NOT NULL,
  organization_id TEXT,
  workspace_id TEXT,
  reason_code TEXT NOT NULL,
  error_reference TEXT,
  payload_hash TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts >= 1),
  resolved_at TEXT,
  UNIQUE(source_module, source_event_id)
);

CREATE INDEX idx_analytics_quarantine_scope
  ON analytics_ingestion_quarantine(organization_id, workspace_id, last_seen_at DESC);
