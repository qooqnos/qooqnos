# Phoenix Core Runtime Architecture

**Status:** Architecture baseline
**Scope:** Phoenix OS / Phoenix AI Marketplace

## 1. Purpose

Phoenix Core Runtime is the execution layer that turns module contracts into a running platform. It discovers modules, validates manifests, resolves dependencies, registers capabilities, applies lifecycle rules, and exposes safe extension points to API, UI, jobs, events, and AI.

The runtime must remain small, deterministic, observable, and independent of industry-specific business logic.

## 2. Runtime Model

```text
                    Phoenix Core Runtime
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   Module Registry    Dependency Graph    Lifecycle Manager
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
             ┌──────────────┼──────────────┐
             │              │              │
        Route Registry  Event Registry  Job Registry
             │              │              │
        UI Extension   AI Tool Registry  Migration Registry
             │              │              │
             └──────────────┼──────────────┘
                            │
                  Tenant Module State
                            │
                     Policy / AuthZ
                            │
                       Domain APIs
```

## 3. Design Principles

1. Core owns infrastructure, not industry behavior.
2. Registration is explicit; discovery never executes arbitrary code.
3. Runtime state is deterministic and auditable.
4. Authorization is enforced independently of module registration.
5. Tenant enablement is evaluated on every capability that requires it.
6. Module failures should fail closed for sensitive actions.
7. Async work is isolated from request-critical paths.
8. Runtime metadata must not become a second domain database.
9. Every extension point has a typed contract.
10. The first implementation is modular-monolith friendly and can evolve later.

## 4. Runtime Components

### 4.1 Module Registry

Stores and exposes:

- module identity;
- installed versions;
- API compatibility;
- lifecycle state;
- dependencies;
- capabilities;
- migration status;
- health state.

The registry has no authority to modify domain records owned by modules.

### 4.2 Manifest Validator

Validates the module manifest against a strict runtime schema before registration.

Validation includes:

- ID format;
- semantic version;
- API version;
- dependency declarations;
- permission names;
- route schemas;
- event schemas;
- settings schemas;
- AI tool schemas;
- unsupported or unknown fields according to compatibility policy.

Invalid manifests never enter the active registry.

### 4.3 Dependency Resolver

Builds a directed dependency graph and rejects:

- cycles;
- missing required modules;
- incompatible versions;
- invalid dependency states.

Resolution should produce a deterministic topological order.

### 4.4 Lifecycle Manager

Responsible for transitions:

```text
installed → validated → migrated → registered → enabled → ready
                                             ↓
                                      disabled/suspended
```

Lifecycle transitions are state-machine operations, not arbitrary database updates.

### 4.5 Registration Bus

The registration bus collects module declarations into typed registries:

```text
Routes
Events
Jobs
Commands
UI extensions
AI tools
Permissions
Settings
Policies
```

Registration must be idempotent.

## 5. Startup Sequence

A Worker deployment should conceptually perform:

```text
Boot
 ↓
Load Core configuration
 ↓
Load module manifests
 ↓
Validate manifests
 ↓
Resolve dependency graph
 ↓
Load registry state
 ↓
Verify migration compatibility
 ↓
Register permissions/policies
 ↓
Register routes/events/jobs/tools/UI metadata
 ↓
Run health checks
 ↓
Serve requests
```

Runtime startup must not perform expensive domain-wide scans.

## 6. Request Execution

Every module route follows the shared pipeline:

```text
Request
 ↓
Request ID / tracing
 ↓
Edge controls
 ↓
Authentication
 ↓
Tenant/workspace context
 ↓
Module enabled check
 ↓
Permission / policy evaluation
 ↓
Schema validation
 ↓
Module application service
 ↓
Repository / external adapter
 ↓
Audit + telemetry
 ↓
Response
```

The route layer must not contain domain business rules.

## 7. Capability Resolution

A capability is available only when all required conditions are true:

```text
Installed
AND compatible
AND enabled for tenant
AND feature flag allows behavior
AND actor authorized
AND resource policy allows operation
```

A UI button may be hidden for UX, but server-side capability resolution remains authoritative.

## 8. Tenant Module State

The runtime must support global installation with per-tenant activation.

```text
module: booking

platform: installed

Tenant A: enabled
Tenant B: disabled
Tenant C: suspended
```

Workspace-level overrides may be supported when required, but must not weaken tenant-level restrictions.

