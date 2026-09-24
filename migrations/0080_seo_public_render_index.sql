-- Add a lookup index for the public edge SEO renderer.
CREATE INDEX idx_seo_entity_representations_public_url
  ON seo_entity_representations(canonical_url, publication_state, visibility, generated_at DESC);
