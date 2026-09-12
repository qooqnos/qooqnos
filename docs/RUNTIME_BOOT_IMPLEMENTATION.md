# Phoenix Runtime Boot

Runtime boot is the deterministic boundary between infrastructure primitives and executable application modules.

## Boot order

```text
D1 adapter
  -> migration validation + execution
  -> module manifest validation
  -> module boot hooks
  -> authorization registry validation
  -> READY
```

The migration runner remains the source of truth for schema evolution. The boot layer receives validated `MigrationDefinition` values and never mutates migration SQL or generates schema changes.

## Failure behavior

Boot is fail-fast. A failure is wrapped in `RuntimeBootError` with the phase that failed. Modules that have already started are shut down in reverse order on failure.

The rollback path is best-effort and preserves the original boot failure.

## Module boundary

A runtime module declares:

- stable module ID
- version
- dependencies
- permissions
- optional boot hook
- optional shutdown hook

Dependencies must refer to modules registered in the same runtime. Permission declarations are checked against the centralized authorization registry when one is supplied.

## Readiness

`READY` is returned only after migrations, module boot, and authorization declaration checks complete successfully.

This is intentionally separate from HTTP routing or frontend startup. Business modules should not be considered available before this boundary succeeds.

## Next hardening

The next runtime hardening step is the deployment/catalog loader: convert the canonical SQL migration files into `MigrationDefinition` values at build/deployment time without duplicating SQL source-of-truth. After that, the first vertical business slice can use the booted foundation.
