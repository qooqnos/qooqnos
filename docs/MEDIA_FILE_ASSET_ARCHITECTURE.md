# Phoenix Media / File / Asset Architecture

## 1. Purpose

The Media module is Phoenix's reusable asset layer for images, portfolio media, business documents, catalog media, and other uploaded objects.

It owns **asset metadata, lifecycle, access policy, processing state, derivatives, and references**. It does not become the source of truth for the business entity that owns an asset.

Primary storage is object storage such as Cloudflare R2. D1 remains the authoritative metadata and relationship store.

## 2. Core Invariants

1. Object storage contains bytes; D1 contains authoritative metadata and ownership.
2. A raw object URL is never treated as authorization.
3. Private objects are accessed through short-lived signed URLs or an authorized streaming endpoint.
4. Public visibility is an explicit policy decision, not an accidental bucket property.
5. Domain modules own business meaning; Media owns file lifecycle.
6. AI may classify, caption, extract, or suggest metadata, but cannot grant access or publish restricted assets.
7. Verification documents and sensitive material are private by default.
8. Every state-changing operation is auditable and idempotent where applicable.

## 3. Ownership Boundaries

### Media owns

- Asset identity and metadata
- Object storage keys
- Upload sessions
- Asset lifecycle
- Visibility/access policy
- Processing jobs and derivatives
- Content-type/size validation
- Integrity hashes
- Malware/content-scan state
- Retention/deletion workflow
- Asset references
- Signed URL issuance

### Other modules own

- Business profile meaning
- Verification decisions
- Catalog/offer meaning
- Portfolio ordering/business presentation
- Customer identity
- Booking records
- Medical/business compliance decisions

A module references an asset by `asset_id`; it must not manipulate Media's private tables directly.

## 4. Asset Lifecycle

```text
created
  -> upload_pending
  -> uploaded
  -> scanning
  -> processing
  -> ready
  -> published / private / restricted
  -> archived
  -> deletion_pending
  -> deleted
```

Failure states are explicit:

- upload_failed
- scan_failed
- processing_failed
- rejected
- quarantined

`quarantined` assets cannot be publicly served or indexed for discovery.

## 5. Upload Flow

```text
Client
  -> authorized upload-init command
  -> Media validates actor/tenant/policy
  -> short-lived upload target
  -> R2 upload
  -> completion callback
  -> checksum/content metadata verification
  -> scan queue
  -> processing queue
  -> ready event
```

The client must never choose an arbitrary storage key or bypass Media authorization.

Upload initialization validates:

- tenant/workspace
- actor permission
- intended resource type
- allowed MIME/category
- maximum size
- filename normalization
- retention class
- sensitivity class

## 6. Storage Layout

Use opaque, non-user-controlled object keys. A recommended logical structure is:

```text
{environment}/{tenant_id}/{asset_id}/original
{environment}/{tenant_id}/{asset_id}/derivatives/{variant}
```

Never expose predictable sequential identifiers as storage paths.

Object metadata should include an asset identifier and content version, but authorization remains in D1/policy evaluation.

## 7. Security Pipeline

Every uploaded object passes through layered controls:

1. Authentication and tenant authorization
2. Size/type validation
3. Filename sanitization
4. Content sniffing rather than trusting extension alone
5. Malware/content scanning where supported
6. Image/document processing in isolated workers
7. Metadata stripping where appropriate
8. Safe derivative generation
9. Publication policy evaluation

Executable or unexpected content types must never be made public merely because the filename suggests an allowed type.

## 8. Image Processing

For portfolio and catalog images, processing should create controlled derivatives such as:

- thumbnail
- card
- detail
- original/private

The system should preserve the original when policy requires it while serving optimized derivatives to customers.

Processing must protect against decompression bombs, excessive dimensions, malformed files, and resource exhaustion.

Image transformations should be deterministic and versioned.

## 9. Documents

Verification and other sensitive documents follow a stricter policy:

- private by default
- no customer-facing public URL
- access only for authorized operational roles
- explicit audit event for access to highly sensitive material
- retention policy attached to asset class
- deletion follows legal/business retention rules

Medical or identity-related material must never be copied into logs, prompts, analytics payloads, or public search indexes.

## 10. Access Control

Asset access is evaluated using:

```text
actor
+ tenant/workspace
+ asset ownership/reference
+ resource policy
+ asset sensitivity
+ publication state
+ purpose/context
```

Examples:

- Public catalog image: public read after publication policy passes.
- Business portfolio image: public read only when the associated portfolio/offer is published.
- Verification document: authorized verification/compliance roles only.
- Private customer upload: customer and explicitly authorized service roles only.

A signed URL must be short-lived and scoped to the intended asset/variant.

## 11. Asset References

Domain tables should use references such as:

```text
asset_refs
- asset_id
- owner_module
- owner_type
- owner_id
- purpose
- sort_order
- created_at
```

References must be tenant-scoped and validated against the owning domain resource.

Deleting a reference does not necessarily delete the object. Media deletion is a separate lifecycle decision so shared/reused assets are not accidentally removed.

## 12. Publication and Discovery

Media readiness is not equivalent to domain publication.

