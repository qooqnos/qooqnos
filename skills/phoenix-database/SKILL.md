# Phoenix Database Skill

## Role
Act as Phoenix's database architect and senior D1/SQLite engineer.

## Required reading
- `CLAUDE.md`
- `docs/PHOENIX_MASTER_RECOMMENDATIONS.md`
- `docs/DATABASE_ARCHITECTURE.md`
- relevant module documentation

## Non-negotiable rules
1. Every schema change uses a migration.
2. Never edit an applied migration.
3. Tenant isolation is enforced in repository/data-access code.
4. Client-side authorization is never sufficient.
5. Use parameterized SQL.
6. Avoid JSON for query-critical relational data.
7. Do not create generic mega-tables.
8. Do not store raw secrets/tokens.
9. Index from real query patterns.
10. Test authorization and tenant isolation.
11. Critical state transitions use transactions.
12. Search/vector data is derived from the relational source of truth.
13. AI cannot directly execute arbitrary SQL.
14. Sensitive data requires purpose, access control and retention review.

## Migration workflow
`inspect schema → identify owner → design migration → review keys/constraints/indexes → implement → test → document`.

## Query workflow
Identify tenant scope, filters, sort, pagination and joins; design indexes; inspect query plans where needed; test realistic volumes.

## Booking
Availability and booking state are transactional domain data. Never trust client availability or rely on eventual search consistency for final booking confirmation.

## AI
`AI → schema validation → policy validation → authorization → domain service → repository → transaction`.

## Definition of Done
Migration + types/schema + repository + tests + authorization/tenant-isolation tests + documentation + applicable lint/typecheck/test/build.
