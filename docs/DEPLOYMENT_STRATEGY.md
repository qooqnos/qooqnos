# Phoenix Deployment Strategy

## Canonical deployment path

Phoenix is deployed as a Cloudflare Worker with D1 as the canonical relational database, R2 for media, Queues for asynchronous work, and Workers AI where configured.

### Local verification

```bash
npm ci
npm run verify:migrations
npm run report:database
npm run verify:source-boundary
npm run verify:runtime-registry
npm run lint
npm run typecheck
npm run build
npm run verify:worker
npm test
```

### Production configuration

Production Cloudflare resource identifiers are intentionally not committed as placeholders. The deployment workflow supplies them through the protected `production` environment:

- `PHOENIX_PROD_D1_DATABASE_ID`
- `PHOENIX_PROD_D1_DATABASE_NAME`
- `PHOENIX_PROD_R2_BUCKET_NAME`
- `PHOENIX_PROD_OUTBOX_QUEUE_NAME`
- `PHOENIX_PROD_AI_MODEL_ID`
- optional `PHOENIX_PROD_AI_MODEL_VERSION`
- optional `PHOENIX_PROD_AI_GATEWAY_ID`

Cloudflare credentials are supplied through `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

The generated `.wrangler/production.wrangler.toml` is an ephemeral deployment artifact and must not be committed.

## Production deploy

The canonical command is:

```bash
npm run deploy:prod
```

It performs, in order:

1. Render the production Wrangler configuration from real environment values.
2. Verify production D1, Queue, R2 and Workers AI bindings.
3. Verify migration SQL, catalog and lock integrity.
4. Report physical database completion.
5. Verify canonical source boundaries and runtime module registration.
6. Run lint, typecheck, build, Worker dry-run and tests.
7. Apply the canonical migration history to the remote D1 with identity and checksum verification.
8. Deploy the Worker to the production environment.

The production GitHub Actions workflow runs this command only from a protected production environment, on a version tag or explicit manual dispatch.

## Database migration safety

Remote migration execution is deliberately fail-closed:

- the configured D1 database UUID must be valid;
- Wrangler must report the same D1 UUID;
- every already-applied migration must match the canonical id, version, module and SHA-256 checksum;
- migration versions must be contiguous;
- each newly applied migration is verified again immediately after execution;
- no migration is marked applied before its SQL succeeds;
- the migration lock is the source of truth for migration identity.

## Rollback

Database migrations are forward-only. Application rollback must not attempt to reverse an already-applied schema migration automatically.

For a Worker rollback:

```bash
git checkout <known-good-tag>
npm run predeploy:prod
npx --yes wrangler@4.136.2 deploy --config .wrangler/production.wrangler.toml --env production
```

A schema rollback requires a separately reviewed forward-fix migration.

## Operational health

The Worker exposes the canonical health/readiness endpoints documented by the API contract. Production rollout should verify readiness after deployment and monitor migration/runtime errors before increasing traffic.

## Remaining external prerequisite

The repository contains the complete executable remote-D1 deployment path. The final infrastructure gate is external to source control: the protected production environment must contain the real Cloudflare credentials and provisioned D1/R2/Queue/AI resource identifiers. Those values must never be invented or committed to the repository.
