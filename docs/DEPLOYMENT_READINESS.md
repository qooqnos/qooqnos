# Phoenix Deployment Readiness

**Current state:** application code is D1-ready, but remote Cloudflare resources are intentionally not fabricated in source control.

## Production prerequisites

### D1

The Worker must receive a `DB` D1 binding for production and staging. The real `database_id` must come from the provisioned Cloudflare D1 database.

The repository deliberately keeps the example binding commented in `wrangler.toml` until those real IDs exist.

### Queue

The Outbox publisher expects an `OUTBOX_QUEUE` binding. The Queue name and environment binding must be created in Cloudflare before asynchronous event publication is enabled in production.

### R2

Media persistence architecture uses R2, but the current Worker configuration does not contain a fabricated bucket binding. The real production bucket name must be provisioned before media-object operations are enabled against Cloudflare.

## Migration ownership

Phoenix does not use Wrangler's generated D1 migration registry as the application source of truth. The canonical migration chain is:

`migrations/*.sql` → migration catalog → migration lock → Phoenix runtime MigrationRunner

The current canonical sequence ends at `0050_case_support_core.sql`.

## Runtime safety

The API fails closed when the D1 binding is absent. This is intentional: deployment without D1 must not silently fall back to an in-memory or alternate database implementation.

## Verification gate

The repository's CI verifies migration-lock integrity, TypeScript, build, lint/migration checks and unit tests. The final infrastructure gate is the existence of real Cloudflare resource IDs/bindings for the deployment environment.

## Current non-goals

No provider credentials, D1 UUIDs, Queue names, or R2 bucket names are invented in source control.
