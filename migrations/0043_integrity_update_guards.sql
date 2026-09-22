-- Harden update-time tenant integrity guards for Match candidates and Review customers.
CREATE TRIGGER IF NOT EXISTS trg_match_candidate_business_scope_update
BEFORE UPDATE OF match_request_id, business_id ON match_candidates
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

CREATE TRIGGER IF NOT EXISTS trg_match_candidate_offering_scope_update
BEFORE UPDATE OF match_request_id, offering_id ON match_candidates
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

CREATE TRIGGER IF NOT EXISTS trg_reviews_customer_scope_update
BEFORE UPDATE OF organization_id, workspace_id, customer_id ON reviews
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM customers c
  WHERE c.id = NEW.customer_id
    AND c.organization_id = NEW.organization_id
)
BEGIN
  SELECT RAISE(ABORT, 'Review customer crosses organization boundary');
END;
