-- Canonical permission definitions for the currently executable domain modules.
-- Module manifests remain the application registry; these rows are the persisted Access vocabulary.
INSERT OR IGNORE INTO permissions (id, resource, action, created_at) VALUES
  ('business.create', 'business', 'create', '2026-01-01T00:00:00.000Z'),
  ('business.update', 'business', 'update', '2026-01-01T00:00:00.000Z'),
  ('business.publish', 'business', 'publish', '2026-01-01T00:00:00.000Z'),
  ('catalog.product.create', 'catalog.product', 'create', '2026-01-01T00:00:00.000Z'),
  ('catalog.product_variant.create', 'catalog.product_variant', 'create', '2026-01-01T00:00:00.000Z'),
  ('catalog.offering.create', 'catalog.offering', 'create', '2026-01-01T00:00:00.000Z'),
  ('catalog.offering.publish', 'catalog.offering', 'publish', '2026-01-01T00:00:00.000Z'),
  ('onboarding.create', 'onboarding', 'create', '2026-01-01T00:00:00.000Z'),
  ('onboarding.submit', 'onboarding', 'submit', '2026-01-01T00:00:00.000Z'),
  ('onboarding.verify', 'onboarding', 'verify', '2026-01-01T00:00:00.000Z'),
  ('onboarding.reject', 'onboarding', 'reject', '2026-01-01T00:00:00.000Z');
