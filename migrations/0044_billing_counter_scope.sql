-- Correct Billing usage counter uniqueness to include the Business scope.
DROP INDEX IF EXISTS uq_billing_usage_counter_scope;

CREATE UNIQUE INDEX uq_billing_usage_counter_scope
  ON billing_usage_counters(
    organization_id,
    COALESCE(workspace_id, ''),
    COALESCE(business_id, ''),
    meter_id,
    period_key
  );
