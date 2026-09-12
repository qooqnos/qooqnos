# Phoenix Module Architecture

**Status:** Architecture baseline
**Scope:** Phoenix AI Marketplace / Phoenix OS
**Decision:** Phoenix is a modular monolith whose capabilities are delivered as versioned, policy-aware modules. Core provides stable platform contracts; modules own domain behavior and data.

## 1. Goals

The module system must allow Phoenix to add capabilities such as beauty, booking, CRM, PDF, printing, Jalali calendar, loyalty, medical verification, and future industries without repeatedly changing the platform core.

A module must be:

- independently understandable and testable;
- explicitly versioned;
- permission-aware;
- tenant-aware;
- migration-aware;
- observable;
- localizable;
- compatible with feature flags and approval workflows;
- safe for AI tool execution;
- removable or disableable without corrupting core data.

The architecture deliberately avoids microservices at this stage. Modules are logical boundaries inside one deployable system and may later become services only when operational evidence justifies it.

## 2. Architectural Layers

```text
Phoenix Core
  ├── Identity / Sessions
  ├── Tenancy / Workspace
  ├── Authorization / Policies
  ├── Database / Repositories
  ├── Audit / Observability
  ├── Storage / Queues
  ├── i18n / Locale
  ├── UI Design System
  └── Module Runtime
          │
          ├── Marketplace Module
          ├── Beauty Module
          ├── Booking Module
          ├── CRM Module
          ├── Loyalty Module
          ├── PDF Module
          ├── Printing Module
          ├── Calendar Module
          ├── Notification Module
          └── Medical Module
```

Core is generic infrastructure. Industry/domain modules must not leak industry-specific assumptions into Core.

## 3. Module Contract

Every module has a manifest. The manifest is the machine-readable contract used by the registry, dependency resolver, authorization system, UI, deployment tooling, and Claude Code.

Conceptual TypeScript contract:

```ts
export interface PhoenixModuleManifest {
  id: string;
  version: string;
  apiVersion: string;
  status: "alpha" | "beta" | "stable" | "deprecated";

  dependencies?: string[];
  optionalDependencies?: string[];

  capabilities?: string[];
  permissions?: string[];
  policies?: string[];

  routes?: ModuleRoute[];
  events?: ModuleEvent[];
  commands?: ModuleCommand[];
  jobs?: ModuleJob[];

  migrations?: string[];
  settings?: ModuleSetting[];
  featureFlags?: string[];

  uiSlots?: ModuleUISlot[];
  dashboardWidgets?: ModuleWidget[];
  aiTools?: ModuleAITool[];

  locales?: string[];
}
```

The actual implementation must use strict schemas and runtime validation rather than trusting manifest JSON.

## 4. Module Identity and Naming

Module IDs are stable machine identifiers using lowercase kebab-case, for example:

- `marketplace`
- `beauty`
- `booking`
- `crm`
- `pdf`
- `printing`
- `calendar`
- `medical-verification`

A module ID must never be reused for a different semantic capability.

A version follows semantic-versioning principles. Breaking contract changes require an API version change or explicit migration strategy.

## 5. Dependency Rules

Dependencies form a directed acyclic graph.

Rules:

1. Circular dependencies are forbidden.
2. Core packages cannot depend on industry modules.
3. A module may depend on Core contracts and declared modules only.
4. Optional dependencies must have a deterministic degraded behavior.
5. Every dependency must declare a compatible version range.
6. Dependency resolution occurs before module activation.
7. A disabled dependency blocks activation of dependent capabilities unless the dependency is optional.

Example:

```text
Core
 ├── Identity
 ├── Authorization
 ├── Marketplace
 │     └── Beauty
 └── Booking
       ├── Identity
       └── Business
```

## 6. Module Boundaries and Data Ownership

Each module owns its domain tables and domain rules.

A module must not directly manipulate another module's private tables. Cross-module interaction uses one of:

