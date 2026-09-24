-- Link authoritative Act records back to the MatchRequest/Candidate that caused the Act.
-- These are references only; Booking and Commerce remain authoritative for their own state.
ALTER TABLE bookings ADD COLUMN match_request_id TEXT REFERENCES match_requests(id) ON DELETE RESTRICT;
ALTER TABLE bookings ADD COLUMN match_candidate_id TEXT REFERENCES match_candidates(id) ON DELETE RESTRICT;

CREATE INDEX idx_bookings_match_request
  ON bookings(match_request_id, created_at DESC);

CREATE INDEX idx_bookings_match_candidate
  ON bookings(match_candidate_id, created_at DESC);

ALTER TABLE commerce_orders ADD COLUMN match_request_id TEXT REFERENCES match_requests(id) ON DELETE RESTRICT;
ALTER TABLE commerce_orders ADD COLUMN match_candidate_id TEXT REFERENCES match_candidates(id) ON DELETE RESTRICT;

CREATE INDEX idx_commerce_orders_match_request
  ON commerce_orders(match_request_id, created_at DESC);

CREATE INDEX idx_commerce_orders_match_candidate
  ON commerce_orders(match_candidate_id, created_at DESC);
