import type { AIRequest, AIResult } from "./types";

export interface AIRuntimeClient {
  execute<TOutput>(request: AIRequest): Promise<AIResult<TOutput>>;
}

/** Adapter contract: feature capabilities depend on the canonical AI Runtime, never on provider SDKs. */
export function createAIRuntimeClient(execute: AIRuntimeClient["execute"]): AIRuntimeClient {
  return { execute };
}
