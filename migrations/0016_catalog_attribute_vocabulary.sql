-- Establish the canonical Catalog Attribute vocabulary without creating
-- a second product/service value store. Existing product_variants.attributes_json
-- remains the current physical value representation until value migration semantics
-- are explicitly finalized.

CREATE TABLE attribute_definitions (
  id TEXT PRIMARY KEY,
  canonical_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  data_type TEXT NOT NULL CHECK (
    data_type IN ('text','integer','number','boolean','date','datetime','enum','multi_enum')
  ),
  status TEXT NOT NULL CHECK (status IN ('active','inactive','archived')),
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(canonical_key)
);

CREATE TABLE attribute_options (
  id TEXT PRIMARY KEY,
  attribute_definition_id TEXT NOT NULL
    REFERENCES attribute_definitions(id) ON DELETE CASCADE,
  canonical_value TEXT NOT NULL,
  display_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('active','inactive','archived')),
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(attribute_definition_id, canonical_value)
);

CREATE TABLE category_attributes (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  attribute_definition_id TEXT NOT NULL
    REFERENCES attribute_definitions(id) ON DELETE RESTRICT,
  is_required INTEGER NOT NULL DEFAULT 0 CHECK (is_required IN (0,1)),
  is_filterable INTEGER NOT NULL DEFAULT 0 CHECK (is_filterable IN (0,1)),
  is_searchable INTEGER NOT NULL DEFAULT 0 CHECK (is_searchable IN (0,1)),
  is_variant_dimension INTEGER NOT NULL DEFAULT 0 CHECK (is_variant_dimension IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  constraints_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(category_id, attribute_definition_id)
);

CREATE INDEX idx_attribute_options_definition_status
  ON attribute_options(attribute_definition_id, status);

CREATE INDEX idx_category_attributes_category_sort
  ON category_attributes(category_id, sort_order);

CREATE INDEX idx_category_attributes_definition
  ON category_attributes(attribute_definition_id);
