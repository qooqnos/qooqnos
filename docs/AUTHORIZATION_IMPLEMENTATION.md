# Phoenix AI Marketplace — Authorization Implementation

> Status: Implementation Blueprint  
> Scope: TypeScript, Hono/Workers, D1, RBAC, ABAC, tenant isolation, approvals, AI tools and security tests

## 1. Purpose

This document translates `AUTHORIZATION_ARCHITECTURE.md` into an implementation contract for Claude Code and the Phoenix engineering team.

Authorization is a platform capability. Every protected module must consume the same authorization primitives.

## 2. Non-Negotiable Invariants

1. Default deny.
2. Server-side authorization is authoritative.
3. Tenant/workspace scope is enforced in data access, not only controllers.
4. Resource IDs never imply access.
5. Frontend permission checks are UX only.
6. AI cannot grant itself permission.
7. LLM output never directly mutates D1.
8. High-risk operations are auditable.
9. Sensitive-data access requires explicit policy authorization.
10. Authorization failures must not leak protected resource existence.

## 3. Package Boundaries

Recommended packages:

```text
packages/auth/
packages/permissions/
packages/policies/
packages/database/
packages/audit/
packages/core/
```

Responsibilities:

- `auth`: authentication/session identity.
- `permissions`: permission catalog, role resolution and capability checks.
- `policies`: ABAC/resource-state decisions.
- `database`: repositories and tenant-safe queries.
- `audit`: security/audit event recording.
- `core`: shared IDs, request context, errors and types.

No React component may contain authoritative authorization logic.

## 4. Request Context

Every authenticated request should resolve a typed context:

```ts
export interface RequestContext {
  requestId: string;
  actor: Actor;
  tenantId: string | null;
  workspaceId: string | null;
  branchId: string | null;
  sessionId: string;
}
```

The context is created by trusted server middleware, never from arbitrary client input.

## 5. Actor Model

```ts
export type ActorType = "user" | "service";

export interface Actor {
  id: string;
  type: ActorType;
  status: "active" | "suspended" | "disabled";
}
```

Service actors must have explicit capabilities and must not silently inherit human-admin privileges.

## 6. Permission Registry

Permissions use a stable resource/action vocabulary:

```ts
export type Permission =
  | "business.read"
  | "business.create"
  | "business.update"
  | "business.publish"
  | "service.manage"
  | "product.manage"
  | "booking.read"
  | "booking.create"
  | "booking.manage"
  | "customer.read"
  | "review.moderate"
  | "verification.review"
  | "audit.read"
  | "module.manage";
```

The database is the source of truth for deployed permission assignments. TypeScript constants provide compile-time discoverability and prevent spelling drift.

## 7. Role Resolution

Role evaluation:

```text
actor
 ↓
active membership
 ↓
membership roles
 ↓
role permissions
 ↓
requested permission
```

Roles are scoped to a tenant/workspace where applicable.

Do not implement `if (role === "admin")` as the primary authorization mechanism.

## 8. Permission Resolver

Suggested interface:

```ts
export interface PermissionResolver {
  has(
    ctx: RequestContext,
    permission: Permission,
    scope?: ScopeContext,
  ): Promise<boolean>;
}
```

For sensitive operations, return a structured decision rather than only a boolean:

```ts
export interface AuthorizationDecision {
  allowed: boolean;
  reasonCode: string;
  policyVersion: string;
}
```

Internal reason codes should be stable and suitable for audit/testing, but should not expose sensitive policy details to clients.

## 9. Scope Context

```ts
export interface ScopeContext {
  tenantId?: string;
  workspaceId?: string;
  branchId?: string;
  resourceOwnerId?: string;
}
```

Server-resolved scope takes precedence over client-supplied scope.

## 10. Policy Engine

Recommended API:

```ts
can({
  actor,
  permission,
  resource,
  context,
}): Promise<AuthorizationDecision>
```

Policy evaluation should be deterministic and testable.

Evaluation order:

```text
identity status
→ membership
→ permission
→ tenant scope
→ workspace/branch scope
→ ownership/relationship
→ resource state
→ module state
→ approval requirement
→ decision
```

## 11. Middleware

Protected routes should compose authorization explicitly:

```ts
app.post(
  "/api/v1/bookings",
  requireAuth(),
  requireTenant(),
  requirePermission("booking.create"),
  createBookingHandler,
);
```