- public domain service interfaces;
- commands;
- versioned events;
- shared Core contracts.

Example:

```text
Booking -> BusinessService interface
Booking -> Customer interface
Booking -> Notification command
Booking -> audit event
```

Not allowed:

```text
Booking -> direct SQL UPDATE on CRM private table
```

Repositories remain tenant-safe and authorization-aware.

## 7. Module Lifecycle

Lifecycle states:

```text
DISCOVERED
   ↓
VALIDATED
   ↓
DEPENDENCIES_RESOLVED
   ↓
MIGRATED
   ↓
REGISTERED
   ↓
ENABLED
   ↓
READY
   ↓
DEPRECATED / DISABLED
```

Activation sequence:

1. Load manifest.
2. Validate schema and version.
3. Resolve dependencies.
4. Validate permission declarations.
5. Validate migration compatibility.
6. Apply migrations transactionally where possible.
7. Register routes, events, jobs, tools, and UI extensions.
8. Validate required configuration.
9. Run health checks.
10. Mark module ready.

Disabling a module must first stop new writes/actions, drain or cancel its jobs safely, hide capabilities, and preserve data unless an explicit data-retention policy says otherwise.

Physical uninstall and destructive data deletion are separate operations and require explicit approval plus a documented migration/data-export policy.

## 8. Module Registry

The registry is the authoritative runtime catalog of installed modules and their versions.

Recommended tables:

- `modules`
- `module_versions`
- `module_dependencies`
- `tenant_modules`
- `module_settings`
- `module_migrations`

`tenant_modules` determines whether a capability is enabled for a particular tenant/workspace and stores lifecycle state.

Suggested states:

```text
installed
available
enabled
disabled
suspended
deprecated
```

The registry must not be a second source of truth for domain data. It only manages module metadata and activation state.

## 9. Tenant and Workspace Enablement

A module can be globally installed but selectively enabled.

```text
Platform
  └── Module installed
       ├── Tenant A -> enabled
       ├── Tenant B -> disabled
       └── Tenant C -> enabled + restricted
```

Authorization remains mandatory even when a module is enabled.

Feature flags and module state are separate concepts:

- module state answers whether the capability exists for the tenant;
- feature flags answer whether a specific behavior/version is exposed.

## 10. Permissions

Modules declare permissions but do not bypass the central authorization architecture.

Example:

```text
booking.read
booking.create
booking.update
booking.cancel
booking.manage
```

Permission registration must be deterministic and namespaced by module ID.

Sensitive actions can require additional policy conditions such as ownership, workspace scope, approval, or verified status.

## 11. Routes and API Contracts

A module can declare routes under the global API namespace:

```text
/api/v1/booking/appointments
/api/v1/booking/slots
/api/v1/beauty/services
```

Routes are adapters only. Business rules live in module domain services.

Every route must use:

- request ID;
- authentication where required;
- tenant/workspace context;
- permission checks;
- schema validation;
- rate limiting where appropriate;
- consistent error envelopes;
- audit events for sensitive operations.

## 12. Events

Modules communicate asynchronously using versioned domain events.

Examples:

```text
business.created.v1
business.verified.v1
service.published.v1
booking.created.v1
booking.cancelled.v1
subscription.changed.v1
```

Events should use an outbox pattern so database state and event publication cannot silently diverge.

Consumers must be idempotent. Event handlers must tolerate retries and duplicate delivery.

An event is a contract, not an internal implementation detail. Breaking event changes require a new version.

## 13. Commands and Workflows

Commands represent intentional actions:

```text
CreateAppointment
VerifyBusiness
GeneratePDF
SendNotification
RunMatching
```

Long-running processes use queues/workflows rather than blocking an HTTP request.

Example:

```text
Booking created
  → persist transaction
  → outbox event
  → notification job
  → reminder workflow
  → analytics event
```

## 14. Database and Migrations

Each module owns its migrations.

Migration requirements:

