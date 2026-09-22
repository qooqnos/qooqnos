-- Establish the canonical shared AI Runtime persistence boundary.
CREATE TABLE ai_operation_types (
  id TEXT PRIMARY KEY,
  operation_type TEXT NOT NULL UNIQUE,
  description TEXT,
  active_version INTEGER NOT NULL DEFAULT 1 CHECK (active_version >= 1),
  status TEXT NOT NULL CHECK (status IN ('draft','active','retired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE ai_providers (
  id TEXT PRIMARY KEY,
  provider_key TEXT NOT NULL UNIQUE,
  provider_name TEXT NOT NULL,
  adapter_version TEXT NOT NULL,
  capabilities_json TEXT NOT NULL,
  supported_regions_json TEXT,
  health_status TEXT NOT NULL CHECK (health_status IN ('healthy','degraded','blocked','unknown')),
  policy_eligibility_json TEXT,
  effective_from TEXT,
  effective_to TEXT,
  status TEXT NOT NULL CHECK (status IN ('active','inactive','retired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE ai_models (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES ai_providers(id) ON DELETE RESTRICT,
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  operation_classes_json TEXT NOT NULL,
  modalities_json TEXT,
  limits_json TEXT,
  structured_output_supported INTEGER NOT NULL DEFAULT 0 CHECK (structured_output_supported IN (0,1)),
  tool_support INTEGER NOT NULL DEFAULT 0 CHECK (tool_support IN (0,1)),
  language_locales_json TEXT,
  permitted_classifications_json TEXT,
  permitted_regions_json TEXT,
  availability_status TEXT NOT NULL CHECK (availability_status IN ('available','degraded','blocked','retired')),
  routing_priority INTEGER NOT NULL DEFAULT 100,
  fallback_group TEXT,
  cost_metadata_reference TEXT,
  effective_from TEXT,
  effective_to TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider_id, model_name, model_version)
);

CREATE INDEX idx_ai_models_routing
  ON ai_models(availability_status, routing_priority, fallback_group);

CREATE TABLE ai_prompts (
  id TEXT PRIMARY KEY,
  operation_type_id TEXT NOT NULL REFERENCES ai_operation_types(id) ON DELETE RESTRICT,
  owner_reference TEXT NOT NULL,
  purpose TEXT NOT NULL,
  locale TEXT,
  variable_contract_reference TEXT,
  safety_policy_reference TEXT,
  output_schema_reference TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft','active','retired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE ai_prompt_versions (
  id TEXT PRIMARY KEY,
  prompt_id TEXT NOT NULL REFERENCES ai_prompts(id) ON DELETE RESTRICT,
  semantic_version TEXT NOT NULL,
  instruction_reference TEXT NOT NULL,
  content_checksum TEXT NOT NULL,
  compatible_operation_version INTEGER NOT NULL,
  compatible_schema_version TEXT,
  evaluation_status TEXT NOT NULL CHECK (evaluation_status IN ('draft','evaluated','approved','rejected','retired')),
  release_at TEXT,
  effective_at TEXT,
  rollback_target_id TEXT REFERENCES ai_prompt_versions(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  UNIQUE(prompt_id, semantic_version)
);

CREATE TABLE ai_schemas (
  id TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,
  operation_class TEXT NOT NULL,
  owner_reference TEXT NOT NULL,
  compatibility_policy TEXT NOT NULL,
  validation_mode TEXT NOT NULL CHECK (validation_mode IN ('strict','permissive','advisory')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE ai_schema_versions (
  id TEXT PRIMARY KEY,
  schema_id TEXT NOT NULL REFERENCES ai_schemas(id) ON DELETE RESTRICT,
  semantic_version TEXT NOT NULL,
  structural_definition_reference TEXT NOT NULL,
  required_fields_json TEXT,
  validation_rules_json TEXT,
  provenance_requirements_json TEXT,
  abstention_rules_json TEXT,
  compatibility_status TEXT NOT NULL CHECK (compatibility_status IN ('draft','compatible','breaking','retired')),
  release_at TEXT,
  effective_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(schema_id, semantic_version)
);

CREATE TABLE ai_policies (
  id TEXT PRIMARY KEY,
  policy_key TEXT NOT NULL UNIQUE,
  policy_version TEXT NOT NULL,
  data_classification_rules_json TEXT,
  provider_model_rules_json TEXT,
  safety_requirements_json TEXT,
  regulated_workflow_rules_json TEXT,
  tool_side_effect_rules_json TEXT,
  human_review_rules_json TEXT,
  retention_rules_json TEXT,
  output_validation_rules_json TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft','active','retired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(policy_key, policy_version)
);

CREATE TABLE ai_operations (
  id TEXT PRIMARY KEY,
  operation_type_id TEXT NOT NULL REFERENCES ai_operation_types(id) ON DELETE RESTRICT,
  operation_type TEXT NOT NULL,
  operation_version INTEGER NOT NULL CHECK (operation_version >= 1),
  session_id TEXT,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  actor_id TEXT,
  request_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('created','entitlement_checked','started','succeeded','partially_succeeded','failed','cancelled','expired','blocked')),
  input_reference TEXT,
  input_hash TEXT,
  output_reference TEXT,
  prompt_reference TEXT,
  schema_reference TEXT,
  policy_reference TEXT,
  model_selection_reference TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id, idempotency_key)
);

CREATE INDEX idx_ai_operations_tenant_status
  ON ai_operations(organization_id, workspace_id, status, created_at DESC);

CREATE INDEX idx_ai_operations_type_time
  ON ai_operations(operation_type, operation_version, created_at DESC);

CREATE TABLE ai_model_routing_decisions (
  id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL REFERENCES ai_operations(id) ON DELETE RESTRICT,
  routing_policy_reference TEXT NOT NULL,
  candidate_models_json TEXT NOT NULL,
  selected_model_id TEXT REFERENCES ai_models(id) ON DELETE RESTRICT,
  selected_provider_id TEXT REFERENCES ai_providers(id) ON DELETE RESTRICT,
  fallback_group TEXT,
  decision_factors_json TEXT,
  policy_constraints_json TEXT,
  decided_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE ai_policy_decisions (
  id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL REFERENCES ai_operations(id) ON DELETE RESTRICT,
  policy_id TEXT NOT NULL REFERENCES ai_policies(id) ON DELETE RESTRICT,
  decision_type TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('allow','deny','block')),
  reason_code TEXT,
  risk_context_json TEXT,
  evaluator_version TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE ai_provider_attempts (
  id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL REFERENCES ai_operations(id) ON DELETE RESTRICT,
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
  provider_id TEXT NOT NULL REFERENCES ai_providers(id) ON DELETE RESTRICT,
  model_id TEXT REFERENCES ai_models(id) ON DELETE RESTRICT,
  provider_request_id TEXT,
  request_reference TEXT,
  response_reference TEXT,
  status TEXT NOT NULL CHECK (status IN ('started','succeeded','failed','timeout','ambiguous','cancelled')),
  error_classification TEXT,
  error_code TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  input_units INTEGER,
  output_units INTEGER,
  timeout_metadata_json TEXT,
  retry_metadata_json TEXT,
  fallback_metadata_json TEXT,
  internal_cost_estimate_json TEXT,
  UNIQUE(operation_id, attempt_number)
);

CREATE INDEX idx_ai_provider_attempts_operation_time
  ON ai_provider_attempts(operation_id, attempt_number);

CREATE TABLE ai_runtime_results (
  id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL REFERENCES ai_operations(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('succeeded','partially_succeeded','failed','blocked','abstained')),
  validated_output_reference TEXT,
  schema_version_reference TEXT,
  provider_id TEXT REFERENCES ai_providers(id) ON DELETE RESTRICT,
  model_id TEXT REFERENCES ai_models(id) ON DELETE RESTRICT,
  safety_outcome TEXT,
  provenance_json TEXT,
  warnings_json TEXT,
  abstention_json TEXT,
  attempt_summary_json TEXT,
  error_classification TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(operation_id)
);

CREATE TABLE ai_usage_records (
  id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL REFERENCES ai_operations(id) ON DELETE RESTRICT,
  attempt_id TEXT REFERENCES ai_provider_attempts(id) ON DELETE RESTRICT,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE RESTRICT,
  actor_id TEXT,
  operation_type TEXT NOT NULL,
  operation_version INTEGER NOT NULL,
  meter_unit TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  provider_id TEXT REFERENCES ai_providers(id) ON DELETE RESTRICT,
  model_id TEXT REFERENCES ai_models(id) ON DELETE RESTRICT,
  usage_status TEXT NOT NULL CHECK (usage_status IN ('recorded','reconciled','voided')),
  idempotency_key TEXT NOT NULL,
  entitlement_decision_reference TEXT,
  billing_usage_reference TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(organization_id, idempotency_key)
);

CREATE INDEX idx_ai_usage_operation_time
  ON ai_usage_records(operation_id, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_ai_operation_scope_insert
BEFORE INSERT ON ai_operations
FOR EACH ROW
WHEN NEW.workspace_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM workspaces w
   WHERE w.id = NEW.workspace_id
     AND w.organization_id = NEW.organization_id
 )
BEGIN
  SELECT RAISE(ABORT, 'AI operation workspace crosses organization boundary');
END;

CREATE TRIGGER IF NOT EXISTS trg_ai_operation_type_consistency
BEFORE INSERT ON ai_operations
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM ai_operation_types t
  WHERE t.id = NEW.operation_type_id
    AND t.operation_type = NEW.operation_type
)
BEGIN
  SELECT RAISE(ABORT, 'AI operation type reference mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_ai_attempt_scope
BEFORE INSERT ON ai_provider_attempts
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM ai_operations o
  WHERE o.id = NEW.operation_id
)
BEGIN
  SELECT RAISE(ABORT, 'AI provider attempt references unknown operation');
END;

CREATE TRIGGER IF NOT EXISTS trg_ai_usage_scope
BEFORE INSERT ON ai_usage_records
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM ai_operations o
  WHERE o.id = NEW.operation_id
    AND o.organization_id = NEW.organization_id
)
BEGIN
  SELECT RAISE(ABORT, 'AI usage record crosses operation tenant boundary');
END;
