-- Establish the derived SEO/GEO semantic graph, internal-link planning and geographic truth signals.
CREATE TABLE seo_entity_graph_nodes (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  source_module TEXT NOT NULL,
  source_version TEXT NOT NULL,
  publication_state TEXT NOT NULL,
  visibility TEXT NOT NULL,
  locale TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (organization_id, workspace_id, entity_id)
);

CREATE TABLE seo_entity_graph_edges (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT,
  source_entity_id TEXT NOT NULL,
  target_entity_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  provenance TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  verified_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (organization_id, workspace_id, source_entity_id, target_entity_id, relation)
);

CREATE INDEX idx_seo_graph_edges_source
  ON seo_entity_graph_edges(organization_id, workspace_id, source_entity_id, confidence DESC);

CREATE INDEX idx_seo_graph_edges_target
  ON seo_entity_graph_edges(organization_id, workspace_id, target_entity_id, confidence DESC);

CREATE TABLE seo_internal_link_recommendations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT,
  source_entity_id TEXT NOT NULL,
  target_entity_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  priority INTEGER NOT NULL CHECK (priority >= 0 AND priority <= 100),
  reason TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  consumed_at TEXT
);

CREATE INDEX idx_seo_internal_links_source
  ON seo_internal_link_recommendations(organization_id, workspace_id, source_entity_id, priority DESC);

CREATE TABLE seo_geo_signals (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT,
  entity_id TEXT NOT NULL,
  geo_scope TEXT NOT NULL CHECK (geo_scope IN ('exact','branch','city','region','country','service-area')),
  location_id TEXT,
  service_area_ids_json TEXT NOT NULL,
  remote_available INTEGER NOT NULL CHECK (remote_available IN (0,1)),
  source_updated_at TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  PRIMARY KEY (organization_id, workspace_id, entity_id)
);

CREATE INDEX idx_seo_geo_signals_location
  ON seo_geo_signals(organization_id, workspace_id, location_id);

CREATE TRIGGER trg_seo_graph_node_workspace_scope
BEFORE INSERT ON seo_entity_graph_nodes
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id=NEW.workspace_id AND w.organization_id=NEW.organization_id)
BEGIN SELECT RAISE(ABORT,'SEO graph node workspace crosses organization boundary'); END;

CREATE TRIGGER trg_seo_graph_edge_scope
BEFORE INSERT ON seo_entity_graph_edges
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id=NEW.workspace_id AND w.organization_id=NEW.organization_id)
BEGIN SELECT RAISE(ABORT,'SEO graph edge workspace crosses organization boundary'); END;

CREATE TRIGGER trg_seo_graph_edge_no_self
BEFORE INSERT ON seo_entity_graph_edges
FOR EACH ROW
WHEN NEW.source_entity_id = NEW.target_entity_id
BEGIN SELECT RAISE(ABORT,'SEO graph self edge is not allowed'); END;

CREATE TRIGGER trg_seo_geo_signal_workspace_scope
BEFORE INSERT ON seo_geo_signals
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id=NEW.workspace_id AND w.organization_id=NEW.organization_id)
BEGIN SELECT RAISE(ABORT,'SEO geo signal workspace crosses organization boundary'); END;
