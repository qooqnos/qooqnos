/**
 * Event Bus for publishing and subscribing to domain events
 * Cloudflare Queues integration for async processing
 */

import type { DomainEvent } from './domain-event.js';
import type { EventHandler } from './event-handler.js';

export interface EventBusConfig {
  queueName?: string;
  batchSize?: number;
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
}

export class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();
  private eventLog: DomainEvent[] = [];
  private config: EventBusConfig;

  constructor(config: EventBusConfig = {}) {
    this.config = {
      batchSize: 10,
      retryPolicy: { maxRetries: 3, backoffMs: 1000 },
      ...config,
    };
  }

  subscribe<T extends DomainEvent>(handler: EventHandler<T>): void {
    const handlers = this.handlers.get(handler.eventType) ?? [];
    handlers.push(handler as EventHandler);
    this.handlers.set(handler.eventType, handlers);
  }

  async publish<T extends DomainEvent>(
    event: T,
    async: boolean = true
  ): Promise<void> {
    // Log event to event store
    this.eventLog.push(event);

    if (async) {
      // In real implementation, push to Cloudflare Queue
      // For now, process synchronously
      await this.processEvent(event);
    } else {
      await this.processEvent(event);
    }
  }

  private async processEvent<T extends DomainEvent>(event: T): Promise<void> {
    const handlers = this.handlers.get(event.eventType) ?? [];

    for (const handler of handlers) {
      try {
        await handler.handle(event as any);
      } catch (error) {
        console.error(`Error in handler for ${event.eventType}:`, error);
        throw error;
      }
    }
  }

  async replay(tenantId: string, since?: Date): Promise<DomainEvent[]> {
    return this.eventLog.filter(
      (e) => e.metadata.tenantId === tenantId && (!since || e.metadata.timestamp >= since)
    );
  }

  getEventLog(): DomainEvent[] {
    return [...this.eventLog];
  }
}
