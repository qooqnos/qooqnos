# ADR-002: AI Cannot Bypass Domain Services

## Status
Accepted

## Decision
LLMs and AI agents may not directly mutate Phoenix's database or bypass domain authorization.

## Required path
1. Schema validation
2. Safety/policy validation
3. Authorization
4. Domain service
5. Persistence

## Rationale
This protects data integrity, tenant isolation, authorization, auditability, safety and future model/provider replacement.