The handler should not repeat authentication logic.

For resource-specific actions:

```ts
requirePermission("booking.manage")
requireResourcePolicy("booking", "manage")
```

## 12. Domain Service Boundary

Authorization must be enforced again at sensitive domain-service boundaries when operations can be invoked from multiple entry points.

Example:

```ts
await bookingService.cancel({
  ctx,
  bookingId,
});
```

The service verifies that the actor can cancel that booking. This prevents a future queue, CLI, agent or internal route from accidentally bypassing authorization.

## 13. Repository Boundary

Repositories must require tenant scope for tenant-owned resources.

Bad:

```ts
findBusiness(id)
```

Good:

```ts
findBusiness({ tenantId, businessId })
```

Prefer repository methods whose signatures make unsafe cross-tenant access difficult or impossible.

## 14. D1 Query Rule

Tenant filtering must be part of the SQL query:

```sql
SELECT *
FROM businesses
WHERE id = ?
  AND tenant_id = ?
  AND deleted_at IS NULL;
```

Do not fetch globally and filter in application memory.

## 15. Ownership Policies

Ownership is resource-specific.

Examples:

```text
service.update
AND service.business_id belongs to authorized tenant
```

```text
booking.read
AND booking.workspace_id is within actor scope
```

```text
customer.read
AND relationship/customer ownership policy passes
```

Policies should be explicit rather than hidden inside arbitrary handlers.

## 16. Customer Isolation

Customer endpoints must prevent IDOR-style access.

For example:

```text
GET /customers/{id}
```

must resolve:

```text
actor
→ customer relationship
→ authorized tenant/resource scope
→ query
```

A random valid UUID must never be sufficient to retrieve a record.

## 17. Approval Engine

Approval is a state transition, not merely another permission.

Suggested model:

```ts
ApprovalRequest {
  id: string;
  tenantId: string;
  resourceType: string;
  resourceId: string;
  requestedBy: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
}
```

For high-risk actions, require an authorized approver distinct from the requester unless a policy explicitly permits self-approval.

## 18. Separation of Duties

The policy engine should support:

```ts
policy.requiresDifferentActor("verification.approve")
```

At minimum, verification approval, privileged account creation, large refunds and similarly high-risk workflows should be designed for separation of duties.

## 19. Service Identities

Background workers use explicit service identities:

```text
notification-worker
search-indexer
document-worker
analytics-worker
```

Each service receives only the permissions required for its job.

Never create a generic `system.admin` identity for ordinary background processing.

## 20. AI Tool Authorization

AI tools are ordinary privileged operations and must pass the same authorization system.

Flow:

```text
LLM output
 ↓
Tool schema validation
 ↓
User/session context
 ↓
Permission resolver
 ↓
Resource policy
 ↓
Domain service
 ↓
Repository
 ↓
D1
```

Example:

```ts
await authorization.can({
  actor: ctx.actor,
  permission: "booking.create",
  resource: bookingInput,
  context: ctx,
});
```

The model may request an action; it cannot authorize the action.

## 21. Medical Sensitive Data

Medical-sensitive records must have dedicated permission and policy checks.

Examples:

```text
medical.sensitive_data.read
medical.verification.review
medical.profile.approve
```

Access should be purpose-limited, logged and restricted by role/scope.

Phoenix's medical AI remains a matching/recommendation layer and must not use privileged access to diagnose, prescribe or make treatment decisions.

## 22. Impersonation

Impersonation requires:

- dedicated permission
- reason
- time-limited session/context
- visible UI state
- immutable audit trail
- clear distinction between support actor and impersonated actor

The system must not silently convert an impersonated user into an administrator.

## 23. Error Contract

