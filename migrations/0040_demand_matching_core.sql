-- Establish the canonical Phoenix Demand -> Match decision boundary.
CREATE TABLE demand_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  customer_id TEXT REFERENCES customers(id) ON DELETE RESTRICT,
  source_channel TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('created','understanding','ready','matched','acted','closed','cancelled')),
  raw_input_reference TEXT,
  locale TEXT,
  normalized_demand_json TEXT,
  confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_demand_requests_customer_status
  ON demand_requests(customer_id, status, created_at DESC);

CREATE INDEX idx_demand_requests_workspace_status
  ON demand_requests(workspace_id, status, created_at DESC);

CREATE TABLE demand_profiles (
  id TEXT PRIMARY KEY,
  demand_request_id TEXT NOT NULL REFERENCES demand_requests(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version >= 1),
  profile_json TEXT NOT NULL,
  confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  provenance_json TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft','validated','active','retired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(demand_request_id, version)
);

CREATE INDEX idx_demand_profiles_request_status
  ON demand_profiles(demand_request_id, status, version DESC);

CREATE TABLE match_requests (
  id TEXT PRIMARY KEY,
  demand_request_id TEXT NOT NULL REFERENCES demand_requests(id) ON DELETE RESTRICT,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  algorithm_version TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('created','retrieving','ranking','decided','connected','expired','cancelled')),
  requested_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_match_requests_demand_status
  ON match_requests(demand_request_id, status, requested_at DESC);

CREATE TABLE match_candidates (
  id TEXT PRIMARY KEY,
  match_request_id TEXT NOT NULL REFERENCES match_requests(id) ON DELETE RESTRICT,
  business_id TEXT REFERENCES businesses(id) ON DELETE RESTRICT,
  offering_id TEXT REFERENCES offerings(id) ON DELETE RESTRICT,
  retrieval_source TEXT NOT NULL,
  retrieval_score REAL CHECK (retrieval_score IS NULL OR retrieval_score >= 0),
  ranking_score REAL CHECK (ranking_score IS NULL OR ranking_score >= 0),
  rank_position INTEGER CHECK (rank_position IS NULL OR rank_position > 0),
  eligibility_status TEXT NOT NULL CHECK (eligibility_status IN ('unknown','eligible','ineligible','blocked')),
  reasons_json TEXT,
  feature_snapshot_json TEXT,
  created_at TEXT NOT NULL,
  CHECK (
    (business_id IS NOT NULL AND offering_id IS NULL)
    OR (business_id IS NULL AND offering_id IS NOT NULL)
  ),
  UNIQUE(match_request_id, business_id, offering_id)
);

CREATE INDEX idx_match_candidates_request_rank
  ON match_candidates(match_request_id, rank_position, ranking_score DESC);

CREATE INDEX idx_match_candidates_business
  ON match_candidates(business_id);

CREATE INDEX idx_match_candidates_offering
  ON match_candidates(offering_id);

CREATE TABLE match_decisions (
  id TEXT PRIMARY KEY,
  match_request_id TEXT NOT NULL REFERENCES match_requests(id) ON DELETE RESTRICT,
  candidate_id TEXT NOT NULL REFERENCES match_candidates(id) ON DELETE RESTRICT,
  decision TEXT NOT NULL CHECK (decision IN ('selected','rejected','deferred','excluded')),
  reason_code TEXT,
  decision_source TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  actor_reference TEXT,
  decided_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_match_decisions_request_time
  ON match_decisions(match_request_id, decided_at DESC, id DESC);

CREATE INDEX idx_match_decisions_candidate
  ON match_decisions(candidate_id, decided_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_demand_request_customer_scope
BEFORE INSERT ON demand_requests
FOR EACH ROW
WHEN NEW.customer_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM customers c
   WHERE c.id = NEW.customer_id
     AND c.organization_id = NEW.organization_id
 )
BEGIN
  SELECT RAISE(ABORT, 'Demand request customer crosses organization boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_demand_request_workspace_scope
BEFORE INSERT ON demand_requests
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM workspaces w
   WHERE w.id = NEW.workspace_id
     AND w.organization_id = NEW.organization_id
 )
BEGIN
  SELECT RAISE(ABORT, 'Demand request workspace crosses organization boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_match_request_scope
BEFORE INSERT ON match_requests
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM demand_requests d
  WHERE d.id = NEW.demand_request_id
    AND d.organization_id = NEW.organization_id
    AND (
      (d.workspace_id IS NULL AND NEW.workspace_id IS NULL)
      OR d.workspace_id = NEW.workspace_id
    )
)
BEGIN
  SELECT RAISE(ABORT, 'Match request scope does not match Demand request');
END;

CREATE TRIGGER IF NOT EXISTS trg_match_candidate_business_scope
BEFORE INSERT ON match_candidates
FOR EACH ROW
WHEN NEW.business_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1
   FROM match_requests mr
   INNER JOIN businesses b ON b.id = NEW.business_id
   WHERE mr.id = NEW.match_request_id
     AND b.organization_id = mr.organization_id
     AND (mr.workspace_id IS NULL OR b.workspace_id = mr.workspace_id)
 )
BEGIN
  SELECT RAISE(ABORT, 'Business candidate crosses match-request scope');
END;

CREATE TRIGGER IF NOT EXISTS trg_match_candidate_offering_scope
BEFORE INSERT ON match_candidates
FOR EACH ROW
WHEN NEW.offering_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1
   FROM match_requests mr
   INNER JOIN offerings o ON o.id = NEW.offering_id
   INNER JOIN businesses b ON b.id = o.business_id
   WHERE mr.id = NEW.match_request_id
     AND b.organization_id = mr.organization_id
     AND (mr.workspace_id IS NULL OR b.workspace_id = mr.workspace_id)
 )
BEGIN
  SELECT RAISE(ABORT, 'Offering candidate crosses match-request scope');
END;

CREATE TRIGGER IF NOT EXISTS trg_match_decision_scope
BEFORE INSERT ON match_decisions
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM match_candidates mc
  INNER JOIN match_requests mr ON mr.id = mc.match_request_id
  WHERE mc.id = NEW.candidate_id
    AND mr.id = NEW.match_request_id
)
BEGIN
  SELECT RAISE(ABORT, 'Match decision candidate does not belong to match request');
END;
