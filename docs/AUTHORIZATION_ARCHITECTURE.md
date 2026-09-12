# Phoenix AI Marketplace — Authorization Architecture

> Status: Proposed / Architecture Baseline  
> Scope: Platform, Organization, Workspace, Branch, Team, Customer and Module access

## 1. Objective

Phoenix requires a centralized authorization model that is secure, multi-tenant, modular and extensible. Authorization must not be implemented separately inside each dashboard or frontend application.

The model combines:

- RBAC — Role-Based Access Control
- ABAC — Attribute-Based Access Control
- Resource ownership
- Tenant/workspace scope
- Resource state/policy checks
- Approval workflows
- Auditability

Authentication answers **who are you?**. Authorization answers **what may you do, to which resource, within which scope, under which conditions?**

## 2. Security Principle

> The server is the final authority for authorization.

Frontend permissions are for UX only. They must never be considered a security boundary.

Every protected request follows:

```text
Request
  ↓
Authenticate
  ↓
Resolve tenant/workspace context
  ↓
Load actor + membership
  ↓
Check permission
  ↓
Evaluate policy / attributes
  ↓
Check resource ownership/scope
  ↓
Check resource state
  ↓
Allow or deny
  ↓
Audit high-risk actions
```

## 3. Scope Hierarchy

```text
Platform
└── Organization
    ├── Workspace
    │   ├── Team
    │   └── Branch / Location
    └── Users / Memberships
```

A user can have different roles in different organizations/workspaces.

Never assume that a user's global role applies to every tenant.

## 4. Core Concepts

### Subject

The authenticated actor:
- user
- service identity
- trusted system process

### Resource

The object being accessed:
- business
- service
- product
- booking
- customer
- review
- media asset
- verification case
- subscription

### Action

Examples:

```text
read
create
update
delete
publish
approve
reject
manage
export
refund
impersonate
```

### Scope

Where the action is valid:

```text
platform
organization
workspace
branch
resource
```

### Policy

Additional conditions that must be satisfied after the permission exists.

## 5. RBAC

Roles are bundles of permissions.

Recommended system roles:

```text
Platform Owner
Platform Admin
Support
Moderator
Auditor
Organization Owner
Organization Admin
Workspace Manager
Branch Manager
Staff
Partner
Customer
```

Roles are not hard-coded into UI logic. They resolve to permissions through database configuration.

## 6. Permissions

Permission format:

```text
<resource>.<action>
```

Examples:

```text
business.read
business.create
business.update
business.publish
service.read
service.manage
booking.read
booking.create
booking.cancel
booking.manage
customer.read
customer.update
review.moderate
verification.review
audit.read
subscription.manage
module.manage
```

Avoid permissions such as `is_admin`. Prefer explicit capabilities.

## 7. ABAC

RBAC alone is insufficient for Phoenix.

Example:

```text
Role: Workspace Manager
Permission: booking.read

Policy:
booking.workspace_id == actor.workspace_id
```

Another example:

```text
Role: Staff
Permission: customer.read

Policy:
customer belongs to assigned branch
AND
customer relationship is active
```

ABAC attributes may include:

- actor organization
- actor workspace
- actor branch
- actor team
- resource organization
- resource workspace
- resource owner
- resource status
- verification status
- relationship status
- action risk level
- feature/module state

## 8. Resource Ownership

Ownership is an additional authorization signal, not a replacement for permissions.

Example:

```text
user has service.update
AND
service.business_id belongs to user's authorized organization
```

Never authorize solely because an ID was supplied by the authenticated user.

## 9. Tenant Isolation

Every tenant-scoped query must contain tenant context.

Bad:

```ts
getBusiness(businessId)
```

Preferred:

```ts
getBusiness({ tenantId, businessId })
```

The repository/data-access layer must enforce the tenant condition.

Do not:

```text
fetch by ID
→ return record
→ check tenant in frontend
```

Correct:

```text
resolve tenant
→ authorize
→ query within tenant scope
→ return resource
```

## 10. Workspace Isolation

Workspace access is narrower than organization access.

A user with organization-level permission may still be restricted by policy for workspace-specific resources.

Policies must explicitly define whether a permission is:

