/**
 * Domain Event Base Class
 * All domain events should extend this class
 */

export interface DomainEventMetadata {
  eventId: string;
  eventVersion: number;
  timestamp: Date;
  tenantId: string;
  userId?: string;
  correlationId?: string;
  causationId?: string;
}

export abstract class DomainEvent {
  abstract readonly eventType: string;
  readonly metadata: DomainEventMetadata;

  constructor(
    eventId: string,
    timestamp: Date,
    tenantId: string,
    userId?: string,
    correlationId?: string,
    causationId?: string
  ) {
    this.metadata = {
      eventId,
      eventVersion: 1,
      timestamp,
      tenantId,
      userId,
      correlationId,
      causationId,
    };
  }

  toJSON() {
    return {
      eventType: this.eventType,
      ...this.metadata,
      ...this,
    };
  }
}
