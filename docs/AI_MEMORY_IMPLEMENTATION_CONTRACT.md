# AI Memory Implementation Contract

**Status:** Implemented  
**Migration:** `0076_ai_memory.sql`  
**Owner:** AI  
**Authority:** AI memory is contextual and non-authoritative.

## Canonical model

`ai_memory` stores tenant/workspace-scoped memory references with owner scope/reference, memory type, content reference, provenance, optional consent reference, privacy classification, version, creation, expiry and deletion timestamps.

Memory never becomes Business, Customer, Booking, Order, Payment or User source of truth.

## Scope

Organization scope is mandatory. Workspace-scoped memory requires a workspace context. Database triggers reject cross-organization workspace references. Repository reads and writes apply organization/workspace boundaries server-side. User-owned memory must match the authenticated actor; workspace-owned memory must match the active workspace.

## Privacy and consent

Sensitive and restricted memory requires an explicit consent reference at creation. Memory is represented by a protected content reference; the AI memory table does not become a generic raw-content store.

## Retention and deletion

Memory supports explicit deletion, expiry timestamps, bounded expiry processing and soft-deletion evidence through `deleted_at`. Expired/deleted memory is excluded from normal reads.

## Provenance

Every memory record stores provenance evidence as a validated string array. Consumers must resolve authoritative domain state through the owning capability when a memory points to domain information.

## Authorization

Canonical permissions are `ai.memory.read` and `ai.memory.manage`. Memory management is server-side and does not grant authorization over referenced domain resources.

## Non-authoritative rule

Embeddings, retrieval indexes and ranking representations may be derived from AI memory later, but remain rebuildable projections and never become the source of truth.