External clients receive a stable error shape:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You are not authorized to perform this action.",
    "requestId": "..."
  }
}
```

Do not return internal policy rules, role names, SQL details or sensitive resource existence.

## 24. Audit Integration

Authorization decisions for high-risk actions should generate audit events.

Required fields:

```text
request_id
actor_id
tenant_id
workspace_id
action
resource_type
resource_id
result
timestamp
reason_code
```

Avoid storing raw credentials, session tokens or unnecessary sensitive payloads.

## 25. Caching

Permission resolution can use short-lived caching for ordinary reads.

Rules:

- cache keys must include actor and scope
- permission changes must invalidate affected entries
- high-risk decisions should use fresh state
- never cache authorization indefinitely

Example key:

```text
authz:{actorId}:{tenantId}:{workspaceId}:{permission}:{resourceId}
```

## 26. Frontend Authorization

The frontend receives effective capabilities to improve UX:

```ts
if (capabilities.includes("booking.create")) {
  showCreateBooking();
}
```

But every API mutation independently verifies authorization.

Never treat route hiding, disabled buttons or local state as a security control.

## 27. Dashboard Model

All dashboards consume a shared capability model:

```text
Platform Admin
Business/Partner
Customer
Internal Team
```

Navigation, widgets and actions can be permission-aware without duplicating security rules.

## 28. Database Tables

Minimum authorization tables:

```text
roles
permissions
role_permissions
membership_roles
access_policies
```

Later, when justified:

```text
permission_overrides
approval_requests
approval_steps
service_identities
```

Avoid premature permission overrides because they can make the effective access graph difficult to reason about.

## 29. Migration Requirements

Every authorization schema change must include:

1. Forward migration.
2. Deterministic seed/update strategy.
3. Backward compatibility assessment.
4. Tests for existing roles.
5. Documentation update.

Never silently delete a permission that may still be referenced by a role.

## 30. Security Test Matrix

For every protected resource, test:

```text
allowed actor
unauthenticated actor
denied actor
wrong tenant
wrong workspace
wrong branch
wrong owner
suspended actor
inactive module
invalid resource state
missing approval
self-approval
expired session
```

Add explicit IDOR tests for resource IDs supplied by clients.

## 31. Property-Level Tests

Security invariants should also be tested as properties:

```text
No actor can read another tenant's resource.
No customer can enumerate another customer's records.
No AI tool can execute without authorization.
No denied permission becomes allowed through malformed input.
```

## 32. Performance Targets

Authorization should normally add a small, bounded amount of latency to ordinary API requests.

Targets:

- avoid N+1 permission queries
- batch role/permission resolution where practical
- cache safe repeated reads
- keep high-risk checks strongly consistent
- avoid loading entire tenant membership graphs for one request

## 33. Observability

Measure:

```text
authorization latency
permission cache hit rate
deny rate by reason code
cross-tenant violation attempts
high-risk authorization failures
approval latency
AI tool authorization failures
```

Security events should be distinguishable from ordinary application errors.

## 34. Implementation Sequence

### Phase A — Foundation

- actor/context types
- permissions table
- roles
- membership roles
- permission resolver
- default-deny guard

### Phase B — Scope

- tenant scope
- workspace scope
- branch scope
- repository enforcement
- ownership policies

### Phase C — Governance

- audit events
- approval requests
- separation of duties
- impersonation controls

### Phase D — AI

- tool registry
- tool authorization
- service identities
- AI security tests

### Phase E — Medical

- sensitive-data permissions
- credential verification policies
- consent-aware access
- enhanced audit controls

## 35. Claude Code Rules

When implementing authorization:

1. Read `AUTHORIZATION_ARCHITECTURE.md` first.
2. Read this implementation blueprint.
3. Inspect current schema before writing migrations.
4. Reuse existing auth/context abstractions.
5. Never create a parallel role system.
6. Never trust client-provided tenant IDs without server validation.
7. Add negative tests before declaring a protected endpoint complete.
8. Update documentation when adding permissions.
9. Do not log secrets or session tokens.
10. Run typecheck, lint, unit and security tests.

## 36. Definition of Done

Authorization implementation is complete only when:

- permission catalog exists
- role mapping exists
- request context is trusted
- tenant isolation is enforced at repository level
- ABAC policies are centralized
- default deny is active
- high-risk actions are audited
- approval workflows are supported where required
- AI tools pass authorization
- negative/IDOR tests exist
- frontend checks are treated as UX only
- migrations and documentation are committed

## 37. Final Decision

Phoenix will implement authorization as a centralized platform service composed of:

```text
Authentication
+ RBAC
+ ABAC
+ Tenant/Workspace Scope
+ Resource Ownership
+ Approval Workflow
+ Audit
+ AI Tool Authorization
```

This layer is mandatory for every Phoenix module and every dashboard.