---
name: phoenix-database
description: Rules for Phoenix persistence, migrations, relational source of truth, tenant isolation, authorization, transactions, and auditability.
---

# Phoenix Database Skill
## Purpose
Design and implement Phoenix persistence without weakening module boundaries, tenant isolation, authorization, or auditability.
## Mandatory context
Read `docs/DATABASE_MODEL.md` and the relevant module architecture document before database work.
## Rules
- Every schema change uses a migration; never edit an applied migration.
- The database is authoritative; search/vector indexes are derived projections.
- Tenant/workspace isolation is enforced server-side in repositories/data access and tested explicitly.
- Use parameterized SQL and relational columns for query-critical data.
- Do not store raw secrets/tokens or create generic mega-tables.
- Critical state transitions use transactions, constraints, and appropriate concurrency controls.
- A module owns its private tables; cross-module access uses public services/commands/events, not private-table SQL coupling.
- AI follows schema → policy → authorization → domain service → repository and never arbitrary SQL.
- Sensitive/regulated data requires purpose, least privilege, retention, audit, and privacy review.
## Done
Verify migrations, constraints, indexes, query patterns, transactions, authorization, tenant isolation, auditability, tests, and relevant lint/typecheck/build checks.
