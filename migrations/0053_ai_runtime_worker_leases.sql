-- Add durable AI Runtime worker lease state without creating a second execution ledger.
ALTER TABLE ai_operations ADD COLUMN worker_lease_until TEXT;
ALTER TABLE ai_operations ADD COLUMN worker_claimed_by TEXT;
ALTER TABLE ai_operations ADD COLUMN worker_attempts INTEGER NOT NULL DEFAULT 0 CHECK (worker_attempts >= 0);

CREATE INDEX idx_ai_operations_worker_queue
  ON ai_operations(status, worker_lease_until, created_at);

CREATE INDEX idx_ai_operations_worker_owner
  ON ai_operations(worker_claimed_by, status);
