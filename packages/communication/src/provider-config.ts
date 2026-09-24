import {
  createHttpCommunicationProviderAdapter,
  type CommunicationProviderAdapter,
} from "./adapter";

export interface CommunicationProviderEnvironment {
  readonly EMAIL_PROVIDER_ENDPOINT?: string;
  readonly EMAIL_PROVIDER_TOKEN?: string;
  readonly SMS_PROVIDER_ENDPOINT?: string;
  readonly SMS_PROVIDER_TOKEN?: string;
  readonly WHATSAPP_PROVIDER_ENDPOINT?: string;
  readonly WHATSAPP_PROVIDER_TOKEN?: string;
  readonly PUSH_PROVIDER_ENDPOINT?: string;
  readonly PUSH_PROVIDER_TOKEN?: string;
}

/**
 * Provider credentials are supplied only at runtime. No provider account,
 * token, or secret is persisted by Communication.
 */
export function createConfiguredCommunicationProviders(
  env: CommunicationProviderEnvironment,
): readonly CommunicationProviderAdapter[] {
  const adapters: CommunicationProviderAdapter[] = [];
  if (env.EMAIL_PROVIDER_ENDPOINT && env.EMAIL_PROVIDER_TOKEN) {
    adapters.push(createHttpCommunicationProviderAdapter({
      providerId: "email.http",
      channels: ["email"],
      endpoint: env.EMAIL_PROVIDER_ENDPOINT,
      authorization: { scheme: "Bearer", credential: env.EMAIL_PROVIDER_TOKEN },
    }));
  }
  if (env.SMS_PROVIDER_ENDPOINT && env.SMS_PROVIDER_TOKEN) {
    adapters.push(createHttpCommunicationProviderAdapter({
      providerId: "sms.http",
      channels: ["sms"],
      endpoint: env.SMS_PROVIDER_ENDPOINT,
      authorization: { scheme: "Bearer", credential: env.SMS_PROVIDER_TOKEN },
    }));
  }
  if (env.PUSH_PROVIDER_ENDPOINT && env.PUSH_PROVIDER_TOKEN) {
    adapters.push(createHttpCommunicationProviderAdapter({
      providerId: "push.http",
      channels: ["push"],
      endpoint: env.PUSH_PROVIDER_ENDPOINT,
      authorization: { scheme: "Bearer", credential: env.PUSH_PROVIDER_TOKEN },
    }));
  }
  if (env.WHATSAPP_PROVIDER_ENDPOINT && env.WHATSAPP_PROVIDER_TOKEN) {
    adapters.push(createHttpCommunicationProviderAdapter({
      providerId: "whatsapp.http",
      channels: ["whatsapp"],
      endpoint: env.WHATSAPP_PROVIDER_ENDPOINT,
      authorization: { scheme: "Bearer", credential: env.WHATSAPP_PROVIDER_TOKEN },
    }));
  }
  return adapters;
}
