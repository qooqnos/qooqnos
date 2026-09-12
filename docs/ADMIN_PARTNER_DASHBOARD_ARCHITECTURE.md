# Phoenix Admin & Partner Dashboard Architecture

**Status:** Architecture Baseline  
**Scope:** Admin, business/partner, verification, moderation, operations, module administration, and dashboard composition  
**Architecture:** Modular Monolith

## 1. Purpose

Phoenix has different operational actors and must not collapse them into one generic dashboard.

Primary surfaces:

- Platform Admin
- Verification/Compliance Team
- Moderation/Quality Team
- Internal Operations/Support
- Business/Partner
- Future specialized workgroups

The same user may hold multiple roles, but every action is evaluated by permission, scope, tenant/workspace, resource policy, and separation-of-duties rules.

## 2. Dashboard Principles

Dashboards are composition layers over authoritative modules.

They must not become a second database or business-logic layer.

Rules:

- read models may compose data from multiple modules;
- commands route to the owning module;
- private module tables are never queried directly by dashboard code;
- sensitive operations require explicit permissions;
- auditability is mandatory for privileged actions.

## 3. Actor Model

### Platform Admin

Can manage platform-level configuration, modules, policies, system operations, and approved administrative actions.

### Verification Team

Reviews identity/business/professional verification evidence according to policy.

Approval authority must be separated from ordinary business editing.

### Moderation/Quality

Handles content quality, abuse reports, regulated claims, suspicious listings, and marketplace integrity.

### Internal Operations

Handles customer/business support, operational workflows, escalations, and communication assistance without gaining unnecessary access to sensitive data.

### Business/Partner

Manages its own business profile, catalog, portfolio, availability, bookings, communications, CRM views, analytics, and team permissions within its tenant/workspace scope.

## 4. Tenant and Workspace Boundary

Business/Partner dashboards are tenant-scoped.

Every request resolves:

`User → Tenant → Workspace → Role/Group → Permission → Resource Policy`

No client-provided tenant identifier may override server-resolved authorization context.

Platform staff may operate across tenants only with explicit platform permissions and audited scope.

## 5. Business Dashboard

Primary sections:

- Overview
- Business Profile
- Verification
- Services/Products
- Portfolio/Media
- Availability
- Bookings
- Customers/CRM
- Communications
- Reviews
- Analytics
- Team & Permissions
- Settings

### Overview

Show actionable operational metrics rather than vanity metrics:

- pending verification items
- upcoming bookings
- unread customer communications
- catalog items needing attention
- availability gaps
- quality/review signals
- relevant growth metrics

## 6. Partner Onboarding

Dashboard onboarding state follows the Business Onboarding state machine.

The UI must clearly distinguish:

- incomplete profile
- submitted for verification
- under review
- changes requested
- verified
- rejected/suspended

Verification documents are never displayed to unauthorized users.

## 7. Catalog Management

Business users can manage services/products according to their permissions.

Actions:

- create draft
- edit
- submit for review where required
- publish when authorized
- suspend/archive where permitted

The dashboard does not bypass Catalog publication rules.

## 8. Availability and Booking Operations

Business users may:

- configure schedules
- manage permitted exceptions
- view availability
- review bookings
- confirm/reschedule/cancel according to Booking policy

Final availability and booking state come from authoritative Booking/Availability services.

## 9. CRM Surface

Business dashboard may expose:

- customer relationships
- timeline
- notes according to role
- tasks/follow-ups
- segments
- permitted engagement metrics

Sensitive/internal notes require narrower permissions than ordinary customer profile access.

CRM is not a medical clinical record.

## 10. Communications Surface

Business users can manage allowed communication channels and templates according to permission and platform policy.

Sending must pass Communications authorization, consent, policy, idempotency, and rate limits.

The dashboard must show delivery state rather than falsely claiming successful delivery.

## 11. Admin Dashboard

Platform admin surface should include:

- system health
- tenant/business overview
- verification queues
- moderation queues
- module lifecycle
- feature flags
- policies
- audit logs
- jobs/queues
- provider status
- security events
- operational metrics

Sensitive controls should use explicit confirmation and, where appropriate, two-person approval.

## 12. Verification Console

Verification queue should support:

- priority
- status
- submitted time
- verification type
- jurisdiction/country policy
- assigned reviewer
- escalation

Reviewer workflow:

`Unassigned → Assigned → In Review → More Info Requested / Approved / Rejected → Closed`

Review decisions must record policy version, actor, timestamp, reason, and relevant evidence references.

## 13. Moderation Console

Moderation can cover:

- reported content
- misleading claims
- spam
- abuse
- suspicious catalog activity
- regulated advertising claims
- marketplace manipulation

Moderation decisions must be reversible where technically possible and fully audited.

Medical/provider claims require stronger policy review before publication.

## 14. Module Administration

Platform admins can inspect module registry state:

- installed version
- compatibility
- dependencies
- tenant enablement
- feature flags
- migration state
- health

Dangerous lifecycle operations should require elevated permission and explicit confirmation.

No dashboard control may bypass Module Runtime lifecycle validation.

## 15. Permissions

Use centralized permission identifiers, for example:

