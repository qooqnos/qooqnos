# ADR-001: Modular Monolith on Cloudflare

## Status
Accepted

## Decision
Phoenix will initially use a Modular Monolith deployed on Cloudflare Workers.

## Why
The product spans multiple domains, but the initial system must move quickly with low operational complexity. Strong module boundaries provide maintainability and a future extraction path without distributed-system overhead.

## Future extraction criteria
A module may become an independent service only when measured needs justify it, such as independent scaling, reliability isolation, deployment independence, technology mismatch or team ownership. The change requires a new ADR.
