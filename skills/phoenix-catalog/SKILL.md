# Phoenix Catalog Skill

## Mission

Implement Catalog/Service/Product functionality as an authoritative, tenant-safe domain module for Phoenix Marketplace.

## Read First

Before changing catalog code, read:

- `CLAUDE.md`
- `docs/PHOENIX_ARCHITECTURE.md`
- `docs/MODULE_ARCHITECTURE.md`
- `docs/CORE_RUNTIME_ARCHITECTURE.md`
- `docs/AUTHORIZATION_ARCHITECTURE.md`
- `docs/SECURITY_ARCHITECTURE.md`
- `docs/AI_ARCHITECTURE.md`
- `docs/DISCOVERY_MATCHING_ARCHITECTURE.md`
- `docs/BUSINESS_ONBOARDING_VERIFICATION_ARCHITECTURE.md`
- `docs/CATALOG_SERVICE_PRODUCT_ARCHITECTURE.md`

## Non-Negotiables

1. Catalog is the source of truth for offers, not AI or discovery indexes.
2. Every repository operation requires validated tenant/workspace context.
3. Every mutation requires server-side authorization.
4. Published state is explicit; drafts never leak into public discovery.
5. Money uses integer minor units and explicit ISO currency.
6. Never use floating point for authoritative money.
7. Discovery indexes are projections and may be stale.
8. Inventory and booking correctness are owned by their domains.
9. AI may propose structured data but cannot silently publish or authoritatively change sensitive facts.
10. Never put provider SDK calls, arbitrary SQL, or secrets in catalog feature code.
11. Cross-module private tables are not queried directly.
12. Medical rules are deterministic policy, not prompt instructions.

## Module Shape

```text
modules/catalog/
├── manifest.ts
├── domain/
│   ├── offer/
│   ├── service/
│   ├── product/
│   ├── pricing/
│   └── publication/
├── application/
├── infrastructure/
├── api/
├── events/
├── policies/
├── migrations/
├── locales/
├── tests/
└── README.md
```

## Implementation Workflow

### 1. Define the Contract

Specify entity IDs, ownership, lifecycle, permissions, input/output schemas and emitted events before implementation.

### 2. Define Ownership

Document which module owns each fact:

- business identity → Business
- offer/service/product → Catalog
- media → Media
- availability → Availability/Booking
- transaction → future transaction domain
- verification → Verification
- search projection → Discovery

### 3. Implement Domain Rules

Keep lifecycle transitions and validation deterministic and testable.

### 4. Implement Repository

Repositories accept tenant context and domain IDs. Do not expose arbitrary SQL to API, AI or UI layers.

### 5. Implement Application Services

Examples:

```text
CreateOffer
UpdateOffer
PublishOffer
SuspendOffer
ArchiveOffer
ChangeOfferPrice
AttachOfferMedia
```

### 6. Emit Versioned Events

Use the outbox pattern. Event consumers must be idempotent.

### 7. Build Discovery Projection

Index only published, eligible offers. Include content/index versions and freshness metadata.

### 8. Add AI Assistance

AI extraction flow:

```text
provider text
→ AI extraction
→ schema validation
→ proposed draft
→ provider confirmation/review
→ domain service
```

AI never bypasses the application service.

## Beauty Rules

Beauty services should support at minimum:

- service name
- category
- description
- price
- duration
- location
- portfolio/media
- optional add-ons
- publication status

## Fashion Rules

Fashion products should support:

- product identity
- category
- price/currency
- size
- color
- material/style attributes
- variants/SKU
- inventory reference
- media
- publication status

## Medical Rules

For medical offerings:

- provider verification must be valid before relevant publication;
- credentials are never inferred by AI;
- provider claims may require moderation/review;
- no diagnosis, prescription, treatment or medication recommendation;
- sensitive health data requires consent and privacy controls.

## Security Checklist

Before merge/commit:

- [ ] tenant isolation tested
- [ ] permission checks tested
- [ ] ID ownership verified
- [ ] publication transitions validated
- [ ] private verification/media data protected
- [ ] no arbitrary SQL exposed
- [ ] no secrets committed
- [ ] audit events for sensitive transitions
- [ ] outbox event generated transactionally
- [ ] stale index cannot be treated as authoritative

## Performance

Prefer:

- indexed tenant-scoped queries
- pagination/cursors
- narrow projections
- async indexing
- batched reindexing
- cache invalidation through lifecycle events

Do not introduce a custom search engine or microservice before actual scale measurements justify it.

## Testing Matrix

Every catalog feature should cover:

| Area | Required |
|---|---|
| Domain | lifecycle and validation |
| Authorization | actor + tenant + permission |
| Database | constraints and indexes |
| Events | transactional outbox + idempotency |
| Discovery | publication and version propagation |
| Localization | locale and normalization |
| Money | minor units + currency |
| AI | schema validation and no silent mutation |
| Medical | prohibited-action tests |
| Concurrency | optimistic/version conflict handling |

## Definition of Done

A catalog change is complete only when domain ownership, authorization, schema validation, persistence, lifecycle, events, discovery projection, localization, tests and documentation are aligned.