- organization-wide
- workspace-scoped
- branch-scoped
- ownership-scoped

## 11. Permission Resolution

Recommended evaluation:

```text
1. Is the user authenticated?
2. Is the account active?
3. Is the requested tenant valid?
4. Is the user a member of the tenant?
5. Does the user's role grant the permission?
6. Does the resource belong to an authorized scope?
7. Do ABAC policies pass?
8. Is the resource state compatible with the action?
9. Is the module enabled?
10. Is approval required?
11. Allow / deny
```

Fail closed.

## 12. Deny by Default

If no rule explicitly grants access, access is denied.

Never implement:

```ts
if (!denied) allow()
```

Prefer:

```ts
if (!explicitlyAllowed) deny()
```

## 13. Approval Workflows

Some permissions require more than access.

Examples:

```text
Business publish
Verification approve
Refund
Provider credential approval
Medical profile activation
Moderation resolution
```

Model these as workflows:

```text
permission
  ↓
policy
  ↓
approval requirement
  ↓
approver authorization
  ↓
state transition
  ↓
audit event
```

A user must not approve their own high-risk operation unless an explicit policy permits it.

## 14. Separation of Duties

High-risk actions should support separation of duties.

Examples:

```text
Submit verification
≠
Approve verification
```

```text
Create refund
≠
Approve large refund
```

```text
Create privileged account
≠
Approve privileged account
```

## 15. Permission Categories

Organize permissions by module:

```text
identity.*
tenancy.*
business.*
service.*
product.*
media.*
booking.*
customer.*
review.*
ai.*
verification.*
moderation.*
billing.*
audit.*
module.*
```

This allows new Phoenix modules to register permissions without redesigning authorization.

## 16. Module Manifest

Each module should declare permissions:

```ts
{
  id: "booking",
  version: "1.0.0",
  permissions: [
    "booking.read",
    "booking.create",
    "booking.cancel",
    "booking.manage"
  ]
}
```

Module activation must register or validate its permission set.

## 17. API Authorization

Every protected API route must declare its authorization requirement.

Conceptually:

```ts
requirePermission("booking.create")
```

Then domain policies evaluate scope and resource conditions.

Authorization must execute before sensitive domain operations.

## 18. Service-to-Service / System Actions

Background jobs and workers must not impersonate users casually.

Use explicit service identities or job identities with narrowly scoped capabilities.

Example:

```text
SearchIndexer
NotificationWorker
DocumentWorker
AnalyticsWorker
```

A queue consumer should receive only the capabilities required for its job.

## 19. AI Authorization

AI is never a privileged identity merely because it is an AI agent.

The AI execution context inherits the user's authorized scope where applicable and must still pass domain authorization.

Required flow:

```text
User
 ↓
AI
 ↓
Tool request
 ↓
Schema validation
 ↓
Policy validation
 ↓
Authorization
 ↓
Domain service
 ↓
Database
```

The model cannot grant itself permissions.

## 20. Medical Authorization

Medical requires stricter policies.

Examples:

```text
medical.provider.read
medical.verification.review
medical.profile.approve
medical.sensitive_data.read
```

Access to sensitive medical information must be purpose-limited and auditable.

The AI must not use authorization as a way to diagnose, prescribe or make clinical decisions. The medical roadmap defines Phoenix's role as matching users to suitable verified options, not diagnosis/treatment.

## 21. Customer Access

Customers should not be treated as unrestricted tenant members.

Customer access should generally be resource/relationship scoped.

Example:

```text
customer.read
AND
appointment.customer_id == actor.customer_id
```

A customer must not enumerate another customer's records by changing an ID.

## 22. Partner Access

Partners may receive limited access to selected resources.

Example:

```text
partner.booking.read
partner.business.update
```

Partner scope must be explicitly associated with businesses/workspaces they are authorized to operate.

## 23. Impersonation

Support/admin impersonation is high-risk.

Requirements:
- explicit permission
- reason required
- visible impersonation state
- time-limited session
- full audit trail
- no silent privilege escalation

The impersonated user's permissions should remain distinguishable from the support actor's identity.

## 24. Permission Caching

Authorization decisions may be cached carefully for performance, but cache invalidation must be designed around permission changes.

