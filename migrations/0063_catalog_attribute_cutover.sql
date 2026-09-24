-- Catalog Attribute cutover: migrate product_variants.attributes_json into canonical AttributeValue storage.
-- The migration is fail-closed: any unmapped, ambiguous or invalid legacy attribute blocks application.
CREATE TABLE catalog_attribute_cutover_issues (
  id TEXT PRIMARY KEY,
  product_variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  attribute_key TEXT,
  issue_code TEXT NOT NULL CHECK (issue_code IN (
    'invalid_json','duplicate_key','unknown_attribute','type_mismatch',
    'invalid_enum_option','invalid_multi_enum','null_value'
  )),
  details_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_catalog_attribute_cutover_issues_variant
  ON catalog_attribute_cutover_issues(product_variant_id);

INSERT INTO catalog_attribute_cutover_issues
  (id, product_variant_id, attribute_key, issue_code, details_json, created_at)
SELECT 'catalog-attribute-cutover:'||pv.id||':invalid-json', pv.id, NULL,
  'invalid_json', json_object('attributes_json',pv.attributes_json), pv.updated_at
FROM product_variants pv
WHERE pv.attributes_json IS NOT NULL AND json_valid(pv.attributes_json)=0;

INSERT INTO catalog_attribute_cutover_issues
  (id, product_variant_id, attribute_key, issue_code, details_json, created_at)
SELECT 'catalog-attribute-cutover:'||pv.id||':duplicate:'||je.key, pv.id, je.key,
  'duplicate_key', json_object('key',je.key), pv.updated_at
FROM product_variants pv
JOIN json_each(CASE WHEN json_valid(pv.attributes_json)=1 THEN pv.attributes_json ELSE '{}' END) je
GROUP BY pv.id, je.key HAVING COUNT(*)>1;

INSERT INTO catalog_attribute_cutover_issues
  (id, product_variant_id, attribute_key, issue_code, details_json, created_at)
SELECT 'catalog-attribute-cutover:'||pv.id||':unknown:'||je.key, pv.id, je.key,
  'unknown_attribute', json_object('key',je.key), pv.updated_at
FROM product_variants pv
JOIN json_each(CASE WHEN json_valid(pv.attributes_json)=1 THEN pv.attributes_json ELSE '{}' END) je
LEFT JOIN attribute_definitions ad ON ad.canonical_key=je.key
WHERE pv.attributes_json IS NOT NULL AND ad.id IS NULL;

INSERT INTO catalog_attribute_cutover_issues
  (id,product_variant_id,attribute_key,issue_code,details_json,created_at)
SELECT 'catalog-attribute-cutover:'||pv.id||':null:'||je.key,pv.id,je.key,
  'null_value',json_object('key',je.key),pv.updated_at
FROM product_variants pv
JOIN json_each(CASE WHEN json_valid(pv.attributes_json)=1 THEN pv.attributes_json ELSE '{}' END) je
WHERE pv.attributes_json IS NOT NULL AND je.type='null';

INSERT INTO catalog_attribute_cutover_issues
  (id,product_variant_id,attribute_key,issue_code,details_json,created_at)
SELECT 'catalog-attribute-cutover:'||pv.id||':type:'||je.key,pv.id,je.key,
  'type_mismatch',json_object('key',je.key,'json_type',je.type,'data_type',ad.data_type),pv.updated_at
FROM product_variants pv
JOIN json_each(CASE WHEN json_valid(pv.attributes_json)=1 THEN pv.attributes_json ELSE '{}' END) je
JOIN attribute_definitions ad ON ad.canonical_key=je.key
WHERE pv.attributes_json IS NOT NULL AND (
  (ad.data_type='text' AND je.type<>'text') OR
  (ad.data_type='integer' AND je.type<>'integer') OR
  (ad.data_type='number' AND je.type NOT IN ('integer','real')) OR
  (ad.data_type='boolean' AND je.type NOT IN ('true','false')) OR
  (ad.data_type IN ('date','datetime','enum') AND je.type<>'text') OR
  (ad.data_type='multi_enum' AND je.type<>'array')
);

INSERT INTO catalog_attribute_cutover_issues
  (id,product_variant_id,attribute_key,issue_code,details_json,created_at)
SELECT 'catalog-attribute-cutover:'||pv.id||':enum:'||je.key,pv.id,je.key,
  'invalid_enum_option',json_object('key',je.key,'value',je.value),pv.updated_at
FROM product_variants pv
JOIN json_each(CASE WHEN json_valid(pv.attributes_json)=1 THEN pv.attributes_json ELSE '{}' END) je
JOIN attribute_definitions ad ON ad.canonical_key=je.key AND ad.data_type='enum'
LEFT JOIN attribute_options ao ON ao.attribute_definition_id=ad.id
  AND ao.canonical_value=CAST(je.value AS TEXT)
WHERE pv.attributes_json IS NOT NULL AND je.type='text' AND ao.id IS NULL;

INSERT INTO catalog_attribute_cutover_issues
  (id,product_variant_id,attribute_key,issue_code,details_json,created_at)
SELECT 'catalog-attribute-cutover:'||pv.id||':multi:'||je.key,pv.id,je.key,
  'invalid_multi_enum',json_object('key',je.key,'value',je.value),pv.updated_at
FROM product_variants pv
JOIN json_each(CASE WHEN json_valid(pv.attributes_json)=1 THEN pv.attributes_json ELSE '{}' END) je
JOIN attribute_definitions ad ON ad.canonical_key=je.key AND ad.data_type='multi_enum'
WHERE pv.attributes_json IS NOT NULL AND (
  je.type<>'array' OR json_array_length(je.value)=0 OR EXISTS (
    SELECT 1 FROM json_each(je.value) child
    LEFT JOIN attribute_options ao ON ao.attribute_definition_id=ad.id
      AND ao.canonical_value=CAST(child.value AS TEXT)
    WHERE child.type<>'text' OR ao.id IS NULL
  )
);

-- Fail closed before any canonical data is written.
CREATE TABLE catalog_attribute_cutover_guard (ok INTEGER NOT NULL CHECK(ok=1));
INSERT INTO catalog_attribute_cutover_guard(ok)
SELECT CASE WHEN EXISTS(SELECT 1 FROM catalog_attribute_cutover_issues) THEN 0 ELSE 1 END;
DROP TABLE catalog_attribute_cutover_guard;

INSERT INTO attribute_values (
  id,attribute_definition_id,target_type,target_id,source_type,source_reference,confidence,
  option_id,text_value,integer_value,number_value,boolean_value,date_value,datetime_value,
  created_at,updated_at
)
SELECT
  'legacy-json:'||pv.id||':'||ad.id,ad.id,'product_variant',pv.id,'system_derived',
  'product_variants.attributes_json',NULL,
  CASE WHEN ad.data_type='enum' THEN ao.id ELSE NULL END,
  CASE WHEN ad.data_type='text' THEN CAST(je.value AS TEXT) ELSE NULL END,
  CASE WHEN ad.data_type='integer' THEN CAST(je.value AS INTEGER) ELSE NULL END,
  CASE WHEN ad.data_type='number' THEN CAST(je.value AS REAL) ELSE NULL END,
  CASE WHEN ad.data_type='boolean' THEN CASE WHEN je.type='true' THEN 1 ELSE 0 END ELSE NULL END,
  CASE WHEN ad.data_type='date' THEN CAST(je.value AS TEXT) ELSE NULL END,
  CASE WHEN ad.data_type='datetime' THEN CAST(je.value AS TEXT) ELSE NULL END,
  pv.created_at,pv.updated_at
FROM product_variants pv JOIN json_each(pv.attributes_json) je
JOIN attribute_definitions ad ON ad.canonical_key=je.key
LEFT JOIN attribute_options ao ON ao.attribute_definition_id=ad.id
  AND ad.data_type='enum' AND ao.canonical_value=CAST(je.value AS TEXT)
WHERE pv.attributes_json IS NOT NULL AND ad.data_type<>'multi_enum';

INSERT INTO attribute_values (
  id,attribute_definition_id,target_type,target_id,source_type,source_reference,confidence,
  option_id,text_value,integer_value,number_value,boolean_value,date_value,datetime_value,
  created_at,updated_at
)
SELECT 'legacy-json:'||pv.id||':'||ad.id,ad.id,'product_variant',pv.id,'system_derived',
  'product_variants.attributes_json',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,
  pv.created_at,pv.updated_at
FROM product_variants pv JOIN json_each(pv.attributes_json) je
JOIN attribute_definitions ad ON ad.canonical_key=je.key AND ad.data_type='multi_enum'
WHERE pv.attributes_json IS NOT NULL;

INSERT INTO attribute_value_options(id,attribute_value_id,option_id,created_at)
SELECT 'legacy-json:'||pv.id||':'||ad.id||':'||ao.id,
  'legacy-json:'||pv.id||':'||ad.id,ao.id,pv.updated_at
FROM product_variants pv JOIN json_each(pv.attributes_json) je
JOIN attribute_definitions ad ON ad.canonical_key=je.key AND ad.data_type='multi_enum'
JOIN json_each(je.value) child
JOIN attribute_options ao ON ao.attribute_definition_id=ad.id
  AND ao.canonical_value=CAST(child.value AS TEXT)
WHERE pv.attributes_json IS NOT NULL;

-- The legacy column remains only as historical evidence and is cleared after backfill.
CREATE TRIGGER IF NOT EXISTS trg_product_variants_attributes_json_legacy_write_block
BEFORE INSERT ON product_variants FOR EACH ROW
WHEN NEW.attributes_json IS NOT NULL
BEGIN
  SELECT RAISE(ABORT,'product_variants.attributes_json is retired; use canonical AttributeValue storage');
END;

CREATE TRIGGER IF NOT EXISTS trg_product_variants_attributes_json_legacy_update_block
BEFORE UPDATE OF attributes_json ON product_variants FOR EACH ROW
WHEN NEW.attributes_json IS NOT NULL AND NEW.attributes_json IS NOT OLD.attributes_json
BEGIN
  SELECT RAISE(ABORT,'product_variants.attributes_json is retired; use canonical AttributeValue storage');
END;

UPDATE product_variants SET attributes_json=NULL WHERE attributes_json IS NOT NULL;
