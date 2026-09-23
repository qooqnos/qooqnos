# Phoenix AI Marketplace — Database Architecture

> Status: Architecture Baseline

## 1. Database philosophy
D1/SQLite is the relational source of truth. Database integrity outranks AI output. Tenant isolation is mandatory. Query-critical data belongs in relational fields; JSON is reserved for genuinely flexible metadata. Search/vector indexes are derived data.

## 2. Domains
```text
IDENTITY: users, user_profiles, sessions
TENANCY: organizations, workspaces, locations, memberships, roles, permissions, role_permissions, membership_roles
MARKETPLACE: businesses, categories, business_categories, services, business_services, products, product_variants, inventory, reviews
MEDIA: media_assets, media_variants, media_links
AI: user_requests, match_runs, match_results, search_documents, ai_conversations, ai_messages, ai_tool_calls, ai_safety_events
BOOKING/CRM: customers, customer_preferences, customer_addresses, availability_rules, appointments, crm_timeline_events, loyalty_accounts
COMMUNICATION: notifications, notification_deliveries, messaging_threads
BILLING: plans, subscriptions, usage_events, payment_intents, payment_transactions
GOVERNANCE: verification_cases, verification_documents, moderation_cases, consent_records, audit_events
PLATFORM: modules, tenant_modules, feature_flags, outbox_events
```

## 3. IDs
Use opaque public identifiers such as `usr_`, `biz_`, `svc_`, `apt_`, `evt_`. Internal integer rowids may exist, but APIs must not expose enumerable business IDs.

## 4. Tenancy
Tenant-owned tables carry `tenant_id` where applicable. Repository methods receive tenant context and enforce tenant predicates in SQL. Never fetch by ID and perform tenant validation only in UI/application code.

## 5. Authorization
Use roles, permissions and membership-role assignments for RBAC; evaluate tenant/workspace/branch/ownership/resource-state through ABAC policy code. Authorization must be enforced server-side.

## 6. Core marketplace tables
Businesses contain organization ownership, name/slug, status and verification state. Services contain business ownership, duration, price, currency and booking state. Products and variants model catalog data; inventory is separate and transactional.

## 7. Booking
Availability rules and appointment slots are derived scheduling structures. Final appointment creation must validate authorization and availability inside a transaction, reserve capacity and then emit an event. Search/vector indexes must never be the final source of booking truth.

## 8. AI
User requests store the original need and versioned structured interpretation. `match_runs` store algorithm/model versions. `match_results` are historical and must not be overwritten when ranking changes. AI conversations, tool calls and safety events are separately auditable.

Required AI boundary:
`AI → schema validation → policy validation → authorization → domain service → repository → D1`.

## 9. Search
The relational DB is authoritative. Changes emit domain/outbox events, queues update normalized search documents and embeddings, and Vectorize stores derived semantic indexes. Eventual search consistency is acceptable; critical booking/payment state cannot depend on it.

## 10. Verification and consent
Generic verification supports submitted → review → additional information → approved/rejected → appeal. Consent is purpose-specific, versioned and time-bound; never model consent as one global boolean. Medical credentials and sensitive data receive stricter policies and isolation.

## 11. Audit
Audit records include actor, tenant, action, resource, result, request ID, timestamps and relevant before/after state. High-risk operations must be auditable and ordinary users cannot modify audit history.

## 12. Notifications
Notifications are provider-agnostic; delivery records track channel/provider/status/retries. External delivery runs asynchronously through queues.

## 13. Billing
Use integer minor units plus currency. Payment state is authoritative on the server/provider, never from browser input. Model explicit payment lifecycle states.

## 14. Modules
`modules` stores manifests; `tenant_modules` controls activation/configuration. Module dependencies must be validated before activation. Module-specific migrations remain part of migration history.

## 15. Indexes
Add indexes from real query patterns: tenant/organization, status, business ownership, appointment time, customer appointment time, review status and match-run rank. Avoid speculative indexes.

## 16. JSON policy
Good for evolving AI payloads, integration metadata, UI preferences and non-critical optional attributes. Avoid for identity, authorization, prices, bookings, ownership, status, foreign keys and frequent filters.

## 17. Time and money
Store canonical timestamps in UTC. Store timezone separately. Jalali/Gregorian conversion belongs to locale/domain adapters. Never use floating-point money; use integer minor units and explicit currency.

## 18. Migrations
Applied migrations are immutable. Use additive, backward-compatible expansion where possible: add → dual-write → backfill → validate → switch reads → remove old field in a later migration. Never make destructive production changes casually.

## 19. Transactions
Use transactions for booking, inventory reservation, permission changes, critical verification transitions and financial state transitions. Do not simulate atomicity with multiple independent requests.

## 20. Recovery and scale
Maintain reproducible migrations, backup/export capability and restore drills. Scale first through indexes, caching, queues, read optimization/replication and derived search. Introduce specialized datastores/services only when measured need justifies them.

## 21. Database change checklist
Before a change answer: owning module, tenant scope, source of truth, table necessity, relational vs JSON fields, FKs, uniqueness, indexes, authorization impact, sensitive-data impact, audit/outbox/search impact, migration compatibility, partial-deployment behavior, rollback and isolation tests.
