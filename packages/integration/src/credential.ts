export type IntegrationCredentialKind = "api_key" | "bearer_token" | "basic" | "oauth2_client" | "oauth2_refresh" | "custom";

export interface IntegrationCredential {
  readonly reference: string;
  readonly providerId: string;
  readonly kind: IntegrationCredentialKind;
  readonly secret: string;
  readonly expiresAt?: string | null;
}

export interface IntegrationCredentialResolver {
  resolve(reference: string, providerId: string): Promise<IntegrationCredential | null>;
}

export function createEnvironmentCredentialResolver(
  environment: Readonly<Record<string, string | undefined>>,
): IntegrationCredentialResolver {
  return {
    async resolve(reference, providerId) {
      const key = credentialEnvironmentKey(reference, providerId);
      const secret = environment[key];
      if (!secret) return null;
      return {
        reference,
        providerId,
        kind: "bearer_token",
        secret,
      };
    },
  };
}

export function credentialEnvironmentKey(reference: string, providerId: string): string {
  const normalizedProvider = providerId.trim().replace(/[^A-Za-z0-9]+/g, "_").toUpperCase();
  const normalizedReference = reference.trim().replace(/[^A-Za-z0-9]+/g, "_").toUpperCase();
  if (!normalizedProvider || !normalizedReference) {
    throw new Error("Integration credential reference and providerId are required");
  }
  return `PHOENIX_INTEGRATION_CREDENTIAL_${normalizedProvider}_${normalizedReference}`;
}
