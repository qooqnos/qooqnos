CREATE TABLE businesses (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','active','suspended','archived')),
  publication_status TEXT NOT NULL CHECK (publication_status IN ('unpublished','pending','published','blocked')),
  business_type TEXT,
  primary_category_id TEXT,
  default_locale TEXT,
  timezone TEXT,
  default_currency TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE business_profiles (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  description TEXT,
  contact_json TEXT,
  branding_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE locations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location_type TEXT NOT NULL CHECK (location_type IN ('physical','virtual','service_area')),
  timezone TEXT,
  address_json TEXT,
  geo_point_json TEXT,
  status TEXT NOT NULL CHECK (status IN ('active','inactive','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_businesses_workspace_status ON businesses(workspace_id, status);
CREATE INDEX idx_businesses_org ON businesses(organization_id);
CREATE INDEX idx_businesses_publication ON businesses(publication_status);
CREATE INDEX idx_locations_business_status ON locations(business_id, status);
