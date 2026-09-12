# Phoenix Authorization Runtime

The runtime authorization boundary centralizes protected-operation decisions. It does not own authentication, membership persistence, or billing entitlements.

## Pipeline

```text
authenticated actor
  -> tenant/workspace context
  -> active membership
  -> RBAC permission
  -> entitlement gate
  -> ABAC resource policy
  -> domain service
```

## RBAC

Roles are permission bundles. A role cannot reference an unregistered permission. Direct permissions are supported for explicit assignments, while roles remain the canonical bundle mechanism.

Example:

```text
role: partner.operator
  -> business.profile.read
  -> business.profile.update
  -> catalog.offer.create
  -> catalog.offer.publish
```

Authorization does not treat a role name as the final decision; it resolves the role to permissions first.

## ABAC / tenant isolation

The evaluator validates server-resolved context before allowing a protected operation:

- actor must be authenticated for protected operations
- workspace context must exist when the operation is workspace-scoped
- actor workspace must match request workspace
- actor tenant must match request tenant
- membership must be active
- resource tenant/workspace must match the actor context
- resource policy may enforce ownership, assignment, sensitivity, or other attributes

A client-supplied workspace identifier is therefore only a candidate context; the subject must already be resolved against the same workspace.

## Entitlements

Billing remains the owner of entitlements. The runtime accepts an `EntitlementEvaluator` callback and evaluates it after permission resolution and before resource policy execution. Authorization therefore does not duplicate billing state.

## Errors

Denied operations return stable `UNAUTHORIZED` or `FORBIDDEN` application errors through `AuthorizationDeniedError`. The request ID is preserved for correlation without exposing secrets or authentication material.

## Security boundary

Domain services must call the centralized authorization boundary before protected mutations. UI visibility, module origin, or internal service-to-service calls are not authorization grants.

AI and background jobs must provide an explicit actor/security context and cannot manufacture roles, workspace membership, or permissions.
