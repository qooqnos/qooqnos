CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
  scope TEXT NOT NULL CHECK (scope IN ('platform','organization','workspace')),
  canonical_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','inactive','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(scope, canonical_key)
);

CREATE TABLE services (
  id TEXT PRIMARY KEY,
  business_id TEXT REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft','active','inactive','archived')),
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft','active','inactive','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT,
  attributes_json TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft','active','inactive','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE offerings (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  offering_type TEXT NOT NULL CHECK (offering_type IN ('service','product')),
  title TEXT NOT NULL,
  description TEXT,
  service_id TEXT REFERENCES services(id) ON DELETE RESTRICT,
  product_id TEXT REFERENCES products(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('draft','active','inactive','archived')),
  publication_status TEXT NOT NULL CHECK (publication_status IN ('unpublished','pending','published','blocked')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE business_categories (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  UNIQUE(business_id, category_id)
);

CREATE TABLE offering_categories (
  id TEXT PRIMARY KEY,
  offering_id TEXT NOT NULL REFERENCES offerings(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  UNIQUE(offering_id, category_id)
);

CREATE TABLE prices (
  id TEXT PRIMARY KEY,
  offering_id TEXT NOT NULL REFERENCES offerings(id) ON DELETE CASCADE,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  pricing_type TEXT NOT NULL CHECK (pricing_type IN ('fixed','starting_at','from','custom','free')),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  status TEXT NOT NULL CHECK (status IN ('active','inactive','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE TABLE inventory_items (
  id TEXT PRIMARY KEY,
  product_variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  quantity_on_hand INTEGER NOT NULL CHECK (quantity_on_hand >= 0),
  quantity_reserved INTEGER NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (quantity_reserved <= quantity_on_hand),
  UNIQUE(product_variant_id, location_id)
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_services_business_status ON services(business_id, status);
CREATE INDEX idx_products_business_status ON products(business_id, status);
CREATE INDEX idx_product_variants_product_status ON product_variants(product_id, status);
CREATE UNIQUE INDEX uq_product_variants_sku ON product_variants(sku) WHERE sku IS NOT NULL;
CREATE INDEX idx_offerings_business_status ON offerings(business_id, status, publication_status);
CREATE INDEX idx_offerings_service ON offerings(service_id);
CREATE INDEX idx_offerings_product ON offerings(product_id);
CREATE INDEX idx_prices_offering_effective ON prices(offering_id, effective_from, effective_to);
CREATE INDEX idx_inventory_location ON inventory_items(location_id);
