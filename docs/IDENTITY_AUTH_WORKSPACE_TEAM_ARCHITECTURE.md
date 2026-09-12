# Phoenix Identity / Authentication / Workspace / Team Architecture

## 1. Purpose

Identity is the security foundation connecting Customer, Business/Partner, Admin, and Internal Team experiences.

The architecture separates:

- **Identity** — who the actor is
- **Authentication** — how the actor proves control of an account
- **Workspace/Tenant** — which organizational context is active
- **Membership** — which actor belongs to which workspace
- **Role/Permission** — what the actor may do
- **Entitlement** — what the workspace/plan may use
- **Resource policy** — whether the actor may access a particular resource

No module may implement its own competing identity or authorization system.

## 2. Core Invariants

1. One canonical actor identity per account.
2. Authentication never implies authorization.
3. Workspace context is explicit and validated server-side.
4. Membership is separate from role.
5. Roles are not the same as product entitlements.
6. Permission checks are centralized.
7. Every sensitive operation is tenant-scoped and auditable.
8. Customer, Partner, Admin, and Internal Team are experiences/actor types, not separate authentication databases.
9. AI receives only the minimum authorized context and cannot manufacture identity, membership, or permissions.

## 3. Actor Model

A canonical `users` identity represents an authenticated human account.

Additional concepts:

- `user_profiles`
- `organizations`
- `workspaces`
- `workspace_memberships`
- `roles`
- `role_permissions`
- `sessions`
- `authenticators`
- `invitations`
- `security_events`

A user may belong to multiple workspaces.

A workspace may represent:

- a business/partner organization
- an internal operational team
- an administrative scope
- future organization structures

Customer activity may be personal rather than workspace-owned.

## 4. Authentication

Authentication is an adapter boundary. The initial implementation should prefer a mature managed identity provider rather than building a custom auth server.

Supported mechanisms can evolve independently:

- passwordless/email verification
- OAuth/social login
- enterprise SSO later
- MFA/passkeys where supported
- recovery flows

The domain must not depend on a specific provider's user ID as its only identifier. Store a stable internal user ID and provider identity mapping.

## 5. Session Security

Sessions must be:

- short-lived where practical
- revocable
- rotated after sensitive authentication events
- protected against fixation
- scoped to the authenticated actor
- invalidated after account security events when required

Prefer secure, HttpOnly, SameSite cookies for browser sessions. Avoid exposing long-lived authentication tokens to client JavaScript.

Sensitive operations may require recent authentication or step-up authentication.

## 6. Workspace Context

Every protected request resolves:

```text
request
 -> authenticated user
 -> requested workspace
 -> membership
 -> active role/permissions
 -> resource policy
```

A workspace ID supplied by the client is only a candidate context; membership must be revalidated server-side.

Never infer workspace solely from URL, hostname, or UI state.

## 7. Membership

Membership records should include:

```text
workspace_id
user_id
status
role_assignments
joined_at
invited_by
last_active_at
```

Lifecycle:

```text
invited -> pending -> active -> suspended -> removed
```

Removal should revoke active access without deleting historical audit records.

## 8. Roles and Permissions

Roles are bundles of permissions, not the authorization decision itself.

Example permissions:

```text
business.profile.read
business.profile.update
catalog.offer.create
catalog.offer.publish
booking.read
booking.manage
crm.read
crm.manage
communications.send
reviews.moderate
verification.review
verification.approve
billing.manage
team.manage
```

High-risk permissions require explicit assignment and may require separation of duties.

Examples:

- The person who submits verification should not automatically be the approver.
- A partner operator may manage catalog but not approve their own regulated claims.
- A support agent may view permitted customer context without receiving unrestricted administrative power.

## 9. Authorization Pipeline

Every protected command follows:

```text
Authentication
 -> Actor
 -> Workspace
 -> Membership
 -> Permission
 -> Resource policy
 -> Entitlement/feature gate
 -> Domain service
 -> Audit
```

Authorization must happen server-side before domain mutation.

UI hiding is not authorization.

## 10. Resource-Level Authorization

Permission alone is insufficient.

Examples:

- A partner may edit only offers owned by its workspace.
- A verification reviewer may review assigned/eligible cases according to policy.
- An internal support user may access a customer record only within permitted support scope.
- A customer may access only their own private resources.

Resource ownership and tenant boundaries must be evaluated in the domain/application layer.

## 11. Customer vs Partner vs Admin

### Customer

Typically has personal identity and personal resources:

- profile
- preferences
- saved items
- bookings
- communication history
- reviews

### Partner / Business

Uses workspace membership:

- business profile
- catalog
- portfolio/media
- availability
- bookings
- CRM
- communications
- reviews
- analytics
- team

### Platform Admin

Uses tightly scoped administrative workspaces/permissions and privileged audit controls.

### Internal Team

Uses dedicated workgroups and least-privilege permissions for operations, support, verification, moderation, or quality.

These experiences must not create duplicate identity records.

