-- Phoenix runtime bootstrap metadata.
-- This migration intentionally contains only platform metadata; domain tables belong to module-owned migrations.

CREATE TABLE IF NOT EXISTS _phoenix_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS _phoenix_runtime (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO _phoenix_runtime (key, value)
VALUES ('schema_version', '1');
