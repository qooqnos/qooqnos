-- Harden Demand/Matching uniqueness and immutable decision history.
CREATE UNIQUE INDEX uq_match_candidate_business
  ON match_candidates(match_request_id, business_id)
  WHERE business_id IS NOT NULL;

CREATE UNIQUE INDEX uq_match_candidate_offering
  ON match_candidates(match_request_id, offering_id)
  WHERE offering_id IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS trg_match_decision_update_immutable
BEFORE UPDATE ON match_decisions
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Match decisions are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_match_decision_delete_immutable
BEFORE DELETE ON match_decisions
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Match decisions are append-only');
END;
