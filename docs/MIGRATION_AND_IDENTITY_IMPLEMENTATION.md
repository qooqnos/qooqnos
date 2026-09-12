# Phoenix Migration + Identity/Workspace Runtime

## Implemented

- Ordered migration runner with contiguous version enforcement.
- Migration identity and module checks.
- SHA-256 checksum verification before applying migrations and against recorded history.
- Transactional D1 batch application of migration statements plus `schema_migrations` record.
- Explicit UTC migration clock.
- Identity repository for users and external identities.
- Workspace repository with mandatory organization/workspace context.
- Membership persistence behind the workspace repository boundary.

## Repository isolation

Workspace reads always scope by both `workspace_id` and `organization_id` when a workspace context is used. Organization context is mandatory for workspace creation and listing. Membership writes require an existing workspace inside the active organization.

Identity records are global by design at this foundation layer; workspace membership is the tenant boundary that connects a user to a workspace.

## Migration contract

The runner receives deployment-time migration definitions containing:

- stable migration id
- contiguous integer version
- owning module id
- canonical SQL text
- SHA-256 checksum of the canonical SQL
- prepared statements used for transactional D1 batch execution

The repository migration file remains append-only. Applied migrations cannot silently drift from the runtime definition.

## Remaining hardening

- Add integration tests using an actual D1-compatible runtime.
- Add repository tenant-isolation tests, including cross-organization access attempts.
- Add a build-time catalog that loads/splits repository migration files into `MigrationDefinition` values without duplicating SQL sources.
- Add authorization runtime before exposing membership/role operations to application modules.
