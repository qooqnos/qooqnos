-- Establish immutable Verification Policy and Requirement vocabulary.
-- Policies are versioned rule sets; requirements are policy-version scoped.

CREATE TABLE verification_policies (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  jurisdiction TEXT,
  industry TEXT,
  subject_type TEXT NOT NULL CHECK (
    subject_type IN (
      'business',
      'user',
      'professional_credential',
      'location',
      'ownership_claim',
      'other'
    )
  ),
  risk_class TEXT NOT NULL,
  effective_from TEXT,
  effective_to TEXT,
  human_review_rules TEXT,
  expiry_rules TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft','active','retired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(id, version)
);

CREATE INDEX idx_verification_policies_status_effective
  ON verification_policies(status, effective_from, effective_to);

CREATE TABLE verification_requirements (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  subject_type TEXT NOT NULL CHECK (
    subject_type IN (
      'business',
      'user',
      'professional_credential',
      'location',
      'ownership_claim',
      'other'
    )
  ),
  jurisdiction TEXT,
  industry TEXT,
  requirement_type TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 1 CHECK (required IN (0,1)),
  evidence_types TEXT NOT NULL,
  human_review_required INTEGER NOT NULL DEFAULT 0 CHECK (human_review_required IN (0,1)),
  effective_from TEXT,
  effective_to TEXT,
  expiry_rule TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (policy_id, policy_version)
    REFERENCES verification_policies(id, version)
    ON DELETE RESTRICT
);

CREATE INDEX idx_verification_requirements_policy
  ON verification_requirements(policy_id, policy_version);

CREATE INDEX idx_verification_requirements_subject
  ON verification_requirements(subject_type, jurisdiction, industry);