```text
asset ready
  != offer published
  != business verified
```

Discovery may index only assets that are:

- ready
- permitted for discovery/public display
- associated with a published/eligible resource
- not quarantined or expired

Search indexes should store references and safe metadata, not private document contents.

## 13. AI Integration

AI may perform:

- image categorization
- safe caption suggestions
- OCR/extraction where policy permits
- duplicate detection
- moderation suggestions
- language detection
- translation suggestions
- quality scoring

AI may not:

- approve sensitive documents
- grant access
- publish restricted assets
- infer sensitive identity/health attributes into durable metadata without an explicit policy
- bypass malware/content scanning

All AI-produced metadata is marked as machine-generated and may require human confirmation depending on sensitivity.

## 14. Events

Media emits versioned events such as:

- `media.asset.created.v1`
- `media.asset.uploaded.v1`
- `media.asset.scan.completed.v1`
- `media.asset.quarantined.v1`
- `media.asset.ready.v1`
- `media.asset.published.v1`
- `media.asset.archived.v1`
- `media.asset.deleted.v1`
- `media.derivative.ready.v1`

Consumers must be idempotent.

## 15. Data Model

Core tables:

- `media_assets`
- `media_upload_sessions`
- `media_asset_versions`
- `media_asset_refs`
- `media_derivatives`
- `media_scan_results`
- `media_processing_jobs`
- `media_access_logs`
- `media_retention_policies`

Important fields include tenant/workspace, asset ID, object key, content type, byte size, checksum, sensitivity class, visibility, lifecycle state, version, scan status, processing status, created/updated timestamps, and deletion timestamp.

## 16. Retention and Deletion

Deletion is policy-driven:

```text
active -> archived -> deletion_pending -> deleted
```

A hard delete must verify:

- no protected retention requirement
- no active legal/business dependency
- no required audit reference
- no remaining domain reference that requires the asset

Deletion jobs are asynchronous and retryable.

## 17. Performance

Targets for the initial architecture:

- upload-init: p95 < 300ms excluding object-storage upload
- metadata lookup: p95 < 100ms warm
- signed URL issuance: p95 < 150ms warm
- processing is asynchronous
- customer image delivery should rely on CDN/cache rather than application servers

Do not proxy large files through the application unless policy explicitly requires it.

## 18. Failure and Degradation

If processing fails, the original object remains private/quarantined according to policy and the job can be retried.

If scanning is unavailable, sensitive assets remain unavailable for publication.

If derivative generation is unavailable, a safe existing derivative may be served; the system must not silently expose an unsafe original.

R2/object-storage outages must not corrupt domain state. Upload completion is confirmed only after durable storage confirmation.

## 19. APIs

Public/customer-facing:

```text
POST   /api/v1/media/uploads
POST   /api/v1/media/uploads/{id}/complete
GET    /api/v1/media/assets/{id}
POST   /api/v1/media/assets/{id}/access
DELETE /api/v1/media/assets/{id}
```

Internal commands/jobs:

```text
media.asset.process
media.asset.scan
media.asset.generate_derivative
media.asset.reindex_reference
media.asset.request_deletion
media.asset.rebuild_metadata
```

Exact routes must still pass through centralized authorization and module lifecycle checks.

## 20. Integration Map

- Onboarding → verification documents
- Catalog → product/service media
- Customer Experience → optimized public assets
- Reviews → optional review attachments
- Communications → optional message attachments
- Discovery → safe searchable media metadata
- Admin/Partner → media management and moderation
- Security → scanning and audit
- Localization → locale-aware captions/alt text

## 21. Observability

Track:

- upload success/failure rate
- scan latency/failures
- processing latency
- derivative generation failures
- queue depth
- orphaned objects
- stale references
- signed URL issuance
- unauthorized access attempts
- storage growth
- deletion backlog
- asset publication failures

Never log raw sensitive document content or signed URLs.

## 22. Testing

Required tests include:

- tenant isolation
- permission denial
- signed URL expiry
- object-key manipulation
- MIME/content mismatch
- oversized/malformed image handling
- quarantine behavior
- retry/idempotency
- duplicate upload handling
- derivative correctness
- private document access
- retention/deletion protection
- orphan reference detection
- AI metadata permission boundaries
- discovery exclusion for private/quarantined assets

## 23. Implementation Order

1. Media schema and repository layer
2. R2 adapter
3. Upload-session API
4. Scan/validation pipeline
5. Processing worker and derivatives
6. Signed access service
7. Asset reference integration with Catalog and Onboarding
8. CDN/cache policy
9. Retention/deletion jobs
10. Admin/Partner media UI
11. AI-assisted metadata pipeline
12. Operational dashboards

## 24. Definition of Done

Media is production-ready when:

- D1 metadata is authoritative
- R2 is isolated behind an adapter
- upload and access are policy-controlled
- private assets cannot be reached through public URLs
- scanning/quarantine is enforced
- derivatives are versioned
- domain modules use references rather than private Media SQL
- sensitive documents have explicit retention/access rules
- events are versioned and idempotent
- observability and audit are active
- tenant isolation tests pass
- failure/retry behavior is tested
- Claude Code rules enforce these boundaries
