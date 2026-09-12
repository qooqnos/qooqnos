# Phoenix Database Model — Initial ERD

## Core relationships

```text
User ──< Membership >── Organization ──< Workspace
                           │
                           └──< Business ──< Service
                                      │
                                      ├──< Product ──< ProductVariant ──< Inventory
                                      ├──< Location
                                      └──< Review

User ──< Customer ──< Appointment >── Business

UserRequest ──< MatchRun ──< MatchResult >── Business

Business ──< VerificationCase ──< VerificationDocument
User ──< ConsentRecord
User ──< AuditEvent
```

## Main tables
`users`, `user_profiles`, `sessions`, `organizations`, `workspaces`, `memberships`, `roles`, `permissions`, `role_permissions`, `membership_roles`, `businesses`, `categories`, `business_categories`, `services`, `business_services`, `business_locations`, `products`, `product_variants`, `inventory`, `media_assets`, `media_variants`, `media_links`, `customers`, `customer_profiles`, `reviews`, `user_requests`, `match_runs`, `match_results`, `ai_conversations`, `ai_messages`, `ai_tool_calls`, `ai_safety_events`, `appointment_slots`, `appointments`, `plans`, `subscriptions`, `usage_events`, `verification_cases`, `verification_documents`, `moderation_cases`, `consent_records`, `audit_events`, `modules`, `tenant_modules`.

## Rules
- Tenant-owned records carry tenant context.
- Public IDs are opaque.
- Timestamps are canonical UTC.
- Money uses integer minor units + currency.
- Every schema change is a migration.
- Sensitive data is isolated and access controlled.
