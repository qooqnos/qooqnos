# Arvan Cloud AI & Hosting Integration

Status: implementation phase 1 — Arvan AIaaS provider integration.

## 1. Current architecture

Phoenix keeps one canonical AI Runtime. Provider-specific code lives behind an adapter:

```text
Phoenix feature
  -> AI Runtime
  -> Governance / Billing / Safety
  -> Provider Adapter
  -> Arvan AIaaS
```

The Arvan adapter does not own authorization, billing, routing policy, domain mutations, or durable AI state.

## 2. Arvan AIaaS

Provider id:

```text
arvan-aiaas
```

Runtime configuration:

```text
AI_PROVIDER_ID=arvan-aiaas
AI_SELLER_EXTRACT_MODEL_ID=<model-id>
AI_SELLER_EXTRACT_MODEL_VERSION=1
ARVAN_AI_ENDPOINT=<endpoint>
ARVAN_AI_API_KEY=<secret>
ARVAN_AI_MAX_TOKENS=3000
ARVAN_AI_TEMPERATURE=0.2
ARVAN_AI_REGION=IR
```

The API key is a secret and must never be committed to Git or stored in a public Wrangler `vars` block.

## 3. API adapter

`packages/runtime/src/arvan-ai-provider.ts` sends OpenAI-compatible chat-completion requests to:

```text
<endpoint>/chat/completions
```

Authentication:

```text
Authorization: apikey <API_KEY>
```

The adapter normalizes model output, token usage and latency into the canonical Phoenix Runtime response contract.

## 4. Seller AI

The first enabled operation is:

```text
seller.product.extract
```

It remains behind the existing Phoenix seller-product Runtime, including:

- tenant/workspace authorization;
- Billing entitlement;
- output schema validation;
- safety validation;
- durable AI operation and usage records;
- provenance and seller review.

No feature code imports an Arvan SDK directly.

## 5. Production deployment

GitHub Actions accepts:

Repository/Environment variables:

```text
PHOENIX_PROD_AI_PROVIDER_ID
PHOENIX_PROD_ARVAN_AI_ENDPOINT
PHOENIX_PROD_AI_MODEL_ID
PHOENIX_PROD_AI_MODEL_VERSION
```

Repository/Environment secret:

```text
PHOENIX_PROD_ARVAN_AI_API_KEY
```

The workflow renders the production Wrangler configuration and injects the API key with `wrangler secret put`.

The generated configuration never contains the API key.

## 6. RAG / Knowledge Base

Arvan Knowledge Base is a suitable provider-side RAG capability for documents that are intentionally made available to an AI endpoint.

Phoenix source-of-truth data remains authoritative in Phoenix domain services and its canonical data layer. Arvan RAG must not become an implicit source of truth for price, stock, availability, permissions, identity or other mutable business facts.

Recommended initial Knowledge Bases:

```text
Phoenix Global Knowledge
  - product taxonomy
  - glossary
  - AI instructions
  - public platform documentation

Seller/Business Knowledge
  - seller-provided product documentation
  - approved business policies
  - approved support documents
```

Sensitive or tenant-private data must be governed by the Phoenix AI policy before it is made available to an external provider.

## 7. Guardrail

Arvan Guardrail should be enabled for production endpoints and evaluated as an additional provider-side safety layer.

Phoenix remains responsible for its own canonical authorization, classification, safety and domain validation gates.

## 8. Hosting migration

The current Phoenix runtime is Cloudflare Workers + D1 + R2 + Queues + Vectorize. Therefore, moving the entire application to Arvan Cloud Container is a separate portability project, not a configuration-only change.

Arvan Cloud Container can run Git/Docker/manifest based applications, while Arvan Cloud Database provides managed PostgreSQL/MySQL. A full move requires a deliberate replacement/abstraction of the current Cloudflare-specific runtime boundaries rather than recreating the retired PostgreSQL implementation as an ad-hoc parallel system.

The recommended sequence is:

1. Activate Arvan AIaaS behind the existing Phoenix Runtime.
2. Activate Arvan RAG and Guardrail where policy allows.
3. Run production on the current runtime with Arvan AI as provider.
4. Build a portable infrastructure boundary for API, storage, queueing and database.
5. Introduce an Arvan Cloud Container deployment as a separate environment.
6. Reconcile data migration, object storage, background workers and observability.
7. Cut traffic over only after parity and rollback verification.

## 9. Operational rule

Provider changes must be performed through AI Runtime governance. Do not add direct Arvan calls from Product Studio, Discovery, Commerce or UI code.


## 10. Arvan Object Storage

The provided Arvan Object Storage documentation confirms an S3-compatible object-storage workflow using an Access Key, Secret Key and an S3 endpoint. The documented Tehran endpoint is `https://s3.ir-thr-at1.arvanstorage.ir`.

For Phoenix, Object Storage should be treated as a storage provider behind the Media boundary:

```text
Media API
   |
   +--> D1
   |     metadata / ownership / checksum / status / provider
   |
   +--> Object Storage Provider
         +--> Cloudflare R2
         +--> Arvan Object Storage
```

The canonical `media_assets.storage_provider` value therefore needs to evolve from the current R2-only constraint to a provider-neutral enum such as:

```text
r2
arvan-s3
```

Provider credentials remain runtime-only. For Arvan:

```text
ARVAN_OBJECT_STORAGE_ENDPOINT
ARVAN_OBJECT_STORAGE_BUCKET
ARVAN_OBJECT_STORAGE_ACCESS_KEY
ARVAN_OBJECT_STORAGE_SECRET_KEY
ARVAN_OBJECT_STORAGE_REGION
```

The API must never expose Access Key or Secret Key to browser clients.

### Recommended Arvan Object Storage role in Phoenix

Use Arvan Object Storage for:

- product and business images;
- user-uploaded documents;
- generated PDF/export artifacts;
- media derivatives;
- future AI/RAG source files where policy permits.

Keep D1 as the authoritative owner/scope/metadata store. Never use a public object URL as the authorization boundary.

### Migration strategy

Do not replace R2 in-place. Add Arvan as a second provider first:

```text
Phase A: provider abstraction
Phase B: Arvan upload/read/delete adapter
Phase C: dual-provider tests
Phase D: selected media classes on Arvan
Phase E: optional R2 -> Arvan migration
```

This keeps rollback possible and avoids coupling the application to a single storage vendor.
