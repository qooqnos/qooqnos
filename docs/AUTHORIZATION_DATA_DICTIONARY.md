# Phoenix Authorization Data Dictionary

**Status:** Canonical architecture contract
**Scope:** Authorization vocabulary, data entities, value objects, decision records, policies, approvals, scope, audit references, capabilities, events, invariants, and ownership.

## 1. Purpose

This document is the canonical data dictionary for Phoenix authorization. It translates the existing Authorization Architecture into stable domain terms without introducing a second permission, role, policy, approval, or tenant-isolation model.

Authorization is a platform capability. All modules, dashboards, APIs, AI tools, workflows, plugins, and integrations reuse this model.

## 2. Ownership boundaries

| Concept | Owner |
|---|---|
| User / Session / Membership | Identity |
| Role / Permission / Access Policy | Access / Authorization |
| Capability | Platform / owning domain module |
| Entitlement / Plan / Subscription | Billing |
| Resource ownership and lifecycle | Resource-owning module |
| Approval workflow | Authorization / Automation contract |
| Audit evidence | Platform / Audit |
| Authentication | Identity |
| AI tool invocation | AI, delegated to Authorization for access decision |

Authorization evaluates access; it does not own the business resource being protected.

## 3. Canonical vocabulary

### Actor
Authenticated principal requesting an operation. An Actor may represent a human User or an explicitly scoped service identity.

### ActorType
Canonical actor classification: `USER` or `SERVICE`.

### Role
Named bundle of permissions assignable through an authorized scope. A Role is not an administrator shortcut and does not itself bypass policy.

### Permission
Atomic authorization action such as `booking.create`, `business.update`, or `verification.review`.

### Policy
Versioned rule set used to evaluate contextual authorization conditions such as ownership, resource state, scope, approval, or separation of duties.

### AccessDecision
Runtime result of authorization evaluation. It is not a mutable business entity.

### ScopeContext
Server-resolved authorization boundary containing applicable organization, workspace, business, location, resource-owner, or other approved scope identifiers.

### ResourcePolicyContext
Context required to evaluate access to a specific resource, including resource type, resource identifier, owner relationship, tenant, state, and relevant policy attributes.

### PermissionAssignment
Relationship assigning a Permission to a Role within the permitted scope.

### MembershipRole
Relationship assigning a Role to an Identity Membership.

### ApprovalRequest
Durable request for an approval-required operation.

### ApprovalStep
One ordered approval requirement within an ApprovalRequest.

### ServiceIdentity
Explicit non-human actor used by background or system processes. It receives only explicitly granted capabilities/permissions.

### ImpersonationContext
Time-limited, explicitly authorized context in which a support/admin actor acts on behalf of another actor, while preserving both identities in audit evidence.

### AuthorizationAuditReference
Reference from an authorization-sensitive action to immutable audit evidence. It does not duplicate the complete audit event.

## 4. Identity and actor data

| Field | Meaning | Required |
|---|---|---:|
| `actor_id` | stable User or ServiceIdentity identifier | yes |
| `actor_type` | USER or SERVICE | yes |
| `actor_status` | active/suspended/disabled state | yes |
| `session_id` | authenticated session reference for user actors | conditional |
| `membership_id` | resolved tenant/workspace membership | conditional |
| `tenant_id` | authoritative organization/tenant boundary | conditional |
| `workspace_id` | operational workspace boundary | conditional |
| `business_id` | business scope where applicable | conditional |
| `location_id` | location scope where applicable | conditional |

Client-provided scope is never authoritative over server-resolved scope.

## 5. Permission data model

### Permission

Canonical fields:

- `id`
- `resource`
- `action`
- `identifier`
- `description`
- `status`
- `version`
- `sensitivity`
- `created_at`
- `updated_at`

`identifier` is the stable permission key. It must not be silently renamed while active assignments exist.

### Role

Canonical fields:

- `id`
- `name`
- `description`
- `scope_type`
- `status`
- `version`
- `system_managed`
- `created_at`
- `updated_at`

Role names are descriptive. Authorization must evaluate effective permissions and policy, not string comparisons such as `role == admin`.

### RolePermission

Canonical relationship fields:

- `role_id`
- `permission_id`
- `scope_type`
- `created_at`

A RolePermission cannot grant permissions outside the allowed scope of the Role or Permission.

### MembershipRole

Canonical relationship fields:

- `membership_id`
- `role_id`
- `scope_type`
- `scope_id`
- `status`
- `granted_at`
- `expires_at`
- `granted_by`

Assignments are tenant-bound and must respect role scope.

## 6. Policy data model

### AccessPolicy

Canonical fields:

