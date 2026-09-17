# Phoenix Customer Domain Data Dictionary

**Status:** Canonical data contract  
**Scope:** Marketplace customer representation, customer relationships, preferences, and consent-aware personalization context.

## 1. Customer

Canonical marketplace customer representation.

Fields:
- id;
- identity_reference;
- tenant_scope;
- status;
- locale;
- timezone;
- created_at;
- updated_at.

Customer is distinct from User. Identity owns authentication/account truth; Customer owns marketplace customer representation.

## 2. CustomerRelationship

Relationship between a customer and a business.

Fields:
- id;
- customer_id;
- business_id;
- relationship_type;
- status;
- first_interaction_at;
- last_interaction_at;
- source;
- created_at;
- updated_at.

CRM owns relationship operations and history derived from authoritative interactions.

## 3. CustomerPreference

A preference usable for customer experience and discovery.

Fields:
- id;
- customer_id;
- attribute;
- value_reference;
- source;
- confidence;
- persistence;
- consent_scope;
- created_at;
- expires_at.

Explicit customer preferences must remain distinguishable from AI-inferred preferences.

## 4. CustomerSegmentMembership

Reference to an approved customer segment.

Fields:
- id;
- customer_id;
- segment_id;
- source;
- policy_version;
- effective_from;
- effective_to.

Customer does not own campaign audience policy; Campaign/Promotion owns campaign audience definitions.

## 5. CustomerInteractionReference

Reference to a domain interaction.

Fields:
- id;
- customer_id;
- source_module;
- source_type;
- source_id;
- interaction_type;
- occurred_at.

Customer does not duplicate booking, order, payment, message, review, or fulfillment truth.

## 6. CustomerConsentReference

Reference to applicable consent state.

Fields:
- customer_id;
- purpose;
- consent_reference;
- scope;
- status;
- effective_from;
- effective_to.

Consent authority remains with the canonical privacy/security boundary.

## 7. PersonalizationContext

A bounded context assembled for customer experience or discovery.

Fields:
- customer_id;
- explicit_preferences;
- approved_relationship_context;
- approved_interaction_signals;
- consent_scope;
- policy_version;
- generated_at;
- expires_at.

This is a derived context, not a second customer profile.

## 8. State

### Customer
```text
ACTIVE ↔ SUSPENDED
ACTIVE → DEACTIVATED
```

### Relationship
```text
PROSPECT → ACTIVE → INACTIVE
```

## 9. Ownership Matrix

| Data | Owner |
|---|---|
| Authentication/account | Identity |
| Customer marketplace representation | Customer |
| Customer↔Business relationship | CRM |
| Booking | Booking |
| Order | Commerce |
| Payment | Billing |
| Preference | Customer/approved source |
| Loyalty | Loyalty |
| Consent | Security/Privacy boundary |
| Communications | Communications |
| Reputation | Reviews |
| Discovery ranking | Discovery |
| AI inference | AI |

## 10. Privacy

Customer data is tenant-scoped where applicable.

Sensitive data must be classified and accessed through Authorization.

Preferences inferred by AI require explicit policy and provenance and may not be silently treated as explicit user preferences.

## 11. Idempotency and Concurrency

Customer creation/mapping and relationship synchronization must be idempotent.

Concurrent updates require version/expected-state validation.

## 12. Audit

Material changes reference actor, tenant, target, action, timestamp, correlation, and policy where applicable.

## 13. Canonical Capabilities

```text
CAP.CUSTOMER.CREATE
CAP.CUSTOMER.GET
CAP.CUSTOMER.UPDATE
CAP.CUSTOMER.LIST
CAP.CUSTOMER.MANAGE_PREFERENCES
CAP.CUSTOMER.GET_CONTEXT
CAP.CUSTOMER.LINK_IDENTITY
```

## 14. Canonical Events

```text
customer.created
customer.updated
customer.preference.changed
customer.relationship.linked
customer.deactivated
```

## 15. Invariants

1. User and Customer are distinct concepts.
2. Customer does not own authentication.
3. Customer does not duplicate domain transactions.
4. Explicit and inferred preferences are distinct.
5. Personalization context is derived and bounded.
6. Consent scope is respected.
7. Tenant isolation is mandatory.
8. Sensitive data follows classification and authorization.
9. AI cannot silently promote inference into explicit preference.
10. Historical interactions remain owned by source domains.

## 16. Anti-Duplication

There is one Customer domain model.

Do not create BeautyCustomer, FashionCustomer, MedicalCustomer, or separate AI customer profiles.

Vertical behavior is expressed through relationships, preferences, policy, and adapters.

## 17. Definition of Done

Customer, relationship references, preferences, personalization context, consent references, ownership, privacy, tenancy, capabilities, events, and anti-duplication rules are explicit.