## 9. Permission Registration

Modules register namespaced permissions at installation/registration time.

Example:

```text
booking.read
booking.create
booking.update
booking.cancel
booking.manage
```

The central permission registry remains the authority. Duplicate or conflicting definitions are rejected.

## 10. Route Registry

Routes are registered as metadata plus typed handlers.

Conceptual contract:

```ts
interface ModuleRoute {
  method: HttpMethod;
  path: string;
  handler: Handler;
  permissions?: string[];
  rateLimit?: string;
  idempotency?: boolean;
  auditAction?: string;
}
```

Routes must not be registered dynamically from untrusted tenant data.

## 11. Event Registry

The event registry records event names, versions, schemas, publishers, and consumers.

```ts
interface ModuleEvent {
  name: string;
  version: number;
  schema: JsonSchema;
  delivery: "sync" | "async";
}
```

Production domain events should normally be asynchronous and backed by an outbox.

## 12. Job Registry

Jobs are declared with:

- job ID;
- input schema;
- retry policy;
- timeout;
- idempotency strategy;
- required service permissions;
- observability metadata.

Jobs execute under service identities with least privilege.

## 13. AI Tool Registry

AI tools are runtime capabilities with explicit policy metadata.

```ts
interface AIToolDefinition {
  id: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  permissions: string[];
  sideEffect: "none" | "read" | "write" | "high-risk";
  confirmation: "never" | "required";
}
```

The registry must reject tools without authorization metadata.

No AI tool receives direct database credentials.

## 14. UI Extension Registry

UI modules register into stable slots rather than changing arbitrary application structure.

Examples:

```text
dashboard.summary
business.profile.tabs
business.profile.actions
customer.home.sections
admin.settings.sections
```

The registry returns only extensions the current client is eligible to render. Eligibility is not authorization; APIs still enforce authorization.

## 15. Migration Registry

Each module declares migration versions.

Runtime responsibilities:

- detect pending migrations;
- verify compatibility;
- record migration state;
- prevent incompatible activation;
- expose migration health.

Production migration execution should be explicit and controlled rather than hidden inside ordinary request startup.

## 16. Configuration and Settings

The runtime resolves configuration from:

```text
environment
→ platform settings
→ tenant settings
→ workspace settings
→ request context
```

Higher scopes may override lower scopes only where the setting contract explicitly permits it.

Secrets are resolved through secure secret management, never from client-provided settings.

## 17. Feature Flags

Runtime feature resolution should be centralized.

```text
module enabled?
       ↓
feature flag enabled?
       ↓
policy allows?
       ↓
execute capability
```

Flags must be evaluated consistently across API and UI metadata.

## 18. Health Model

Each module may expose health checks for:

- required configuration;
- dependency readiness;
- migration compatibility;
- external provider connectivity where appropriate;
- queue/workflow dependencies.

Health states:

```text
healthy
warning
degraded
blocked
failed
```

A health failure must not leak sensitive configuration or secrets.

## 19. Failure Isolation

A non-critical module should not prevent Core from serving unrelated capabilities.

Example:

```text
PDF module failed
      ↓
Booking remains available
      ↓
PDF generation returns controlled capability-unavailable error
```

However, if a required dependency fails, dependent modules must fail closed rather than operating with undefined behavior.

## 20. Caching

Runtime metadata may be cached when safe.

Cache keys must include the relevant scope and version information.

Never cache an authorization decision without considering:

- actor;
- tenant;
- workspace/branch;
- resource scope;
- module state;
- permission version/policy version.

Use short TTLs and explicit invalidation for sensitive authorization metadata.

## 21. Concurrency and Idempotency

Runtime operations such as module activation, migration registration, event publication, and job scheduling must be safe under retries and concurrent execution.

Use unique constraints, state transitions, idempotency keys, and transactional boundaries instead of in-memory assumptions.

## 22. Observability

Every runtime operation should emit structured telemetry with:

```text
request_id
trace_id
module_id
module_version
operation
actor_id
tenant_id
workspace_id
status
latency_ms
error_code
```

Do not log raw medical, credential, payment, secret, or other restricted content unless an explicit audited requirement exists.

## 23. Runtime Security

The runtime is a high-trust component.

Required controls:

- strict manifest validation;
- deny-by-default capability registration;
- centralized authorization;
- tenant isolation;
- secure secret handling;
- no arbitrary code execution from tenant configuration;
- no dynamic SQL generated from module metadata;
- audit logging of lifecycle changes;
- protected admin operations;
- rate limiting on expensive capability paths.

## 24. Admin Operations

Module lifecycle operations should be explicit administrative actions:

```text
install
activate
disable
suspend
upgrade
migrate
rollback/repair
```

High-risk actions should require elevated permission and, where policy requires, approval/separation of duties.

Every lifecycle mutation is auditable.

## 25. Upgrade Strategy

A safe upgrade follows:

```text
validate new manifest
 ↓
check compatibility
 ↓
backup/recovery readiness
 ↓
apply forward-compatible migration
 ↓
register new contract
 ↓
health check
 ↓
enable new behavior behind flag
 ↓
observe
 ↓
complete rollout
```

Avoid changing database schema and application semantics in one irreversible step when a staged migration is possible.

## 26. Rollback Strategy

Rollback means restoring service compatibility, not blindly reversing database changes.

Preferred strategy:

1. disable new feature;
2. restore previous compatible application behavior;
3. retain backward-compatible schema;
4. repair data through an explicit migration if necessary.

Destructive database rollback must never be automatic.

## 27. Runtime API Surface

The internal runtime should expose a small set of contracts such as:

```ts
ModuleRegistry
DependencyResolver
LifecycleManager
PermissionRegistry
RouteRegistry
EventRegistry
JobRegistry
AIToolRegistry
UIExtensionRegistry
MigrationRegistry
FeatureFlagResolver
ModuleHealthService
```

These should be interfaces with testable implementations.

## 28. Recommended Package Layout

```text
packages/core/
├── runtime/
│   ├── module-registry.ts
│   ├── dependency-resolver.ts
│   ├── lifecycle-manager.ts
│   ├── capability-resolver.ts
│   └── health.ts
├── registry/
│   ├── permissions.ts
│   ├── routes.ts
│   ├── events.ts
│   ├── jobs.ts
│   ├── ai-tools.ts
│   ├── ui-extensions.ts
│   └── migrations.ts
├── config/
├── errors/
└── telemetry/
```

Names may evolve during implementation, but the responsibilities should remain separated.

## 29. Implementation Order

Build the runtime incrementally:

### Phase A — Contract

1. Manifest schema
2. Registry interfaces
3. Validation
4. Dependency graph

### Phase B — Lifecycle

5. Registry persistence
6. Enable/disable state machine
7. Migration registry
8. Health model

### Phase C — Capability registration

9. Permissions
10. Routes
11. Events
12. Jobs

### Phase D — Experience

13. UI extension registry
14. Feature flags
15. AI tool registry
16. localization metadata

### Phase E — Production hardening

17. Observability
18. concurrency/idempotency
19. security tests
20. upgrade/rollback tests
21. failure isolation tests

## 30. Claude Code Acceptance Rules

Claude Code must not implement module runtime behavior until it has read:

- `CLAUDE.md`
- `docs/PHOENIX_ARCHITECTURE.md`
- `docs/MODULE_ARCHITECTURE.md`
- `docs/AUTHORIZATION_IMPLEMENTATION.md`
- `docs/SECURITY_ARCHITECTURE.md`
- this document.

Every runtime change must answer:

- What contract is being introduced?
- Who owns its data?
- How is it authorized?
- How is it scoped to a tenant/workspace?
- How does it behave under retry?
- How is it observed?
- How is it disabled or upgraded?
- What security tests prove the boundary?

## 31. Definition of Done

Core Runtime is production-ready only when:

- manifests are schema validated;
- dependency cycles are rejected;
- lifecycle state transitions are deterministic;
- tenant module state is enforced;
- permissions are centralized;
- routes are typed and protected;
- events are versioned;
- jobs are retry-safe;
- AI tools are policy-aware;
- UI extensions use typed slots;
- migrations are tracked;
- feature flags are scoped;
- health checks exist;
- lifecycle operations are audited;
- failure isolation is tested;
- upgrade/rollback strategy is documented;
- security and concurrency tests pass.

## 32. Final Decision

Phoenix Core Runtime is the **control plane for modular capabilities**.

It does not contain Beauty, Fashion, Medical, Booking, CRM, PDF, or other industry/domain business logic. It provides the stable execution contracts that let those modules evolve independently while sharing one secure, fast, multilingual platform.