- `id`
- `name`
- `version`
- `status`
- `effect` (`ALLOW` / `DENY`)
- `conditions`
- `priority`
- `scope_type`
- `created_at`
- `updated_at`

Policies are deterministic and versioned. A policy version used for a high-risk decision must remain reconstructable for audit.

### PolicyCondition

A typed predicate evaluated against authorization context. Examples include:

- actor status;
- membership status;
- tenant/workspace scope;
- resource ownership;
- relationship to resource;
- resource lifecycle state;
- module state;
- approval state;
- separation-of-duties requirement;
- sensitive-data purpose.

Conditions must reference canonical context fields rather than inventing parallel identity or ownership data.

## 7. Scope model

Canonical scope hierarchy:

```text
GLOBAL
  ↓
ORGANIZATION / TENANT
  ↓
WORKSPACE
  ↓
BUSINESS
  ↓
LOCATION
  ↓
RESOURCE
```

Not every capability uses every level. The capability contract defines its valid scope.

### ScopeContext fields

- `tenant_id`
- `organization_id`
- `workspace_id`
- `business_id`
- `location_id`
- `resource_type`
- `resource_id`
- `resource_owner_id`

Tenant and ownership relationships must be validated against authoritative domain state.

## 8. AccessDecision model

AccessDecision is a runtime decision containing:

- `allowed`
- `decision_code`
- `reason_code`
- `policy_id`
- `policy_version`
- `permission_id`
- `actor_id`
- `scope_context`
- `evaluated_at`
- `request_id`
- `correlation_id`

The external response may expose only a stable authorization error. Internal policy details and protected resource existence must not leak.

## 9. Authorization request

An AuthorizationRequest represents the complete input to a decision evaluation:

- actor;
- requested permission/capability;
- tenant/workspace scope;
- resource type and identifier where applicable;
- resource policy context;
- requested operation;
- request/correlation identifiers;
- purpose for sensitive-data access where required;
- impersonation context where applicable.

The server constructs authoritative fields.

## 10. Capability relationship

Authorization protects capabilities rather than duplicating domain behavior.

Canonical trace:

```text
Actor
 ↓
Membership / ServiceIdentity
 ↓
Role
 ↓
Permission
 ↓
Capability
 ↓
Resource Policy
 ↓
AccessDecision
 ↓
Domain Capability Execution
```

A Capability remains owned by its domain module. Authorization only determines whether it may execute.

## 11. Approval model

### ApprovalRequest

Canonical fields:

- `id`
- `tenant_id`
- `workspace_id`
- `resource_type`
- `resource_id`
- `capability_id`
- `requested_by_actor_id`
- `status`
- `reason`
- `created_at`
- `expires_at`
- `completed_at`

Lifecycle:

`PENDING → APPROVED | REJECTED | CANCELLED | EXPIRED`

### ApprovalStep

Canonical fields:

- `id`
- `approval_request_id`
- `sequence`
- `required_permission`
- `approver_scope`
- `approver_actor_id`
- `status`
- `decided_at`
- `decision_reason`

High-risk operations should support separation of duties. Self-approval is denied unless an explicit policy permits it.

## 12. Service identity model

ServiceIdentity represents a non-human runtime actor.

Canonical fields:

- `id`
- `name`
- `status`
- `purpose`
- `scope_type`
- `scope_id`
- `created_at`
- `disabled_at`

Examples include notification worker, search indexer, document worker, and analytics worker.

A service identity must not inherit generic human-admin authority.

## 13. Impersonation model

ImpersonationContext is an explicit, time-limited security context.

Canonical fields:

- `id`
- `support_actor_id`
- `target_actor_id`
- `reason`
- `started_at`
- `expires_at`
- `status`
- `audit_reference`

All actions preserve the original support actor and target actor identities.

## 14. Sensitive-data authorization

Sensitive access requires explicit policy context.

Canonical data attributes:

- `data_classification`
- `purpose`
- `requested_by_actor`
- `tenant_scope`
- `resource_scope`
- `policy_version`
- `audit_reference`

Medical-sensitive access is policy-controlled and logged. Authorization does not transform the AI layer into a diagnostic or treatment authority.

## 15. Audit linkage

Authorization must reference, not duplicate, immutable audit evidence.

Minimum linkage fields:

- `request_id`
- `correlation_id`
- `actor_id`
- `tenant_id`
- `workspace_id`
- `permission`
- `capability_id`
- `resource_type`
- `resource_id`
- `decision`
- `reason_code`
- `policy_version`
- `timestamp`

Secrets, credentials, session tokens, and unnecessary sensitive payloads are excluded.

## 16. Idempotency and concurrency

