# Phoenix AI Safety & Policy Governance

> Status: Canonical architecture reconciliation contract  
> Scope: AI safety, security classification, policy evaluation, authorization, data handling, tool safety, prompt injection, human review, and Runtime enforcement.  
> Rule: This document reconciles existing authorities; it does not create a second authorization, security, or AI execution system.

## 1. Purpose

Phoenix has multiple legitimate decision authorities. They must remain distinct:

```text
Security Classification
        ↓
AI Processing / Safety Policy
        ↓
Authorization
        ↓
Billing Entitlement
        ↓
AI Runtime Eligibility
        ↓
AI Execution
        ↓
Output Safety / Policy Validation
        ↓
Authorized Domain Capability
```

The ordering is a governance model, not permission for one layer to impersonate another.

## 2. Authority Boundaries

| Concern | Canonical owner | AI role |
|---|---|---|
| Authentication/session identity | Identity/Auth | consume context |
| Permissions / actor authorization | Access/Authorization | request/check; never infer |
| Security classification | Security/Data Governance | consume/enforce |
| AI safety policy | Policy/Security + AI policy contract | evaluate through canonical policy contract |
| Tenant/workspace scope | Platform/Access | mandatory context |
| Entitlement/quota/credits | Billing | request decision |
| AI execution | AI Runtime | canonical |
| Provider/model eligibility | AI Runtime governance | canonical |
| Domain facts/mutations | Domain capability | authoritative |
| Audit evidence | Platform/Audit | emit/consume |

No layer may silently absorb another layer's authority.

## 3. Security Classification vs AI Classification

Security classification describes the sensitivity and handling requirements of information. AI processing classification describes constraints needed to decide whether and how an AI operation may process that information.

The two vocabularies must be mapped rather than independently guessed by features.

Canonical AI processing classes remain:

`public`, `internal`, `confidential`, `personal`, `sensitive`, `regulated`.

Existing platform security classifications remain authoritative for platform security policy. A mapping policy must explicitly determine the effective AI processing class before model/provider routing.

### Rules

1. Features never invent an ad-hoc sensitivity enum.
2. Missing classification must fail closed when the operation requires protected-data handling.
3. A stricter effective class wins when multiple sources classify the same input.
4. Classification is metadata/policy context, not an authorization grant.
5. Classification must be retained in the operation evidence needed to explain provider eligibility, subject to privacy rules.

## 4. Effective Policy Context

Before model execution, Runtime resolves a policy context containing, where applicable:

- tenant/workspace policy;
- actor class;
- operation type/version;
- security classification;
- AI processing classification;
- geographic/residency requirements;
- domain risk class;
- tool/side-effect risk;
- human-review requirement;
- retention/logging constraints;
- allowed provider/model classes;
- output schema requirements.

The resolved policy context is versioned and referenced by the canonical `ai_operation`.

## 5. Authorization Is Not Safety

Authorization answers:

> Is this actor allowed to perform this capability against this resource in this scope?

Safety/policy answers questions such as:

> Is this operation, content, data class, tool action, or output permitted under platform/domain policy?

Both may deny an operation. Neither may impersonate the other.

Examples:

- A user may have permission to edit a product, while an AI-generated compliance claim remains prohibited.
- An AI agent may have permission to call a tool, while a particular high-risk action requires explicit confirmation.
- A tenant may be entitled to use AI, while regulated data may still be ineligible for a selected provider.

## 6. Entitlement Is Not Authorization

Billing entitlement determines whether commercially permitted AI usage exists. It does not grant access to a resource or capability.

Therefore:

```text
Authorization allow + Entitlement deny = deny
Authorization deny + Entitlement allow = deny
Authorization allow + Entitlement allow + Policy deny = deny
```

All required gates must pass.

## 7. Canonical AI Runtime Gates

The shared Runtime must enforce or invoke the following sequence:

1. establish authenticated actor/request context;
2. establish tenant/workspace scope;
3. validate input/schema;
4. evaluate authorization for the requested AI capability;
5. resolve security and AI processing classification;
6. evaluate applicable safety/policy constraints;
7. check Billing entitlement/quota/credit;
8. resolve eligible provider/model candidates;
9. apply residency and data-processing restrictions;
10. resolve prompt/schema versions;
11. execute through the approved provider adapter;
12. normalize and schema-validate output;
13. run post-execution safety/policy validation;
14. return a typed Runtime result;
15. delegate authoritative mutation to the owning domain capability.

Optimization may occur only after hard eligibility gates.

## 8. Hard Gates vs Optimization

### Hard gates

