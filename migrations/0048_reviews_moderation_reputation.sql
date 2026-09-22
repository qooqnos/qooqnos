-- Complete the canonical Review moderation/reporting and reputation projection boundary.
ALTER TABLE reviews ADD COLUMN status TEXT NOT NULL DEFAULT 'draft' CHECK (
  status IN ('eligible','draft','submitted','pending_moderation','published','rejected','withdrawn','removed','expired')
);
ALTER TABLE reviews ADD COLUMN interaction_reference TEXT;
ALTER TABLE reviews ADD COLUMN locale TEXT;
ALTER TABLE reviews ADD COLUMN published_at TEXT;
ALTER TABLE reviews ADD COLUMN policy_version TEXT NOT NULL DEFAULT 'v1';
ALTER TABLE reviews ADD COLUMN content_version INTEGER NOT NULL DEFAULT 1 CHECK (content_version >= 1);

CREATE INDEX idx_reviews_status_time
  ON reviews(status, created_at DESC);

CREATE INDEX idx_reviews_interaction
  ON reviews(interaction_reference);

CREATE TABLE review_reports (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE RESTRICT,
  reporter_reference TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL CHECK (status IN ('open','reviewed','actioned','dismissed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(review_id, reporter_reference, reason_code)
);

CREATE INDEX idx_review_reports_review_status
  ON review_reports(review_id, status, created_at DESC);

CREATE TABLE review_responses (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE RESTRICT,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  actor_reference TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','pending_moderation','published','rejected','removed')),
  moderation_state TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  content_version INTEGER NOT NULL DEFAULT 1 CHECK (content_version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_review_responses_review_status
  ON review_responses(review_id, status, created_at DESC);

CREATE TABLE review_moderation_cases (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('open','in_review','resolved','escalated')),
  reason_code TEXT,
  policy_version TEXT NOT NULL,
  assigned_to TEXT,
  opened_at TEXT NOT NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (resolved_at IS NULL OR resolved_at >= opened_at)
);

CREATE UNIQUE INDEX uq_review_active_moderation_case
  ON review_moderation_cases(review_id)
  WHERE status IN ('open','in_review','escalated');

CREATE TABLE review_moderation_decisions (
  id TEXT PRIMARY KEY,
  moderation_case_id TEXT NOT NULL REFERENCES review_moderation_cases(id) ON DELETE RESTRICT,
  decision TEXT NOT NULL CHECK (decision IN ('approve','reject','remove','restrict','restore')),
  actor_reference TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_review_moderation_decisions_case_time
  ON review_moderation_decisions(moderation_case_id, decided_at DESC, id DESC);

CREATE TABLE review_risk_signals (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE RESTRICT,
  signal_type TEXT NOT NULL,
  value_json TEXT,
  confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  source TEXT NOT NULL,
  model_version TEXT,
  policy_version TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_review_risk_signals_review_type
  ON review_risk_signals(review_id, signal_type, created_at DESC);

CREATE TABLE reputation_summaries (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  target_type TEXT NOT NULL CHECK (target_type IN ('business','offering','product')),
  target_id TEXT NOT NULL,
  published_review_count INTEGER NOT NULL DEFAULT 0 CHECK (published_review_count >= 0),
  rating_sum INTEGER NOT NULL DEFAULT 0 CHECK (rating_sum >= 0),
  rating_distribution_json TEXT NOT NULL DEFAULT '{}',
  report_count INTEGER NOT NULL DEFAULT 0 CHECK (report_count >= 0),
  projection_version INTEGER NOT NULL DEFAULT 1 CHECK (projection_version >= 1),
  source_review_cursor TEXT,
  calculated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id, COALESCE(workspace_id, ''), target_type, target_id)
);

CREATE INDEX idx_reputation_summaries_target
  ON reputation_summaries(target_type, target_id);

CREATE TABLE reputation_versions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  target_type TEXT NOT NULL CHECK (target_type IN ('business','offering','product')),
  target_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  policy_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('building','active','retired','failed')),
  generated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(organization_id, COALESCE(workspace_id, ''), target_type, target_id, version)
);

CREATE TRIGGER IF NOT EXISTS trg_review_response_target_business_scope
BEFORE INSERT ON review_responses
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM reviews r
  LEFT JOIN offerings o ON o.id = r.offering_id
  LEFT JOIN products p ON p.id = r.product_id
  WHERE r.id = NEW.review_id
    AND r.organization_id = (SELECT organization_id FROM businesses WHERE id = NEW.business_id)
    AND (
      r.business_id = NEW.business_id
      OR (r.offering_id IS NOT NULL AND o.business_id = NEW.business_id)
      OR (r.product_id IS NOT NULL AND p.business_id = NEW.business_id)
    )
)
BEGIN
  SELECT RAISE(ABORT, 'Review response business does not own the review target');
END;

CREATE TRIGGER IF NOT EXISTS trg_review_moderation_decision_immutability
BEFORE UPDATE ON review_moderation_decisions
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Review moderation decisions are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_review_moderation_decision_delete_immutability
BEFORE DELETE ON review_moderation_decisions
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Review moderation decisions are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_reputation_summary_target_scope
BEFORE INSERT ON reputation_summaries
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM businesses b
  WHERE NEW.target_type = 'business'
    AND b.id = NEW.target_id
    AND b.organization_id = NEW.organization_id
)
AND NOT EXISTS (
  SELECT 1
  FROM offerings o
  INNER JOIN businesses b ON b.id = o.business_id
  WHERE NEW.target_type = 'offering'
    AND o.id = NEW.target_id
    AND b.organization_id = NEW.organization_id
)
AND NOT EXISTS (
  SELECT 1
  FROM products p
  INNER JOIN businesses b ON b.id = p.business_id
  WHERE NEW.target_type = 'product'
    AND p.id = NEW.target_id
    AND b.organization_id = NEW.organization_id
)
BEGIN
  SELECT RAISE(ABORT, 'Reputation summary target crosses organization boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_reputation_version_target_scope
BEFORE INSERT ON reputation_versions
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM businesses b
  WHERE NEW.target_type = 'business'
    AND b.id = NEW.target_id
    AND b.organization_id = NEW.organization_id
)
AND NOT EXISTS (
  SELECT 1
  FROM offerings o
  INNER JOIN businesses b ON b.id = o.business_id
  WHERE NEW.target_type = 'offering'
    AND o.id = NEW.target_id
    AND b.organization_id = NEW.organization_id
)
AND NOT EXISTS (
  SELECT 1
  FROM products p
  INNER JOIN businesses b ON b.id = p.business_id
  WHERE NEW.target_type = 'product'
    AND p.id = NEW.target_id
    AND b.organization_id = NEW.organization_id
)
BEGIN
  SELECT RAISE(ABORT, 'Reputation version target crosses organization boundary');
END;
