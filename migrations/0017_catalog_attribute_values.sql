-- Introduce canonical AttributeValue storage as an expand-only phase.
-- Existing product_variants.attributes_json remains authoritative until a later
-- migration defines backfill/cutover semantics.

CREATE TABLE attribute_values (
  id TEXT PRIMARY KEY,
  attribute_definition_id TEXT NOT NULL
    REFERENCES attribute_definitions(id) ON DELETE RESTRICT,
  target_type TEXT NOT NULL CHECK (
    target_type IN ('product','product_variant','service')
  ),
  target_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (
    source_type IN (
      'seller_input',
      'seller_confirmed',
      'ai_extracted',
      'ai_generated',
      'system_derived',
      'external_verified',
      'policy_validated'
    )
  ),
  source_reference TEXT,
  confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  option_id TEXT REFERENCES attribute_options(id) ON DELETE RESTRICT,
  text_value TEXT,
  integer_value INTEGER,
  number_value REAL,
  boolean_value INTEGER CHECK (boolean_value IS NULL OR boolean_value IN (0,1)),
  date_value TEXT,
  datetime_value TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(attribute_definition_id, target_type, target_id)
);

CREATE TABLE attribute_value_options (
  id TEXT PRIMARY KEY,
  attribute_value_id TEXT NOT NULL
    REFERENCES attribute_values(id) ON DELETE CASCADE,
  option_id TEXT NOT NULL
    REFERENCES attribute_options(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  UNIQUE(attribute_value_id, option_id)
);

CREATE INDEX idx_attribute_values_target
  ON attribute_values(target_type, target_id);

CREATE INDEX idx_attribute_values_definition_target
  ON attribute_values(attribute_definition_id, target_type, target_id);

CREATE INDEX idx_attribute_value_options_value
  ON attribute_value_options(attribute_value_id);

CREATE TRIGGER IF NOT EXISTS trg_attribute_values_target_exists_insert
BEFORE INSERT ON attribute_values
FOR EACH ROW
WHEN
  (NEW.target_type = 'product' AND NOT EXISTS (
    SELECT 1 FROM products p WHERE p.id = NEW.target_id
  ))
  OR
  (NEW.target_type = 'product_variant' AND NOT EXISTS (
    SELECT 1
    FROM product_variants pv
    WHERE pv.id = NEW.target_id
  ))
  OR
  (NEW.target_type = 'service' AND NOT EXISTS (
    SELECT 1 FROM services s WHERE s.id = NEW.target_id
  ))
BEGIN
  SELECT RAISE(ABORT, 'Attribute value references an unknown catalog target');
END;

CREATE TRIGGER IF NOT EXISTS trg_attribute_values_target_exists_update
BEFORE UPDATE OF target_type, target_id ON attribute_values
FOR EACH ROW
WHEN
  (NEW.target_type = 'product' AND NOT EXISTS (
    SELECT 1 FROM products p WHERE p.id = NEW.target_id
  ))
  OR
  (NEW.target_type = 'product_variant' AND NOT EXISTS (
    SELECT 1
    FROM product_variants pv
    WHERE pv.id = NEW.target_id
  ))
  OR
  (NEW.target_type = 'service' AND NOT EXISTS (
    SELECT 1 FROM services s WHERE s.id = NEW.target_id
  ))
BEGIN
  SELECT RAISE(ABORT, 'Attribute value references an unknown catalog target');
END;

CREATE TRIGGER IF NOT EXISTS trg_attribute_values_shape_insert
BEFORE INSERT ON attribute_values
FOR EACH ROW
WHEN
  EXISTS (
    SELECT 1
    FROM attribute_definitions ad
    WHERE ad.id = NEW.attribute_definition_id
      AND (
        (ad.data_type = 'text' AND (
          NEW.text_value IS NULL OR NEW.integer_value IS NOT NULL OR NEW.number_value IS NOT NULL
          OR NEW.boolean_value IS NOT NULL OR NEW.date_value IS NOT NULL
          OR NEW.datetime_value IS NOT NULL OR NEW.option_id IS NOT NULL
        ))
        OR
        (ad.data_type = 'integer' AND (
          NEW.integer_value IS NULL OR NEW.text_value IS NOT NULL OR NEW.number_value IS NOT NULL
          OR NEW.boolean_value IS NOT NULL OR NEW.date_value IS NOT NULL
          OR NEW.datetime_value IS NOT NULL OR NEW.option_id IS NOT NULL
        ))
        OR
        (ad.data_type = 'number' AND (
          NEW.number_value IS NULL OR NEW.text_value IS NOT NULL OR NEW.integer_value IS NOT NULL
          OR NEW.boolean_value IS NOT NULL OR NEW.date_value IS NOT NULL
          OR NEW.datetime_value IS NOT NULL OR NEW.option_id IS NOT NULL
        ))
        OR
        (ad.data_type = 'boolean' AND (
          NEW.boolean_value IS NULL OR NEW.text_value IS NOT NULL OR NEW.integer_value IS NOT NULL
          OR NEW.number_value IS NOT NULL OR NEW.date_value IS NOT NULL
          OR NEW.datetime_value IS NOT NULL OR NEW.option_id IS NOT NULL
        ))
        OR
        (ad.data_type = 'date' AND (
          NEW.date_value IS NULL OR NEW.text_value IS NOT NULL OR NEW.integer_value IS NOT NULL
          OR NEW.number_value IS NOT NULL OR NEW.boolean_value IS NOT NULL
          OR NEW.datetime_value IS NOT NULL OR NEW.option_id IS NOT NULL
        ))
        OR
        (ad.data_type = 'datetime' AND (
          NEW.datetime_value IS NULL OR NEW.text_value IS NOT NULL OR NEW.integer_value IS NOT NULL
          OR NEW.number_value IS NOT NULL OR NEW.boolean_value IS NOT NULL
          OR NEW.date_value IS NOT NULL OR NEW.option_id IS NOT NULL
        ))
        OR
        (ad.data_type = 'enum' AND (
          NEW.option_id IS NULL OR NEW.text_value IS NOT NULL OR NEW.integer_value IS NOT NULL
          OR NEW.number_value IS NOT NULL OR NEW.boolean_value IS NOT NULL
          OR NEW.date_value IS NOT NULL OR NEW.datetime_value IS NOT NULL
          OR NOT EXISTS (
            SELECT 1
            FROM attribute_options ao
            WHERE ao.id = NEW.option_id
              AND ao.attribute_definition_id = NEW.attribute_definition_id
          )
        ))
        OR
        (ad.data_type = 'multi_enum' AND (
          NEW.option_id IS NOT NULL OR NEW.text_value IS NOT NULL OR NEW.integer_value IS NOT NULL
          OR NEW.number_value IS NOT NULL OR NEW.boolean_value IS NOT NULL
          OR NEW.date_value IS NOT NULL OR NEW.datetime_value IS NOT NULL
        ))
      )
  )
  OR NOT EXISTS (
    SELECT 1
    FROM attribute_definitions ad
    WHERE ad.id = NEW.attribute_definition_id
  )
BEGIN
  SELECT RAISE(ABORT, 'Attribute value does not match its AttributeDefinition');
END;

CREATE TRIGGER IF NOT EXISTS trg_attribute_values_shape_update
BEFORE UPDATE OF attribute_definition_id, option_id, text_value, integer_value, number_value,
                 boolean_value, date_value, datetime_value ON attribute_values
FOR EACH ROW
WHEN
  EXISTS (
    SELECT 1
    FROM attribute_definitions ad
    WHERE ad.id = NEW.attribute_definition_id
      AND (
        (ad.data_type = 'text' AND (
          NEW.text_value IS NULL OR NEW.integer_value IS NOT NULL OR NEW.number_value IS NOT NULL
          OR NEW.boolean_value IS NOT NULL OR NEW.date_value IS NOT NULL
          OR NEW.datetime_value IS NOT NULL OR NEW.option_id IS NOT NULL
        ))
        OR
        (ad.data_type = 'integer' AND (
          NEW.integer_value IS NULL OR NEW.text_value IS NOT NULL OR NEW.number_value IS NOT NULL
          OR NEW.boolean_value IS NOT NULL OR NEW.date_value IS NOT NULL
          OR NEW.datetime_value IS NOT NULL OR NEW.option_id IS NOT NULL
        ))
        OR
        (ad.data_type = 'number' AND (
          NEW.number_value IS NULL OR NEW.text_value IS NOT NULL OR NEW.integer_value IS NOT NULL
          OR NEW.boolean_value IS NOT NULL OR NEW.date_value IS NOT NULL
          OR NEW.datetime_value IS NOT NULL OR NEW.option_id IS NOT NULL
        ))
        OR
        (ad.data_type = 'boolean' AND (
          NEW.boolean_value IS NULL OR NEW.text_value IS NOT NULL OR NEW.integer_value IS NOT NULL
          OR NEW.number_value IS NOT NULL OR NEW.date_value IS NOT NULL
          OR NEW.datetime_value IS NOT NULL OR NEW.option_id IS NOT NULL
        ))
        OR
        (ad.data_type = 'date' AND (
          NEW.date_value IS NULL OR NEW.text_value IS NOT NULL OR NEW.integer_value IS NOT NULL
          OR NEW.number_value IS NOT NULL OR NEW.boolean_value IS NOT NULL
          OR NEW.datetime_value IS NOT NULL OR NEW.option_id IS NOT NULL
        ))
        OR
        (ad.data_type = 'datetime' AND (
          NEW.datetime_value IS NULL OR NEW.text_value IS NOT NULL OR NEW.integer_value IS NOT NULL
          OR NEW.number_value IS NOT NULL OR NEW.boolean_value IS NOT NULL
          OR NEW.date_value IS NOT NULL OR NEW.option_id IS NOT NULL
        ))
        OR
        (ad.data_type = 'enum' AND (
          NEW.option_id IS NULL OR NEW.text_value IS NOT NULL OR NEW.integer_value IS NOT NULL
          OR NEW.number_value IS NOT NULL OR NEW.boolean_value IS NOT NULL
          OR NEW.date_value IS NOT NULL OR NEW.datetime_value IS NOT NULL
          OR NOT EXISTS (
            SELECT 1
            FROM attribute_options ao
            WHERE ao.id = NEW.option_id
              AND ao.attribute_definition_id = NEW.attribute_definition_id
          )
        ))
        OR
        (ad.data_type = 'multi_enum' AND (
          NEW.option_id IS NOT NULL OR NEW.text_value IS NOT NULL OR NEW.integer_value IS NOT NULL
          OR NEW.number_value IS NOT NULL OR NEW.boolean_value IS NOT NULL
          OR NEW.date_value IS NOT NULL OR NEW.datetime_value IS NOT NULL
        ))
      )
  )
  OR NOT EXISTS (
    SELECT 1
    FROM attribute_definitions ad
    WHERE ad.id = NEW.attribute_definition_id
  )
BEGIN
  SELECT RAISE(ABORT, 'Attribute value does not match its AttributeDefinition');
END;

CREATE TRIGGER IF NOT EXISTS trg_attribute_value_options_type_insert
BEFORE INSERT ON attribute_value_options
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM attribute_values av
  INNER JOIN attribute_definitions ad ON ad.id = av.attribute_definition_id
  INNER JOIN attribute_options ao ON ao.id = NEW.option_id
  WHERE av.id = NEW.attribute_value_id
    AND ad.data_type = 'multi_enum'
    AND ao.attribute_definition_id = av.attribute_definition_id
)
BEGIN
  SELECT RAISE(ABORT, 'Attribute option is incompatible with the AttributeValue');
END;

CREATE TRIGGER IF NOT EXISTS trg_attribute_value_options_type_update
BEFORE UPDATE OF attribute_value_id, option_id ON attribute_value_options
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM attribute_values av
  INNER JOIN attribute_definitions ad ON ad.id = av.attribute_definition_id
  INNER JOIN attribute_options ao ON ao.id = NEW.option_id
  WHERE av.id = NEW.attribute_value_id
    AND ad.data_type = 'multi_enum'
    AND ao.attribute_definition_id = av.attribute_definition_id
)
BEGIN
  SELECT RAISE(ABORT, 'Attribute option is incompatible with the AttributeValue');
END;