The following cannot be traded for lower cost, lower latency, or higher model quality:

- tenant isolation;
- authorization;
- security classification restrictions;
- data residency restrictions;
- prohibited operation/content policy;
- required human review;
- required output schema;
- minimum safety threshold;
- provider/model approval;
- entitlement/quota;
- domain-specific mandatory constraints.

### Optimization signals

Only after eligibility may Runtime optimize using:

- quality score;
- latency;
- reliability;
- capacity;
- internal provider cost;
- routing priority;
- locale quality.

An optimization score can never resurrect an ineligible candidate.

## 9. Prompt Injection Boundary

User text, seller descriptions, uploaded documents, retrieved pages, external content, memory, and tool results are untrusted data.

They may contain instructions, but they do not gain authority merely by being supplied to a model.

The Runtime/policy layer must preserve the instruction hierarchy:

```text
Platform/system policy
  > Runtime safety constraints
  > Capability contract
  > Authorized tool contract
  > User request
  > Retrieved/external/seller content
```

Untrusted content must never:

- change authorization;
- grant permissions;
- change tenant scope;
- disable safety policy;
- alter Billing decisions;
- change provider/model governance;
- publish authoritative domain facts;
- suppress audit evidence.

## 10. Tool Safety

Every AI Tool invocation must carry:

- actor and tenant context;
- tool/version identity;
- required permission/capability;
- resource scope;
- side-effect class;
- risk level;
- policy decision;
- confirmation requirement;
- idempotency identity where mutation occurs.

A model selecting a tool is not authorization to execute it.

Execution must pass the canonical capability authorization boundary and then delegate to the owning domain capability.

## 11. Side-Effect Classes

Recommended classes:

| Class | Meaning | Default behavior |
|---|---|---|
| `none` | analysis only | execute if policy allows |
| `read` | reads authoritative data | authorization + visibility required |
| `write` | changes Phoenix state | authorization + policy + idempotency |
| `external` | causes external side effect | stronger policy; confirmation where required |
| `high_risk` | material financial, legal, safety, identity, or irreversible impact | explicit high-risk policy and confirmation/re-auth where required |

AI must not infer that a low-risk conversational request authorizes a high-risk side effect.

## 12. Human Review / Confirmation

Policy may require human review or explicit confirmation when:

- an action has material financial impact;
- an action changes identity, permissions, or verification state;
- an action has legal/compliance significance;
- an external communication has material consequences;
- a domain-specific safety threshold is exceeded;
- evidence is conflicting or insufficient;
- AI confidence is low where policy requires review.

Human confirmation must identify the exact operation/draft/version being approved.

Confirmation does not rewrite provenance: AI-generated values remain AI-generated unless the domain explicitly records the human-confirmed fact.

## 13. Output Safety

A model response is never authoritative merely because it is syntactically valid.

Canonical processing:

```text
Provider Output
    ↓
Normalize
    ↓
Schema Validation
    ↓
Safety / Policy Validation
    ↓
Provenance + Confidence
    ↓
Authorization / Domain Preconditions
    ↓
Canonical Domain Capability
```

Schema validity is necessary but not sufficient.

## 14. Material Facts

AI must not silently create authoritative:

- price;
- inventory;
- availability;
- identity;
- permissions/membership;
- credentials/verification;
- legal/compliance claims;
- contractual policy;
- ownership;
- financial state;
- medical diagnosis, prescription, or treatment authority.

Where AI proposes such information, the owning authority must validate/confirm it according to domain policy.

## 15. Seller AI Safety

Seller AI follows the same Runtime safety boundary as Customer AI and Agents.

A seller may provide raw content, but AI cannot turn uncertainty into authoritative marketplace facts.

For product creation:

```text
Raw Seller Input
 → AI extraction/generation
 → schema validation
 → safety/policy validation
 → provenance/confidence
 → seller review where required
 → Catalog capability
 → publication policy
 → Discovery projection
```

Seller confirmation applies to the specific draft version. AI must not silently overwrite seller-confirmed material fields.

## 16. Customer / Matching Safety

AI retrieval, matching, ranking, and recommendation must apply hard eligibility before semantic optimization.

AI may rank eligible candidates, but it cannot use semantic similarity to override:

- authorization;
- visibility;
- availability constraints;
- verification requirements;
- legal/platform restrictions;
- explicit user hard constraints.

A recommendation is not evidence that the recommended provider/product is verified, available, compliant, or contractually suitable unless the corresponding canonical authority says so.

## 17. Regulated and Sensitive Data

For `personal`, `sensitive`, and `regulated` processing:

