import type { RequestContext } from "@qooqnos/core";

export interface CapabilityInvocationContext {
  readonly requestContext: RequestContext;
  readonly capability: string;
  readonly input: unknown;
  readonly workflowExecutionId?: string;
}

export type CapabilityHandler = (
  context: CapabilityInvocationContext,
) => Promise<unknown> | unknown;

export interface CapabilityDefinition {
  readonly id: string;
  readonly handler: CapabilityHandler;
}

export class CapabilityRegistry {
  private readonly definitions = new Map<string, CapabilityDefinition>();

  register(definition: CapabilityDefinition): void {
    if (!definition.id.trim()) throw new Error("Capability id is required");
    if (this.definitions.has(definition.id)) {
      throw new Error(`Capability already registered: ${definition.id}`);
    }
    this.definitions.set(definition.id, definition);
  }

  has(id: string): boolean {
    return this.definitions.has(id);
  }

  async invoke(
    requestContext: RequestContext,
    id: string,
    input: unknown,
    workflowExecutionId?: string,
  ): Promise<unknown> {
    const definition = this.definitions.get(id);
    if (!definition) throw new Error(`Capability is not registered: ${id}`);
    return definition.handler({
      requestContext,
      capability: id,
      input,
      ...(workflowExecutionId !== undefined ? { workflowExecutionId } : {}),
    });
  }

  list(): readonly string[] {
    return [...this.definitions.keys()].sort();
  }
}
