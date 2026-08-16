import type { DomainEvent } from "../../../domain/events/domain-event.js";
import type { OutboxEvent } from "../../ports/outbox.js";
import type { OutboxPublisher } from "../../ports/outbox-publisher.js";
import type { EventBus } from "../../ports/event-bus.js";

export class OutboxEventPublisher implements OutboxPublisher {
  public constructor(private readonly eventBus: EventBus) {}

  public async publish(event: OutboxEvent): Promise<void> {
    const domainEvent = {
      id: event.id,
      type: event.type,
      occurredAt: event.occurredAt,
      payload: event.payload
    } as DomainEvent;

    await this.eventBus.publish(domainEvent);
  }
}
