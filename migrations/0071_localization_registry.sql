-- Localization registry foundation.
-- One canonical registry boundary for locale, jurisdiction and market presentation.
-- Do not create domain-specific country/locale tables outside this module.

CREATE TABLE localization_legal_profiles (
  id TEXT PRIMARY KEY,
  jurisdiction_code TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','active','retired')),
  effective_at TEXT NOT NULL,
  policy_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(jurisdiction_code, version)
);

CREATE TABLE localization_locales (
  code TEXT PRIMARY KEY,
  language_code TEXT NOT NULL,
  script_code TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('ltr','rtl')),
  default_calendar TEXT NOT NULL CHECK (default_calendar IN ('gregorian','jalali')),
  fallback_locale_code TEXT REFERENCES localization_locales(code) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('active','retired')),
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE localization_countries (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  default_locale_code TEXT NOT NULL REFERENCES localization_locales(code) ON DELETE RESTRICT,
  default_currency_code TEXT NOT NULL,
  default_timezone TEXT NOT NULL,
  legal_profile_id TEXT REFERENCES localization_legal_profiles(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('active','retired')),
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE localization_regions (
  id TEXT PRIMARY KEY,
  country_code TEXT NOT NULL REFERENCES localization_countries(code) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  region_type TEXT NOT NULL,
  parent_region_id TEXT REFERENCES localization_regions(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('active','retired')),
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(country_code, code),
  UNIQUE(country_code, id)
);

CREATE TABLE localization_market_profiles (
  id TEXT PRIMARY KEY,
  market_code TEXT NOT NULL UNIQUE,
  country_code TEXT NOT NULL REFERENCES localization_countries(code) ON DELETE RESTRICT,
  region_id TEXT REFERENCES localization_regions(id) ON DELETE RESTRICT,
  locale_code TEXT NOT NULL REFERENCES localization_locales(code) ON DELETE RESTRICT,
  legal_profile_id TEXT REFERENCES localization_legal_profiles(id) ON DELETE RESTRICT,
  timezone TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  calendar_code TEXT NOT NULL CHECK (calendar_code IN ('gregorian','jalali')),
  status TEXT NOT NULL CHECK (status IN ('active','retired')),
  config_json TEXT NOT NULL DEFAULT '{}',
  version TEXT NOT NULL,
  effective_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE localization_domain_configs (
  id TEXT PRIMARY KEY,
  market_code TEXT NOT NULL REFERENCES localization_market_profiles(market_code) ON DELETE RESTRICT,
  domain_key TEXT NOT NULL,
  locale_code TEXT REFERENCES localization_locales(code) ON DELETE RESTRICT,
  version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','active','retired')),
  config_json TEXT NOT NULL DEFAULT '{}',
  effective_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(market_code, domain_key, version)
);

CREATE INDEX idx_localization_regions_country_status
  ON localization_regions(country_code, status, name);

CREATE INDEX idx_localization_markets_country_status
  ON localization_market_profiles(country_code, status, market_code);

CREATE INDEX idx_localization_domain_configs_lookup
  ON localization_domain_configs(market_code, domain_key, status, version);

CREATE TRIGGER trg_localization_market_region_scope_insert
BEFORE INSERT ON localization_market_profiles
FOR EACH ROW
WHEN NEW.region_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM localization_regions r
   WHERE r.id = NEW.region_id AND r.country_code = NEW.country_code
 )
BEGIN
  SELECT RAISE(ABORT, 'Localization market region crosses country boundary');
END;

CREATE TRIGGER trg_localization_market_region_scope_update
BEFORE UPDATE OF country_code, region_id ON localization_market_profiles
FOR EACH ROW
WHEN NEW.region_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM localization_regions r
   WHERE r.id = NEW.region_id AND r.country_code = NEW.country_code
 )
BEGIN
  SELECT RAISE(ABORT, 'Localization market region crosses country boundary');
END;

CREATE TRIGGER trg_localization_domain_locale_status_insert
BEFORE INSERT ON localization_domain_configs
FOR EACH ROW
WHEN NEW.locale_code IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM localization_locales l
   WHERE l.code = NEW.locale_code AND l.status = 'active'
 )
BEGIN
  SELECT RAISE(ABORT, 'Localization domain config requires an active locale');
END;

CREATE TRIGGER trg_localization_domain_locale_status_update
BEFORE UPDATE OF locale_code ON localization_domain_configs
FOR EACH ROW
WHEN NEW.locale_code IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM localization_locales l
   WHERE l.code = NEW.locale_code AND l.status = 'active'
 )
BEGIN
  SELECT RAISE(ABORT, 'Localization domain config requires an active locale');
END;

INSERT INTO localization_locales
(code, language_code, script_code, direction, default_calendar, fallback_locale_code, status, metadata_json, created_at, updated_at)
VALUES
('en', 'en', 'Latn', 'ltr', 'gregorian', NULL, 'active', '{}', '2026-09-24T00:00:00.000Z', '2026-09-24T00:00:00.000Z'),
('fa', 'fa', 'Arab', 'rtl', 'jalali', 'en', 'active', '{}', '2026-09-24T00:00:00.000Z', '2026-09-24T00:00:00.000Z'),
('ar', 'ar', 'Arab', 'rtl', 'gregorian', 'en', 'active', '{}', '2026-09-24T00:00:00.000Z', '2026-09-24T00:00:00.000Z');
