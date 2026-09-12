# Phoenix Admin & Partner Dashboard Skill

## Mission

Build secure, permission-aware operational dashboards for platform staff and business partners.

## Hard Boundary

Dashboards are composition and operations surfaces, not new domain sources of truth.

Never:

- query another module's private tables directly;
- implement booking/catalog/verification logic in UI code;
- trust client-provided tenant or role claims;
- expose unauthorized resource existence through search/counts.

## Actor Separation

Support distinct capabilities for:

- Platform Admin
- Verification
- Moderation/Quality
- Internal Operations/Support
- Business/Partner

A role is a permission bundle, not an authorization decision by itself.

## Authorization

Resolve:

`User → Tenant → Workspace → Role/Group → Permission → Resource Policy`

Enforce authorization server-side on every command and protected read.

## Partner Rules

Partners can manage only resources inside their authorized tenant/workspace scope.

Typical areas:

- profile
- verification status
- catalog
- availability
- bookings
- CRM
- communications
- reviews
- analytics
- team permissions

## Verification

Verification evidence is sensitive.

Reviewer workflow must preserve:

- assignment
- review state
- policy version
- reason
- approver
- audit trail

A reviewer must not approve their own submitted evidence when separation of duties applies.

## Moderation

Moderation decisions must be policy-controlled and audited.
Medical and regulated claims require stronger review.

## Module Administration

Module lifecycle operations must call Module Runtime contracts.
Never bypass lifecycle validation from dashboard code.

## AI

AI may summarize, prioritize, draft, and suggest.
AI must not autonomously grant permissions, bypass moderation, approve protected verification, or execute privileged actions without the required human/authorization workflow.

## Read Models

Use dashboard-specific projections for expensive aggregation.
A read model may be stale; never present stale data as authoritative command confirmation.

## Sensitive Data

Use least-data presentation and masking.
Never expose secrets or unnecessary medical/verification information.

## Audit

Privileged actions must create structured audit events with actor, resource, action, policy/context, and timestamp.

## Internationalization

Support multilingual UI, RTL/LTR, timezone, Jalali/Gregorian display, currency and number formatting from the beginning.

## Performance

Prefer warm projections for dashboard summaries and queues.
Move expensive analytics to asynchronous jobs.
Keep permission checks fast without unsafe cache scope.

## Testing

Test tenant isolation, object authorization, permission scope, separation of duties, approval workflows, audit events, sensitive-data masking, stale projections, AI boundaries, localization, accessibility, and unauthorized enumeration.

## Definition of Done

A dashboard feature is done only when the owning module remains authoritative, permissions are enforced server-side, privileged actions are audited, sensitive data is minimized, and stale read models cannot cause unsafe decisions.