Do not cache high-risk authorization indefinitely.

Permission changes should invalidate relevant cached authorization state.

## 25. Audit Requirements

Audit high-risk actions including:

- role changes
- permission changes
- account suspension
- business approval
- verification decisions
- medical verification decisions
- refunds
- privileged exports
- impersonation
- sensitive-data access
- module activation

Audit should capture:

```text
actor
organization/tenant
workspace
action
resource
result
timestamp
request_id
reason where required
```

## 26. Error Semantics

Externally, avoid leaking sensitive authorization details.

Typical response:

```text
403 Forbidden
```

Do not reveal whether another user's resource exists when that information itself is sensitive.

For resource lookup, authorization-aware not-found behavior may be appropriate.

## 27. Frontend Behavior

Frontend uses permissions to:
- hide navigation
- disable actions
- improve UX
- prevent unnecessary requests

But the backend must enforce the same capability independently.

A hidden button is not authorization.

## 28. Dashboard Architecture

Use one permission-aware dashboard framework.

```text
Dashboard Shell
├── Navigation
├── Widgets
├── Actions
└── Module UI
       ↓
Permission Resolver
       ↓
Authorized capabilities
```

Admin, Partner and Customer dashboards can share infrastructure while receiving different permission sets.

## 29. Testing Matrix

Every protected capability should have tests for:

```text
authenticated + allowed
authenticated + denied
wrong tenant
wrong workspace
wrong branch
wrong owner
inactive account
inactive module
invalid resource state
missing approval
expired privilege
```

High-risk capabilities require explicit negative tests.

## 30. Security Invariants

These must never be violated:

1. No tenant crossing.
2. No privilege escalation through client input.
3. No authorization based solely on hidden UI.
4. No AI-created permissions.
5. No direct LLM-to-database mutation.
6. No self-approval for restricted workflows unless explicitly allowed.
7. No raw session-token logging.
8. No access to sensitive data without policy authorization.
9. No wildcard admin permission for ordinary users.
10. Default deny.

## 31. Recommended Implementation Layers

```text
apps/worker
  ↓
auth middleware
  ↓
permission guard
  ↓
policy engine
  ↓
domain service
  ↓
repository
  ↓
D1
```

Suggested packages:

```text
packages/auth
packages/permissions
packages/core
packages/database
packages/audit
```

## 32. Policy Engine

Keep policy evaluation centralized enough to remain consistent, but domain-aware enough to understand resource ownership and state.

Suggested interface:

```ts
can({
  actor,
  action,
  resource,
  context,
}): Decision
```

Decision:

```ts
{
  allowed: boolean,
  reasonCode: string,
  policyVersion: string
}
```

Do not expose internal policy reasoning that could help attackers bypass controls.

## 33. Recommended Database Tables

Core tables:

```text
roles
permissions
role_permissions
membership_roles
access_policies
```

Optional later tables:

```text
permission_overrides
approval_requests
approval_steps
service_identities
```

Avoid adding overrides until real use cases justify them; direct role/permission assignment should remain the normal path.

## 34. Implementation Order

### Step 1
Identity + sessions

### Step 2
Organizations + workspaces + memberships

### Step 3
Roles + permissions

### Step 4
Permission resolver

### Step 5
Tenant/workspace policy enforcement

### Step 6
Resource ownership policies

### Step 7
Audit events

### Step 8
Approval workflow

### Step 9
AI tool authorization

### Step 10
Medical-specific policies

## 35. Definition of Done

Authorization is not complete until:

- permission catalog exists
- role model exists
- tenant scope is enforced
- resource ownership is enforced
- policies are server-side
- default deny is implemented
- privileged actions are audited
- high-risk workflows support approval where required
- AI tools use authorization
- frontend permissions are treated only as UX
- negative security tests exist
- documentation is updated

## 36. Final Decision

Phoenix will use **RBAC + ABAC + Resource Ownership + Tenant/Workspace Scope + Approval Workflow** as its authorization architecture.

Authorization will be centralized as a platform capability and consumed by all modules.

No business, AI, dashboard or industry module may implement an independent security model that bypasses the Phoenix authorization layer.