## 12. Invitations

Workspace invitations must be:

- scoped to a workspace
- single-purpose
- expiring
- revocable
- bound to intended email/account where appropriate
- auditable

Accepting an invitation creates or activates membership only after authentication and policy validation.

## 13. Account Recovery

Recovery must not become an authorization bypass.

Use:

- expiring recovery tokens
- one-time consumption
- rate limits
- security event logging
- session revocation after recovery where appropriate

Do not reveal whether arbitrary email addresses have accounts through recovery endpoints.

## 14. MFA / Step-Up

High-risk actions should support step-up authentication, including where applicable:

- changing security settings
- changing sensitive workspace permissions
- exporting sensitive data
- accessing highly restricted documents
- financial administration
- destructive account operations

The exact requirement is policy-driven.

## 15. Service-to-Service Identity

Internal module calls are not automatically trusted merely because they originate inside the monolith.

Application services receive an explicit actor/security context:

```text
actor_id
workspace_id
permissions
purpose
request_id
```

Background jobs must carry an explicit execution identity and purpose. Never fabricate a human administrator identity for convenience.

## 16. AI Security Context

AI tools receive a constrained authorization context.

The AI layer may request a domain operation only through registered tools.

```text
LLM
 -> validated tool input
 -> actor/workspace context
 -> permission
 -> resource policy
 -> domain service
```

The model cannot:

- assign itself a role
- switch to an unauthorized workspace
- retrieve arbitrary tenant data
- issue admin commands through free-form SQL

## 17. Sensitive Data

Sensitive resources require additional policy dimensions:

- purpose
- actor role
- workspace
- consent where required
- sensitivity classification
- audit requirement
- retention policy

Medical or verification-sensitive information must not become broadly visible merely because a user belongs to a business workspace.

## 18. Audit and Security Events

Record security-sensitive events such as:

- login success/failure
- MFA events
- session revocation
- invitation creation/acceptance/revocation
- membership changes
- role/permission changes
- sensitive resource access
- privileged operations
- account recovery
- suspicious authorization attempts

Audit records should contain actor, workspace, action, resource reference, timestamp, request/correlation ID, outcome, and policy/version context where relevant.

Do not store secrets or unnecessary sensitive payloads.

## 19. Rate Limiting and Abuse Controls

Apply limits to:

- login/recovery
- invitation creation
- authentication attempts
- permission-changing actions
- sensitive exports
- high-volume API access

Rate limits should be scoped by risk rather than a single global counter.

## 20. Data Model Boundaries

Identity owns:

- user identity
- external identity mappings
- sessions/authenticators
- workspace membership
- invitations
- security events

Authorization owns centralized permission definitions and policy evaluation infrastructure.

Billing owns entitlements.

Business, Catalog, Booking, CRM, Communications, Reviews, Media, and other modules own their domain resources.

No module duplicates user authentication tables.

## 21. APIs

Illustrative APIs:

```text
GET  /api/v1/me
GET  /api/v1/workspaces
POST /api/v1/workspaces
GET  /api/v1/workspaces/{id}/members
POST /api/v1/workspaces/{id}/invitations
POST /api/v1/workspaces/{id}/members/{memberId}/suspend
```

Authentication-provider endpoints remain behind the identity adapter.

All APIs pass through the central request authorization pipeline.

## 22. Cross-Module Events

Versioned events may include:

- `identity.user.created.v1`
- `identity.user.security_changed.v1`
- `workspace.created.v1`
- `workspace.member.invited.v1`
- `workspace.member.activated.v1`
- `workspace.member.suspended.v1`
- `workspace.member.removed.v1`
- `authorization.role_assignment.changed.v1`

Consumers must be idempotent and must not treat events as permission grants without their own policy evaluation.

## 23. Testing

Mandatory tests:

- cross-tenant access denial
- cross-workspace access denial
- removed/suspended membership denial
- role/permission enforcement
- resource ownership enforcement
- invitation expiry/revocation
- session revocation
- recovery token replay prevention
- account enumeration resistance
- privileged operation audit
- AI tool authorization
- background-job identity propagation
- sensitive-resource access policy

## 24. Implementation Order

1. Internal user identity model
2. External identity/provider adapter
3. Session management
4. Workspace and membership model
5. Central permission registry integration
6. Role assignment and invitation flow
7. Resource-policy middleware/service
8. Security event/audit integration
9. Step-up/MFA hooks
10. Customer/Partner/Admin experience integration
11. AI authorization-context integration
12. Security and tenant-isolation test suite

## 25. Definition of Done

Identity architecture is complete when:

- all protected flows have one authorization pipeline
- workspace context is server-validated
- membership, permissions, and entitlements remain separate
- customer/partner/admin/internal users share canonical identity infrastructure
- high-risk actions have appropriate step-up/audit controls
- no module maintains duplicate authentication state
- AI cannot bypass authorization
- tenant isolation tests pass
- recovery and session revocation are secure
- sensitive access is auditable
