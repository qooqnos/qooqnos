# Migration Catalog

## Purpose

The migration catalog is the build/runtime boundary between the canonical SQL files in `migrations/` and `MigrationRunner`.

The SQL files remain the only source of migration contents. The catalog loader receives those exact SQL strings from the build system and derives the runtime metadata required by `MigrationRunner`.

## Contract

`loadMigrationCatalog()` derives:

- `id` from the migration filename without `.sql`
- `version` from the numeric filename prefix
- `moduleId` from the filename module segment, with an optional explicit resolver
- `sql` from the supplied canonical source
- `checksum` as SHA-256 of the exact SQL string
- `statements` by splitting SQL on statement terminators while respecting quoted strings and identifiers

The loader sorts definitions by version. `MigrationRunner` remains responsible for sequence validation, checksum verification, applied-history validation, and transactional execution.

## Filename convention

```text
NNNN_module[_description].sql
```

Example:

```text
0001_foundation.sql
```

produces version `1`, id `0001_foundation`, and module id `foundation`.

## Build integration

The build layer must supply `MigrationSource[]` from the canonical `migrations/*.sql` files. It must not copy SQL into a second handwritten TypeScript source of truth.

This separation keeps the database package Cloudflare-compatible while allowing the repository/build tooling to decide how raw SQL assets are bundled for Workers.
