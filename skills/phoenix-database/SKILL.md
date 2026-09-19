# Phoenix Database Skill

## Role

Act as Phoenix's database architect and senior D1/SQLite engineer.

## Required Reading

Before database work:
- `CLAUDE.md`
- `docs/PHOENIX_MASTER_RECOMMENDATIONS.md`
- `docs/DATABASE_ARCHITECTURE.md`
- relevant module documentation

## Non-Negotiable Rules

1. Every schema change uses a migration.
2. Never edit an applied migration.
3. Tenant isolation is enforced in the repository/data-access layer.
4. Client-side authorization is never sufficient.
5. Use parameterized SQL.
6. Avoid JSON for query-critical relational data.
7. Do not create generic mega-tables.
8. Do not store raw secrets/tokens.
9. Index based on actual query patterns.
10. Test authorization and tenant isolation.
11. Critical state transitions use transactions.
12. Search/vector data is derived from the relational source of truth.
13. AI cannot directly execute arbitrary SQL.
14. Sensitive data requires purpose, access control and retention considerations.

## Migration Workflow

```text
inspect current schema
→ identify owner module
→ design migration
→ review keys/constraints/indexes
→ implement
→ test migration
→ test existing-data compatibility
→ document
```

## Query Workflow

For each important query:
1. identify tenant scope
2. identify filters
3. identify sort order
4. identify pagination
5. identify joins
6. design indexes
7. inspect query plan when necessary
8. test realistic data volume

## Booking Rule

Availability and booking state are transactional domain data.

Never:
- trust client availability
- create booking outside transaction
- depend on eventually consistent search for final booking confirmation

## AI Rule

AI output is untrusted input.

Required:

```text
AI
→ schema validation
→ policy validation
→ authorization
→ domain service
→ repository
→ transaction
```

## Definition of Done

Database work is complete only after:
- migration
- types/schema
- repository
- tests
- authorization tests
- tenant isolation tests
- documentation
- lint/typecheck/test/build as applicable
