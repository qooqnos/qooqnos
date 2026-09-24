# Phoenix Automation Compensation / Rollback Contract

**Status:** Canonical runtime contract  
**Owner:** Automation  
**Schema migration:** `0067_automation_compensation_contract.sql`

## Recovery flow

```
Failed Action
  -> Compensation Policy
  -> Previously Completed Actions in reverse order
  -> Compensating Capability
  -> Compensation Reference + Evidence
```

Automation uses explicit compensation rather than distributed database rollback. Domain modules remain authoritative for their own successful side effects.

## Policy

Each consequential action may declare `compensation_policy_json`:

```json
{"version":1,"mode":"automatic","capability":"booking.release"}
```

Modes:

- `automatic`: invoke the registered compensating capability after a later action fails.
- `manual`: persist recovery work without automatic invocation.
- `none`: explicitly declare that no compensation is configured.

Automatic and manual policies require a registered capability.

## Saga behavior

When action N fails:

1. record the failed action and normalized failure evidence;
2. traverse prior completed actions in descending sequence order;
3. invoke each declared automatic compensation through CapabilityRegistry;
4. preserve manual compensation as operational recovery work;
5. persist success/failure evidence for every compensation;
6. keep the workflow failed until an explicit recovery operation changes it.

The failed action itself is not compensated automatically because its successful side effect is not established.

## Compensation input

The compensating capability receives:

```json
{
  "executionId":"...",
  "originalActionId":"...",
  "failedActionId":"...",
  "originalOutput":{},
  "originalInput":{},
  "compensationReferenceId":"..."
}
```

The domain capability decides which values are authoritative.

## Idempotency

Compensation idempotency key:

```
<executionId>:compensation:<completedActionId>
```

Compensating capabilities MUST be safe to invoke again after an ambiguous worker failure.

## Evidence

A compensation reference records execution/action lineage, failed step/attempt where known, compensating capability, input reference, idempotency key, attempt number, status, output reference, evidence reference, error reference, and timestamps.

Evidence is operational recovery evidence. It never replaces domain-owned truth.

## State

```
DEFINED -> REQUESTED -> COMPLETED
                    -> FAILED
```

`requested` represents queued or in-progress recovery and is retryable under the idempotent capability contract.

## Ordering

For:

```
A -> B -> C(failed)
```

Phoenix attempts:

```
compensate(B)
compensate(A)
```

## Non-compensatable actions

Irreversible side effects must use `none` or an explicit `manual` recovery path. Completing the compensation phase never means that every external effect was undone.

## Security and tenancy

Compensation reuses the execution RequestContext and CapabilityRegistry boundary. It stays inside the execution's organization/workspace scope. Sensitive payloads are not copied into durable evidence. Domain modules own the compensating capabilities.

## Definition of Done

- action-level compensation policy is persisted;
- reverse-order compensation of prior completed actions is implemented;
- only registered capabilities are invoked;
- compensation references are durable and idempotent;
- success/failure evidence is persisted;
- manual and non-compensatable actions are explicit;
- migration registration and checksum lock are updated;
- automated coverage proves reverse compensation and evidence.

**Canonical rule:** Automation coordinates compensation; it never claims a distributed rollback across domain-owned state.
