# Phoenix Database Skill

Native Claude Code entrypoint. Read `skills/phoenix-database/SKILL.md` and `docs/DATABASE_ARCHITECTURE.md` before database work.

## Rules
- Every schema change uses a migration; never edit an applied migration.
- Tenant isolation is enforced server-side in repositories/data access.
- Use parameterized SQL and relational columns for query-critical data.
- Do not store raw secrets/tokens or create generic mega-tables.
- Critical state transitions use transactions.
- Search/vector data is derived from relational source of truth.
- AI follows schema → policy → authorization → domain service → repository and never arbitrary SQL.
- Sensitive data requires purpose, access control, and retention review.

## Done
Verify constraints/indexes/query patterns, migrations, transactions, authorization, tenant isolation, tests, and relevant checks.
