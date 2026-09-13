---
name: phoenix-media
description: Rules for Phoenix media, files, assets, R2 storage, access control, scanning, derivatives, retention, and sensitive-data handling.
---
# Phoenix Media Skill

## Purpose

Implement and review Phoenix's Media/File/Asset module according to `docs/MEDIA_FILE_ASSET_ARCHITECTURE.md`.

## Non-Negotiable Rules

- D1 is authoritative for asset metadata; R2/object storage holds bytes.
- Never treat an object URL as authorization.
- Private/sensitive assets require policy-checked, short-lived access.
- Verification and other sensitive documents are private by default.
- Domain modules reference Media assets; they do not query Media private tables directly.
- Asset readiness does not imply business/catalog publication.
- Quarantined or unscanned restricted assets cannot become public or enter Discovery.
- AI can suggest metadata or moderation results, but cannot grant access, approve sensitive documents, or bypass policy.
- Never log sensitive document contents or signed URLs.

## Required Workflow

1. Validate tenant/workspace and actor permission.
2. Validate intended resource, type, size, sensitivity, and retention class.
3. Store objects under opaque asset-scoped keys.
4. Confirm durable upload before marking uploaded.
5. Run scan/validation before publication.
6. Generate controlled derivatives asynchronously.
7. Enforce access policy at every read.
8. Emit versioned idempotent events.
9. Audit sensitive access and lifecycle changes.
10. Test isolation, expiry, malformed content, retries, quarantine, retention, and deletion safeguards.

## Integration Rules

- Onboarding owns verification decisions.
- Catalog owns service/product meaning.
- Discovery consumes only safe, eligible, published projections.
- Customer Experience consumes authorized optimized assets.
- Media owns upload, storage abstraction, processing, access, and retention lifecycle.

## Performance

Prefer direct object-storage/CDN delivery over application proxying for large files. Keep upload-init and metadata access fast; processing belongs in asynchronous jobs.

## Completion Criteria

Before declaring work complete, verify tenant isolation, authorization, quarantine, signed URL expiry, R2 adapter boundaries, derivative versioning, idempotency, auditability, retention rules, and absence of sensitive-data leakage.
