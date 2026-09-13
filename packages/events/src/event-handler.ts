/**
 * Event Handler Interface
 * All handlers must implement this interface
 */

import type { DomainEvent } from './domain-event.js';

export interface EventHandler<T extends DomainEvent = DomainEvent> {
  eventType: string;
  handle(event: T): Promise<void>;
}

export interface EventHandlerRegistry {
  register<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>
  ): void;
  getHandlers(eventType: string): EventHandler[];
}
