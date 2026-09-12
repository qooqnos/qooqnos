# Phoenix Identity Skill

## Purpose

Implement and review Identity, Authentication, Workspace, Membership, and Team security according to `docs/IDENTITY_AUTH_WORKSPACE_TEAM_ARCHITECTURE.md`.

## Non-Negotiable Rules

- Authentication is not authorization.
- Use one canonical internal user identity; do not create per-module auth systems.
- Workspace/tenant context must be validated server-side.
- Membership, roles, permissions, and billing entitlements are separate concepts.
- Every protected operation passes through centralized authorization plus resource policy.
- UI visibility never substitutes for authorization.
- AI cannot assign roles, switch to unauthorized workspaces, retrieve arbitrary tenant data, or bypass domain authorization.
- Sensitive access and privileged changes are auditable.
- Recovery and invitation flows must not become authorization bypasses.
- Never log secrets, authentication tokens, or unnecessary sensitive payloads.

## Required Workflow

1. Resolve authenticated actor.
2. Resolve and validate workspace context.
3. Validate membership state.
4. Evaluate permission.
5. Evaluate resource-level policy.
6. Evaluate entitlement/feature gate where applicable.
7. Execute domain service.
8. Emit audit/security events for sensitive actions.

## High-Risk Operations

Use step-up authentication/policy where required for security changes, sensitive exports, privileged permission changes, financial administration, restricted document access, and destructive operations.

## Team Rules

Use workspace memberships and scoped roles for Partner and Internal Team experiences. Enforce separation of duties for sensitive approval workflows.

## Completion Criteria

Verify cross-tenant isolation, cross-workspace denial, suspended/removed membership denial, invitation expiry/revocation, session revocation, recovery replay prevention, privileged auditability, and AI-tool authorization before declaring identity work complete.