```text
admin.system.read
admin.system.manage
verification.case.read
verification.case.review
verification.case.approve
moderation.case.read
moderation.case.decide
business.profile.update
catalog.offer.update
booking.manage
crm.note.read
crm.note.write
communications.send
analytics.read
team.permissions.manage
```

Permissions are not equivalent to roles. Roles/groups are bundles of permissions with scope.

## 16. Separation of Duties

High-risk actions may require different actors.

Examples:

- reviewer cannot approve their own submitted verification;
- user who changes sensitive policy cannot necessarily activate it;
- support staff cannot grant themselves elevated permissions;
- business team members cannot approve platform verification of their own evidence.

## 17. Approval Workflows

Use explicit approval records for privileged workflows.

Approval record should include:

- action
- resource
- requested_by
- reviewer/approver
- policy version
- status
- reason
- timestamps
- audit reference

## 18. Audit and Activity

Privileged actions must produce structured audit events.

Examples:

- permission changed
- verification approved/rejected
- business suspended
- offer unpublished
- moderation decision
- module enabled
- feature flag changed
- policy changed

Audit logs must be append-oriented and protected from ordinary mutation.

## 19. Dashboard Read Models

Dashboard pages should prefer dedicated projections/read models for expensive aggregations.

Examples:

- `admin_operations_summary`
- `verification_queue_projection`
- `moderation_queue_projection`
- `business_dashboard_summary`
- `partner_booking_summary`
- `partner_customer_summary`

Read models may denormalize data for speed but must identify their source events/version and never become authoritative domain state.

## 20. Search and Filtering

Admin/partner search must enforce authorization before returning results.

Filters may include:

- status
- verification state
- category
- location
- time range
- assigned workgroup
- risk/quality state

Do not reveal the existence of unauthorized resources through counts, autocomplete, or error messages.

## 21. Sensitive Data

Dashboards should use least-data presentation.

Examples:

- show only required verification metadata unless evidence access is authorized;
- mask sensitive contact data when full value is unnecessary;
- minimize medical information;
- never expose provider credentials/secrets;
- prevent sensitive values from entering analytics without classification controls.

## 22. AI in Dashboards

AI may:

- summarize queues;
- prioritize review candidates using approved signals;
- suggest missing onboarding data;
- draft support responses;
- summarize customer interactions;
- identify anomalies for human review.

AI may not:

- approve verification autonomously where policy requires human approval;
- grant permissions;
- bypass moderation policy;
- change billing/security settings without authorized commands;
- expose unauthorized data;
- directly write private module tables.

AI recommendations must be distinguishable from completed actions.

## 23. Notifications and Tasks

Dashboard work queues integrate with Communications and CRM.

Examples:

- verification task assigned
- customer follow-up due
- moderation case escalated
- booking requiring business action

Notifications do not replace durable tasks/cases.

## 24. Analytics

Business analytics should separate:

- operational metrics
- marketplace performance
- customer engagement
- financial metrics when Billing exists

Metrics must respect tenant isolation and permission scope.

Platform analytics may aggregate across tenants only under authorized platform policies.

## 25. Internationalization

Admin and partner dashboards support:

- multilingual UI
- RTL/LTR
- timezone-aware dates
- Jalali/Gregorian presentation
- localized currency and numbers

Canonical values remain locale-neutral in storage.

## 26. API/BFF

Dashboard BFF endpoints may compose authorized read models:

```text
GET /api/v1/admin/overview
GET /api/v1/admin/verification/queue
GET /api/v1/admin/moderation/queue
GET /api/v1/admin/modules
GET /api/v1/partner/overview
GET /api/v1/partner/bookings
GET /api/v1/partner/customers
```

Commands remain module-owned.

## 27. Performance

Initial targets:

- dashboard overview p95 < 500 ms from warm read models;
- queue/filter operations p95 < 500 ms for normal workloads;
- expensive analytics are asynchronous;
- permission checks should be cheap and cacheable only with correct invalidation.

## 28. Failure Handling

If a projection is stale, show freshness metadata where meaningful.

Never convert stale data into authoritative action confirmation.

For critical commands, re-read authoritative state before execution.

## 29. Testing

Required tests:

- tenant isolation
- object-level authorization
- permission inheritance
- workgroup scope
- separation of duties
- approval workflow
- audit events
- unauthorized-resource enumeration prevention
- sensitive-data masking
- AI recommendation boundaries
- stale read models
- command revalidation
- localization/RTL/Jalali
- responsive/accessibility behavior

## 30. Implementation Order

1. shared dashboard shell/design system
2. permission-aware navigation
3. partner overview
4. business profile/catalog
5. booking/availability operations
6. CRM/communications surfaces
7. verification console
8. moderation console
9. admin overview/operations
10. module/feature administration
11. analytics
12. audit and security operations
13. AI-assisted operations

## 31. Definition of Done

Dashboard architecture is ready when:

- each actor sees only authorized capabilities;
- tenant isolation is enforced server-side;
- dashboards compose read models rather than own domain state;
- privileged actions use explicit permissions and audit records;
- verification/moderation support separation of duties;
- AI remains advisory where human approval is required;
- sensitive data is minimized;
- stale read models cannot masquerade as authoritative state;
- multilingual/RTL/Jalali support is built in.
