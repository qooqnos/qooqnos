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

The current canonical sequence ends at `0056_communication_required_suppression.sql`.

## Cloudflare Worker bundling

`npm run verify:worker` executes a pinned Wrangler `4.136.2` dry-run. Wrangler source aliases map `@qooqnos/*` workspace imports to their canonical `packages/*/src/index.ts` entrypoints, so deployment does not depend on prebuilt workspace `dist/` artifacts.

## Runtime safety

The API fails closed when the D1 binding is absent. This is intentional: deployment without D1 must not silently fall back to an in-memory or alternate database implementation.

## Verification gate

The repository's CI verifies migration-lock integrity, TypeScript, build, lint/migration checks, Cloudflare Worker dry-run bundling with pinned Wrangler 4.136.2, and unit tests. The final infrastructure gate is the existence of real Cloudflare resource IDs/bindings for the deployment environment.

## Current non-goals

No provider credentials, D1 UUIDs, Queue names, or R2 bucket names are invented in source control.


## Production preflight

The production deployment path now renders a temporary Wrangler environment file from real deployment variables rather than storing resource IDs in Git.

Required production values are supplied through the deployment environment:

- `PHOENIX_PROD_D1_DATABASE_ID`
- `PHOENIX_PROD_D1_DATABASE_NAME`
- `PHOENIX_PROD_R2_BUCKET_NAME`
- `PHOENIX_PROD_OUTBOX_QUEUE_NAME`
- `PHOENIX_PROD_AI_MODEL_ID`
- `PHOENIX_PROD_AI_MODEL_VERSION` (optional; defaults to `1`)
- `PHOENIX_PROD_AI_GATEWAY_ID` (optional)

The renderer writes only to `.wrangler/production.wrangler.toml`, which is ignored by Git. The production workflow then executes:

`render → binding verification → migration verification → lint → typecheck → build → Worker dry-run → tests → deploy`.

Wrangler named environments do not inherit bindings/vars, so the generated production config explicitly defines D1, R2, Queue producer/consumer and Workers AI bindings for `env.production`.

The production deploy path now also executes `npm run migrate:prod:canonical` after the predeploy gates and before Worker deployment. That executor:

- verifies the requested Cloudflare D1 name resolves to the expected `PHOENIX_PROD_D1_DATABASE_ID`;
- verifies the canonical SQL files against `migrations/migration-lock.json`;
- reads `schema_migrations` directly from the remote D1;
- applies only pending canonical migrations, one migration at a time, and records the same `id/version/checksum/module_id/applied_at` history consumed by Phoenix `MigrationRunner`;
- re-reads the applied row after every migration and fails closed on any identity/checksum drift.

The production path deliberately does **not** use `wrangler d1 migrations apply`, because Phoenix owns the migration registry in `schema_migrations`; using Wrangler's separate D1 migration registry would create a second source of truth. Cloudflare's D1 execute command supports remote SQL-file execution against the named remote database. citeturn811106search1turn811106search3

The repository now provides two fail-closed checks before production deployment:

- `npm run verify:production-bindings` rejects missing production D1, Queue and R2 bindings or placeholder resource IDs.
- `npm run predeploy:prod` runs production binding verification, migration-lock verification, lint, typecheck, build and tests.

These checks intentionally fail until real Cloudflare resources are provisioned and their bindings are uncommented/configured in `wrangler.toml`. No fabricated Cloudflare IDs are stored in source control.