Authorization decisions for commands must participate in the command's transaction and idempotency contract where required.

Authorization data itself must not become a second business transaction ledger.

Concurrent high-risk operations must revalidate authorization-sensitive state when policy requires fresh state.

## 17. Canonical authorization capabilities

The authorization surface includes:

- `CAP.ACCESS.CHECK_PERMISSION`
- `CAP.ACCESS.CHECK_POLICY`
- `CAP.ACCESS.CHECK_ENTITLEMENT`
- `CAP.ACCESS.RESOLVE_ROLES`
- `CAP.ACCESS.RESOLVE_PERMISSIONS`

Module-specific domain capabilities remain owned by their respective modules.

## 18. Event vocabulary

Authorization may emit or consume events such as:

- `access.permission.assigned`
- `access.permission.revoked`
- `access.role.assigned`
- `access.role.revoked`
- `access.policy.changed`
- `access.decision.denied`
- `access.approval.requested`
- `access.approval.approved`
- `access.approval.rejected`
- `access.impersonation.started`
- `access.impersonation.ended`
- `access.service_identity.disabled`

Events are immutable facts. Consumers must not infer authorization truth from stale projections when a fresh decision is required.

## 19. Invariants

1. Default deny.
2. Server-side authorization is authoritative.
3. Tenant/workspace scope is enforced before protected data is returned or mutated.
4. A resource ID alone never grants access.
5. Frontend permission checks are UX only.
6. AI cannot grant itself permission.
7. AI tool execution uses the same authorization model as other callers.
8. Domain modules do not create parallel authorization engines.
9. Role names are never a substitute for permissions/policies.
10. Service identities have explicit authority.
11. High-risk approvals are auditable.
12. Separation of duties is enforceable where required.
13. Sensitive-data access is purpose- and policy-controlled.
14. Authorization failures must not reveal protected resource existence.
15. Permission changes are version/audit aware.
16. Cross-tenant references are forbidden.
17. Entitlement is distinct from Permission.
18. Feature flags are distinct from authorization.
19. Capability ownership remains in the domain module.
20. Projections/caches are never the sole source for high-risk authorization truth.

## 20. Anti-duplication rules

The following are forbidden without an explicit architecture decision:

- `AdminPermission` alongside canonical Permission;
- `AIPermission` alongside canonical Permission;
- `PluginPermission` alongside canonical Permission;
- separate Beauty/Fashion/Medical authorization engines;
- a second RBAC system inside a module;
- a second ABAC/policy evaluator inside a module;
- direct repository access that bypasses authorization capability boundaries;
- using Billing Entitlement as a substitute for Permission;
- using FeatureFlag as a substitute for authorization;
- using AI memory or search projections as authorization truth.

## 21. Cross-module contract

Protected operation flow:

```text
Caller
 ↓
Authentication / Actor Resolution
 ↓
Authorization Request
 ↓
Permission Resolution
 ↓
Tenant + Scope Validation
 ↓
Resource Policy Evaluation
 ↓
Approval / Separation-of-Duties Check (if required)
 ↓
AccessDecision
 ↓
Owning Domain Capability
 ↓
Audit / Event
```

No consumer may skip directly from user input to persistence for a protected mutation.

## 22. Data classification

Authorization metadata may contain security-sensitive information. At minimum classify:

- public permission descriptions;
- internal role configuration;
- confidential policy conditions;
- security-sensitive audit evidence;
- sensitive-data access reasons.

Retention and visibility follow the platform security and audit policies.

## 23. Compatibility rules

- Permission identifiers are stable contract identifiers.
- Policy versions used in decisions remain reconstructable.
- Removing or renaming an active permission requires an explicit migration/compatibility decision.
- Role changes must preserve tenant isolation.
- Capability versions and authorization policy versions are independently traceable.

## 24. Definition of Done

Authorization data modeling is complete when:

- Actor, Role, Permission, Policy, Scope, AccessDecision, Approval, ServiceIdentity, and Impersonation concepts are canonical;
- ownership is explicit;
- relationships and scope are defined;
- policy versioning is defined;
- high-risk approval data is defined;
- audit linkage is defined;
- AI tool authorization uses the same model;
- entitlement remains distinct from permission;
- no module-specific authorization duplicate is introduced;
- canonical capabilities and event vocabulary are defined.

## 25. Final decision

Phoenix has **one centralized authorization data model** shared by every module and consumer.

```text
Identity
+ Membership
+ Role
+ Permission
+ Policy
+ Scope
+ Approval
+ Service Identity
+ Access Decision
+ Audit Link
```

There is no vertical-specific authorization model and no alternate authorization engine for AI, plugins, dashboards, workflows, or integrations.
