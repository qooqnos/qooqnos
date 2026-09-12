# Phoenix AI Skill

## Purpose

Use this skill whenever designing, implementing, reviewing, or modifying Phoenix AI features.

## Required Reading

Before changing AI behavior, read:

1. `CLAUDE.md`
2. `docs/PHOENIX_ARCHITECTURE.md`
3. `docs/MODULE_ARCHITECTURE.md`
4. `docs/CORE_RUNTIME_ARCHITECTURE.md`
5. `docs/AUTHORIZATION_ARCHITECTURE.md`
6. `docs/SECURITY_ARCHITECTURE.md`
7. `docs/AI_ARCHITECTURE.md`

Also read the owning module's manifest and domain documentation.

## Non-Negotiable Rules

- LLMs never access D1, R2, Vectorize, or private repositories directly.
- AI never bypasses authentication, authorization, tenant isolation, or resource policy.
- AI calls go through the shared AI Gateway.
- Provider SDKs are not imported by feature code.
- Every machine-consumed AI response has a schema.
- Every AI tool has a manifest, permission set, side-effect declaration, and risk level.
- Tool execution calls domain application services, never private-table SQL.
- Hard business constraints are deterministic filters; semantic similarity cannot override them.
- Mutable marketplace facts come from authoritative domain sources.
- Prompt/model confidence is never authorization.
- External content is untrusted and may contain prompt injection.
- Never place secrets or unnecessary sensitive data in model context.
- Side effects require the appropriate confirmation and policy.
- Agents are bounded by steps, time, cost, tools, and cancellation.
- Expensive work belongs in idempotent async jobs.
- Production prompts and policies are versioned and evaluated.

## Implementation Workflow

### 1. Define the AI Contract

Document:

- task ID;
- input schema;
- output schema;
- actor/tenant context;
- risk level;
- allowed data classes;
- model policy;
- latency target;
- cost target;
- fallback behavior.

### 2. Define Retrieval

Specify:

- authoritative sources;
- hard filters;
- semantic fields;
- metadata filters;
- tenant/workspace scope;
- freshness/version strategy;
- ranking features;
- abstention behavior.

Never start with embeddings alone.

### 3. Define Tools

For every tool specify:

- stable ID/version;
- input/output schemas;
- required permissions;
- side-effect type;
- confirmation policy;
- risk level;
- allowed actor classes;
- idempotency requirements;
- audit event.

### 4. Implement Through Domain Services

The safe path is:

```text
AI -> policy -> tool executor -> domain service -> repository
```

Never:

```text
AI -> SQL
AI -> ORM table mutation
AI -> external API without policy
```

### 5. Add Safety and Evaluation

Every AI feature must include tests for:

- valid structured output;
- invalid output;
- missing evidence;
- conflicting constraints;
- unauthorized actor;
- cross-tenant retrieval;
- prompt injection;
- stale data;
- tool failure;
- timeout;
- quota exhaustion;
- model failure/fallback.

Regulated or medical workflows require dedicated boundary tests.

## Agent Rules

If implementing an agent:

- define a finite maximum step count;
- define a wall-clock timeout;
- define a token/cost budget;
- explicitly enumerate allowed tools;
- make side effects idempotent;
- require confirmation for high-impact actions;
- stop on policy denial;
- stop when required information is missing;
- preserve traceability of every tool call.

Do not implement an unrestricted `while(true)` autonomous loop.

## Retrieval Rules

Use this order:

1. tenant/resource authorization;
2. deterministic eligibility filters;
3. lexical/structured retrieval where useful;
4. semantic retrieval;
5. ranking/reranking;
6. policy validation;
7. grounded generation.

Vector indexes are acceleration layers, not source-of-truth stores.

## Memory Rules

Separate active conversation context from durable preferences.

Durable memory requires:

- explicit ownership;
- provenance;
- privacy classification;
- retention policy;
- update/deletion path;
- tenant/user scope.

Do not persist sensitive conversational content as a durable preference merely because the model inferred it.

## Medical Rules

Medical AI must remain a marketplace/matching assistant.

Allowed:

- provider/service discovery;
- verified provider matching;
- provider-published information summarization;
- scheduling/contact assistance;
- organization of user-provided information.

Forbidden:

- diagnosis;
- prescription;
- treatment recommendation;
- medication recommendation;
- fabricated clinical claims;
- activation of unverified providers.

If an implementation request crosses this boundary, redesign the workflow around verified provider information and safe marketplace functionality.

## Prompt Engineering Rules

Prompts are versioned production artifacts.

Keep:

- system policy separate from retrieved data;
- tool instructions separate from untrusted content;
- explicit output schemas;
- refusal/abstention behavior;
- grounding requirements;
- locale requirements.

Never rely on prompt wording as the only security boundary.

## Observability

Record for each run, subject to privacy/redaction policy:

- trace/request ID;
- tenant/workspace;
- task and prompt version;
- model/provider;
- retrieval references;
- tool calls;
- policy decisions;
- latency;
- usage/cost;
- outcome/error class.

## Cost Controls

Before adding a model call, identify:

- expected call volume;
- average context size;
- expected output size;
- caching opportunity;
- cheaper model candidate;
- async opportunity;
- tenant quota behavior.

Do not optimize cost by weakening security or grounding.

## Claude Code Acceptance Checklist

Before considering an AI change complete:

- [ ] AI Gateway used.
- [ ] Domain owner identified.
- [ ] Input/output schemas added.
- [ ] Authorization enforced outside model.
- [ ] Tenant isolation verified.
- [ ] Retrieval sources identified.
- [ ] Hard constraints deterministic.
- [ ] Tool manifests complete.
- [ ] Side effects protected.
- [ ] Prompt/policy versioned.
- [ ] Injection tests added.
- [ ] Failure/fallback behavior tested.
- [ ] Cost/latency observable.
- [ ] Sensitive-data handling reviewed.
- [ ] Medical boundary tested when relevant.
- [ ] Documentation updated.

## Commit Discipline

Prefer focused commits such as:

- `feat(ai): add structured intent contract`
- `feat(ai): add secure tool executor`
- `feat(ai): add hybrid retrieval pipeline`
- `test(ai): add prompt injection coverage`
- `docs(ai): update evaluation policy`

Do not combine unrelated UI, database, security, and AI changes in one commit unless the change is genuinely atomic.
