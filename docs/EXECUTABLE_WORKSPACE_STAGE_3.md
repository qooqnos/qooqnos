# Phoenix Executable Workspace — Stage 3

## Purpose

Freeze the executable package graph before CI and build verification.

## Canonical workspace packages

- `@qooqnos/core`
- `@qooqnos/database`
- `@qooqnos/i18n`
- `@qooqnos/runtime`
- `@qooqnos/onboarding`

## Dependency direction

`core` is foundational. `database` may depend on `core`. `runtime` may depend on `core` and `database`. `onboarding` may depend on `core`, `database`, and `runtime`. `i18n` remains independent until a concrete contract requires a dependency.

No package may import an implementation from a package that is not declared in its manifest and TypeScript project references.

## Root responsibilities

The root workspace is orchestration only. It owns lifecycle commands and the TypeScript project graph; domain behavior belongs to packages.

## Verification gate

The executable repository is considered Stage 3 complete only when the root graph can perform, in order:

1. dependency installation
2. formatting verification
3. linting
4. TypeScript project-reference typecheck
5. unit tests
6. contract tests
7. package build

## Namespace rule

The canonical package namespace is `@qooqnos/*`. Legacy `@phoenix/*` imports are prohibited in executable source.

## Current status

Package manifests and TypeScript references for the five canonical packages are now represented in the root workspace. The next gate is actual dependency installation and compiler/build verification; passing configuration alone is not treated as proof of build health.

## Non-goals

- no microservices split
- no runtime dependency inversion through path aliases
- no hidden cross-package imports
- no deployment configuration before local executable verification
