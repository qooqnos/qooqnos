import type { EntityId } from "@qooqnos/core";

export type CaseDispatchFailureClass = "transient" | "permanent";

export interface CaseDispatchRequest {
  readonly dispatchId: EntityId;
  readonly caseId: EntityId;
  readonly assignmentId: EntityId;
  readonly queueId: EntityId;
  readonly routeReference?: string | null;
  readonly idempotencyKey: string;
  readonly organizationId: EntityId;
  readonly workspaceId?: EntityId | null;
  readonly caseTypeId: EntityId;
  readonly priority: string;
  readonly subjectType: string;
  readonly subjectId: EntityId;
  readonly requesterType: string;
  readonly requesterId: EntityId;
  readonly correlationId: string;
}

export interface CaseDispatchResult {
  readonly status: "accepted" | "pending";
  readonly providerId: string;
  readonly externalReference?: string;
  readonly providerStatus?: string;
}

export interface CaseDispatchProviderAdapter {
  readonly providerId: string;
  dispatch(request: CaseDispatchRequest): Promise<CaseDispatchResult>;
}

export interface CaseDispatchProviderRegistry {
  resolve(providerId: string): CaseDispatchProviderAdapter | null;
}

export function createCaseDispatchProviderRegistry(
  adapters: readonly CaseDispatchProviderAdapter[] = [],
): CaseDispatchProviderRegistry {
  const map = new Map<string, CaseDispatchProviderAdapter>();
  for (const adapter of adapters) {
    const id = adapter.providerId.trim();
    if (!id) throw new Error("Case dispatch providerId is required");
    if (map.has(id)) throw new Error("Case dispatch provider already registered: " + id);
    map.set(id, adapter);
  }
  return { resolve: (providerId) => map.get(providerId) ?? null };
}

export class CaseDispatchProviderError extends Error {
  readonly failureClass: CaseDispatchFailureClass;
  readonly failureCode: string;

  constructor(message: string, failureCode: string, failureClass: CaseDispatchFailureClass) {
    super(message);
    this.name = "CaseDispatchProviderError";
    this.failureCode = failureCode;
    this.failureClass = failureClass;
  }
}

export function classifyCaseDispatchError(error: unknown): CaseDispatchFailureClass {
  return error instanceof CaseDispatchProviderError ? error.failureClass : "transient";
}

export interface CaseDispatchCredential {
  readonly secret: string;
}

export interface CaseDispatchCredentialResolver {
  resolve(reference: string, providerId: string): Promise<CaseDispatchCredential | null>;
}

export interface HttpCaseDispatchProviderConfig {
  readonly providerId: string;
  readonly baseUrl: string;
  readonly dispatchPath: string;
  readonly credentialReference: string;
  readonly credentialResolver: CaseDispatchCredentialResolver;
  readonly fetchImpl?: typeof fetch;
  readonly authorizationScheme?: "Bearer" | "ApiKey";
}

export function createHttpCaseDispatchProviderAdapter(
  config: HttpCaseDispatchProviderConfig,
): CaseDispatchProviderAdapter {
  if (!config.providerId.trim()) throw new Error("Case dispatch providerId is required");
  if (!config.baseUrl.trim()) throw new Error("Case dispatch provider baseUrl is required");
  if (!config.dispatchPath.trim()) throw new Error("Case dispatch provider dispatchPath is required");
  if (!config.credentialReference.trim()) throw new Error("Case dispatch credentialReference is required");

  const fetcher = config.fetchImpl ?? fetch;
  const authorizationScheme = config.authorizationScheme ?? "Bearer";

  return {
    providerId: config.providerId,
    async dispatch(input) {
      const credential = await config.credentialResolver.resolve(
        config.credentialReference,
        config.providerId,
      );
      if (!credential) {
        throw new CaseDispatchProviderError(
          "Case dispatch provider credential is unavailable",
          "credential_unavailable",
          "permanent",
        );
      }

      let response: Response;
      try {
        response = await fetcher(new URL(config.dispatchPath, config.baseUrl).toString(), {
          method: "POST",
          headers: {
            authorization: authorizationScheme + " " + credential.secret,
            "content-type": "application/json",
            "idempotency-key": input.idempotencyKey,
            "x-correlation-id": input.correlationId,
          },
          body: JSON.stringify(input),
        });
      } catch {
        throw new CaseDispatchProviderError(
          "Case dispatch provider network failure",
          "provider_network_error",
          "transient",
        );
      }

      const raw = await response.text();
      let payload: Record<string, unknown> = {};
      if (raw) {
        try {
          const parsed: unknown = JSON.parse(raw);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("not-object");
          }
          payload = parsed as Record<string, unknown>;
        } catch {
          throw new CaseDispatchProviderError(
            "Case dispatch provider returned invalid JSON",
            "provider_invalid_response",
            "transient",
          );
        }
      }

      if (!response.ok) {
        const failureClass: CaseDispatchFailureClass =
          response.status >= 500 || response.status === 429 ? "transient" : "permanent";
        throw new CaseDispatchProviderError(
          typeof payload.error === "string" ? payload.error : "Case dispatch provider request failed",
          typeof payload.code === "string" ? payload.code : "provider_request_failed",
          failureClass,
        );
      }

      return {
        status: payload.status === "pending" ? "pending" : "accepted",
        providerId: config.providerId,
        ...(typeof payload.externalReference === "string"
          ? { externalReference: payload.externalReference }
          : {}),
        ...(typeof payload.providerStatus === "string"
          ? { providerStatus: payload.providerStatus }
          : {}),
      };
    },
  };
}
