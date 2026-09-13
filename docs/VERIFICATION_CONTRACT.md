# Phoenix Verification Contract

## Purpose

This document defines the minimum verification contract required before Phoenix can be declared complete for a delivery stage.

## Current repository state

The repository is currently an architecture-first TypeScript skeleton. There is no root package manifest, lockfile, TypeScript project configuration, or GitHub Actions CI workflow in the current baseline. Therefore lint, typecheck, unit-test, and build commands must not be invented or reported as executed.

## Required gates

Every implementation stage must eventually provide all of the following:

1. **Static typing** — TypeScript compilation succeeds for the affected workspace/packages.
2. **Linting** — the configured linter succeeds without suppressing architecture/security errors.
3. **Unit tests** — domain and repository behavior tests pass.
4. **Security tests** — authorization, tenant isolation, ownership/resource policies, and denied paths pass.
5. **Migration verification** — migration ordering, identifiers, checksums, and SQL compatibility are validated.
6. **Build verification** — the production target builds successfully using the repository's actual runtime configuration.
7. **CI verification** — the same gates run automatically on pushes and protected branches.

## Rules for the current skeleton

Until the project toolchain is introduced:

- Do not add a package manager merely to make a CI command possible.
- Do not claim `test`, `lint`, `typecheck`, or `build` has passed without executing the project's configured command.
- Do not create placeholder CI commands that can produce false-green results.
- New domain tests remain executable test fixtures until a real runner is established.
- Cloudflare bindings and deployment configuration must be added together with the application runtime, not fabricated in isolation.

## Recommended next implementation order

1. Establish the workspace/package manager contract.
2. Add TypeScript project references/configuration for the package graph.
3. Add the test runner and executable test entry points.
4. Add lint configuration.
5. Add the Cloudflare Worker/D1 development and deployment configuration.
6. Add GitHub Actions using those real commands.
7. Run the full verification matrix and record the results.

## Definition of Done mapping

| Gate | Current state |
| --- | --- |
| Code | Implemented for Database Foundation, Runtime, Authorization and Onboarding baseline |
| Types | TypeScript source exists; compiler verification pending |
| Tests | Security, lifecycle and atomicity fixtures exist; execution pending |
| Migrations | Foundation and Onboarding migrations exist; runtime catalog/runner exists |
| Authorization | RBAC/ABAC runtime and Onboarding permissions exist |
| Tenant isolation | Repository and authorization guards exist; executable verification pending |
| Documentation | Architecture and implementation documents exist |
| Lint | Tooling not established |
| Typecheck | Tooling not established |
| Build | Application build target not established |
| CI | Workflow not established |

The verification gates are intentionally treated as incomplete until the corresponding project tooling exists and produces an actual result.