- provider/model eligibility must be explicit;
- residency requirements must be satisfied;
- logging must be minimized/redacted;
- retention must follow policy;
- human review must follow applicable risk policy;
- fallback must preserve equivalent data-handling guarantees;
- missing governance metadata causes fail-closed behavior where required.

A model/provider that is technically available is not necessarily eligible for protected data.

## 18. Fallback Safety

Fallback is allowed only when the alternate candidate preserves:

- the same operation contract;
- authorization context;
- tenant scope;
- data classification guarantees;
- residency requirements;
- safety policy;
- output contract;
- minimum quality/risk threshold.

A provider outage never authorizes bypassing safety or residency controls.

## 19. Policy Decision Model

The canonical policy decision should be immutable evidence containing at minimum:

- decision ID;
- policy ID/version;
- operation ID;
- decision type;
- allow/deny/constrain/escalate/abstain outcome;
- reason/rule codes;
- actor/tenant scope;
- classification/risk context;
- evaluator version;
- timestamp.

Policy decisions are evidence. They do not become authorization unless produced by the canonical Authorization capability.

## 20. Fail-Closed Rules

Fail closed when required information is absent for:

- tenant scope;
- authorization;
- regulated-data provider eligibility;
- residency;
- high-risk tool authorization;
- mandatory human confirmation;
- required safety policy;
- required output contract.

For low-risk informational operations, policy may define a safe abstention instead of a hard failure.

## 21. Audit and Privacy

Every material decision must be traceable without unnecessarily retaining sensitive content.

Audit correlation should include:

- request ID;
- correlation/trace ID;
- operation ID;
- attempt ID;
- actor/tenant/workspace;
- capability/tool;
- policy version;
- authorization decision reference;
- classification;
- model/provider references;
- outcome/error code.

Raw prompts, outputs, documents, and personal data must be logged only when permitted by retention/privacy policy.

## 22. Emergency Controls

Central policy administration must be able to:

- disable an operation class;
- block a provider/model;
- restrict a data class;
- require human review;
- tighten a safety threshold;
- disable a high-risk tool;
- force safe abstention/fallback.

Emergency controls are authenticated, authorized, versioned, and audited.

Features must not contain emergency safety bypass switches.

## 23. Anti-Duplication Matrix

| Concern | Canonical authority | Forbidden duplicate |
|---|---|---|
| Authentication | Identity/Auth | AI-generated identity |
| Permission | Access | feature-local permission check |
| Security classification | Security/Data Governance | feature-local classification enum |
| AI safety policy | Policy/Security + canonical AI policy contract | per-feature safety engine |
| AI execution | AI Runtime | feature AI runner |
| Provider eligibility | AI Runtime Governance | feature provider allowlist |
| Entitlement | Billing | AI quota calculator |
| Domain mutation | Domain capability | model callback/direct repository |
| Audit | Platform/Audit | feature-only audit trail as authority |
| Human confirmation | Canonical policy/capability contract | UI-only confirmation flag |

## 24. Canonical References

This reconciliation must remain consistent with:

- `docs/SECURITY_ARCHITECTURE.md`;
- `docs/AI_ARCHITECTURE.md`;
- `docs/AI_DATA_DICTIONARY.md`;
- `docs/AI_RUNTIME_ARCHITECTURE.md`;
- `docs/AI_RUNTIME_DATA_DICTIONARY.md`;
- `docs/AI_OPERATION_ECONOMICS_ARCHITECTURE.md`;
- `docs/AI_PROVIDER_MODEL_GOVERNANCE.md`;
- `docs/CAPABILITY_CONTRACT_MATRIX.md`;
- `docs/AUTHORIZATION_ARCHITECTURE.md` and related Authorization contracts where present.

Where a concern is already owned by Security, Authorization, Billing, or a domain module, this document defines the AI integration boundary and does not transfer ownership to AI.

## 25. Completion Gate

This reconciliation is complete when:

- security and AI classification are explicitly mapped;
- authorization, safety, and entitlement remain distinct;
- Runtime enforces/invokes the required gates;
- hard constraints precede model optimization;
- prompt injection cannot alter governance;
- tool selection cannot bypass authorization;
- protected data fails closed when governance is missing;
- output is validated and safety-checked before domain mutation;
- human confirmation is version-specific where required;
- fallback preserves security and safety guarantees;
- policy decisions are immutable and attributable;
- sensitive telemetry follows privacy rules;
- emergency controls are centralized and audited;
- Customer AI, Seller AI, Agents, Automation, and future AI capabilities use the same governance boundary.