- deterministic ordering;
- forward-compatible changes;
- no destructive migration without explicit review;
- rollback strategy where technically possible;
- production-safe backfills;
- indexes justified by query patterns;
- tenant isolation enforced at repository/query level;
- migration tests in CI.

A module must never silently modify Core tables outside an approved Core migration contract.

## 15. Settings

Settings are strongly typed and classified by scope:

```text
platform
tenant
workspace
user
```

Sensitive settings are never stored as plaintext configuration when a secret-management mechanism is appropriate.

Settings must declare:

- key;
- type;
- default;
- validation schema;
- allowed scope;
- sensitivity;
- localization behavior if applicable.

## 16. UI Extension System

Modules extend the UI through predefined extension points rather than arbitrary DOM injection.

Examples:

```text
dashboard.summary
business.profile.tabs
business.profile.actions
customer.home.sections
booking.detail.actions
admin.settings.sections
```

Every module UI component uses the shared Phoenix Design System.

Modules may provide dashboard widgets with:

- permission requirements;
- module-state requirements;
- data loading contract;
- responsive behavior;
- loading/empty/error states;
- localization metadata.

The frontend must not treat UI visibility as authorization. Server-side authorization remains authoritative.

## 17. AI Tool Contract

A module may expose AI tools, but the LLM never receives direct database access.

Required execution chain:

```text
LLM intent
  ↓
Tool schema validation
  ↓
User / tenant context
  ↓
Permission check
  ↓
Resource policy
  ↓
Module domain service
  ↓
Repository
  ↓
D1 / R2 / Vectorize
```

Every AI tool manifest must declare:

- tool ID;
- input schema;
- output schema;
- required permissions;
- data classification;
- side-effect level;
- confirmation requirement;
- rate/cost policy.

AI output is untrusted input. Prompt instructions must never override authorization or domain policy.

## 18. Industry and Country Rules

Industry behavior and country/legal rules are separate from Core.

For example:

```text
Beauty Module
 ├── Global domain model
 ├── Country policy adapters
 └── Tenant configuration

Medical Module
 ├── Verification domain
 ├── Consent rules
 ├── Advertising policy
 └── Country-specific compliance adapters
```

This allows Phoenix to expand internationally without rewriting the marketplace engine.

Medical-specific restrictions remain explicit: Phoenix AI must not diagnose, prescribe, or recommend treatment/medication. Medical providers require verification before activation where applicable.

## 19. Localization

Modules must declare supported locales and translation namespaces.

Locale handling includes:

- language;
- text direction;
- timezone;
- currency;
- number format;
- calendar adapter.

The canonical database representation remains locale-neutral. Jalali/Persian calendar behavior belongs to the calendar/presentation layer, not to the relational source-of-truth date model.

## 20. Feature Flags

Feature flags must be scoped and auditable.

Supported scopes may include:

- platform;
- environment;
- tenant;
- workspace;
- user cohort.

Flags must have an owner, purpose, default state, and retirement plan. Permanent flag accumulation is forbidden.

## 21. Approval Workflows

Some modules require human approval before state changes.

Examples:

- medical professional verification;
- regulated advertising claims;
- sensitive exports;
- high-risk AI actions;
- destructive configuration changes.

Approval is a policy layer, not a UI-only workflow.

Separation of duties must prevent a user from approving their own restricted action when policy forbids it.

## 22. Observability

Every module emits structured telemetry using common fields:

```text
request_id
trace_id
module_id
module_version
tenant_id
workspace_id
actor_id
operation
status
latency_ms
error_code
```

Sensitive data must not be placed into logs by default.

Module health should expose dependency/configuration failures without leaking secrets.

## 23. Testing Contract

Every module must provide:

### Unit tests
Domain rules, validators, policies, ranking logic, parsers.

### Integration tests
Repository behavior, migrations, event publication, queue jobs.

### Authorization tests
Wrong tenant, workspace, role, ownership, suspended actor, disabled module, missing approval.

