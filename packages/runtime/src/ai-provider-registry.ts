import type { AIProviderAdapter, AIProviderRequest } from "./ai-runtime";

export interface AIProviderRegistration {
  readonly providerId: string;
  readonly models: readonly string[];
  readonly adapter: AIProviderAdapter;
}

export interface AIProviderSelection {
  readonly providerId?: string | undefined;
  readonly modelId?: string | undefined;
}

export class AIProviderUnavailableError extends Error {
  readonly providerId?: string | undefined;
  readonly modelId?: string | undefined;

  constructor(selection: AIProviderSelection) {
    const requested = [selection.providerId, selection.modelId].filter(Boolean).join("/");
    super(requested ? `No AI provider is registered for ${requested}` : "No AI provider is registered for the requested AI operation");
    this.name = "AIProviderUnavailableError";
    this.providerId = selection.providerId;
    this.modelId = selection.modelId;
  }
}

export interface AIProviderRegistry {
  register(registration: AIProviderRegistration): void;
  resolve(selection?: AIProviderSelection): AIProviderRegistration;
  execute(request: AIProviderRequest, selection?: AIProviderSelection): ReturnType<AIProviderAdapter["execute"]>;
}

export function createAIProviderRegistry(
  registrations: readonly AIProviderRegistration[] = [],
): AIProviderRegistry {
  const entries = new Map<string, AIProviderRegistration>();

  for (const registration of registrations) registerEntry(entries, registration);

  return {
    register(registration) {
      registerEntry(entries, registration);
    },
    resolve(selection = {}) {
      const candidates = [...entries.values()].filter((entry) =>
        selection.providerId === undefined || entry.providerId === selection.providerId,
      );
      const match = candidates.find((entry) =>
        selection.modelId === undefined || entry.models.includes(selection.modelId),
      );
      if (match === undefined) throw new AIProviderUnavailableError(selection);
      return match;
    },
    async execute(request, selection) {
      const registration = this.resolve(selection);
      return registration.adapter.execute(request);
    },
  };
}

function registerEntry(
  entries: Map<string, AIProviderRegistration>,
  registration: AIProviderRegistration,
): void {
  if (!registration.providerId.trim()) throw new Error("AI providerId is required");
  if (registration.models.some((model) => !model.trim())) throw new Error("AI provider modelId cannot be empty");
  if (entries.has(registration.providerId)) throw new Error(`AI provider ${registration.providerId} is already registered`);
  entries.set(registration.providerId, registration);
}