### API tests
Validation, pagination, idempotency, error envelopes.

### E2E tests
Critical user journeys.

### Security tests
IDOR, privilege escalation, injection, upload abuse, AI tool abuse where relevant.

A module cannot be marked `stable` without passing its required test suite.

## 24. Module Versioning and Compatibility

Use three compatibility layers:

1. module version;
2. module API version;
3. event contract version.

Backward-compatible additions should not force synchronized deployment of dependent modules.

Deprecated APIs require a documented migration path and removal date.

## 25. Example: Beauty Module

The Beauty module owns beauty-specific concepts such as:

- beauty business profile extensions;
- beauty service categories;
- portfolio relationships;
- beauty-specific discovery signals;
- promotional rules.

It depends on Core, Marketplace, Business, Media, and potentially Booking.

It must not duplicate identity, tenant, authorization, media storage, or notification infrastructure already provided by Core/modules.

## 26. Example: Booking Module

Booking owns:

- availability rules;
- slots;
- appointments;
- booking lifecycle;
- cancellation rules;
- booking-specific reminders.

It consumes business/service/customer contracts and emits booking events.

It should not own customer identity or send email/SMS directly when the Notification module provides the common delivery abstraction.

## 27. Module Security Rules

A module must:

- declare every permission it needs;
- use centralized authorization;
- enforce tenant scope server-side;
- validate all external input;
- avoid direct cross-module table access;
- classify sensitive data;
- redact secrets from logs;
- use idempotency for retryable side effects;
- protect expensive AI operations with quotas/rate limits;
- require explicit confirmation for high-risk side effects.

## 28. Claude Code Implementation Rules

When implementing a module, Claude Code must:

1. Read `CLAUDE.md`.
2. Read this document and relevant architecture/security/authorization docs.
3. Inspect existing module contracts before creating new abstractions.
4. Create or update the manifest first.
5. Resolve dependencies before implementation.
6. Never invent duplicate Core infrastructure.
7. Never bypass the authorization layer.
8. Never write SQL against another module's private tables.
9. Add migrations, permissions, events, tests, and documentation as part of the module change.
10. Run lint, typecheck, unit/integration tests, and relevant E2E/security tests.
11. Update ADRs when the change alters architecture.
12. Produce a concise change summary and verification result.

## 29. Implementation Sequence

Recommended build order:

```text
1. Module Runtime + Manifest schema
2. Module Registry
3. Dependency Resolver
4. Tenant Module State
5. Permission Registration
6. Route/Event/Job registration
7. Migration ownership
8. UI extension points
9. Feature flags
10. AI tool registry
11. Module health/observability
12. Beauty module
13. Booking module
14. CRM / Loyalty / Notifications
15. PDF / Printing / Calendar
16. Medical verification
```

The first implementation should be intentionally small. The runtime should prove registration, dependency validation, permissions, enable/disable, and tenant isolation before adding advanced plugin behavior.

## 30. Definition of Done

A module is complete only when:

- manifest is valid;
- dependencies are declared;
- permissions are registered;
- authorization is enforced;
- migrations are tested;
- tenant isolation is verified;
- API contracts are documented;
- events are versioned and idempotent;
- settings are validated;
- feature flags are scoped;
- UI uses Design System extension points;
- AI tools use policy-aware domain services;
- localization is wired;
- observability exists;
- security tests pass;
- documentation is updated;
- rollback/disable behavior is defined.

## 31. Final Architectural Decision

Phoenix modules are **contracts, not folders**.

A folder named `modules/booking` is not sufficient. A real Phoenix module has an explicit contract spanning identity, permissions, data ownership, migrations, APIs, events, jobs, UI, AI tools, settings, localization, observability, security, and lifecycle.

This architecture preserves a fast modular-monolith MVP while creating a clean path toward Phoenix OS: an extensible operating layer for AI-powered business marketplaces across beauty, fashion, medical, and future industries.
