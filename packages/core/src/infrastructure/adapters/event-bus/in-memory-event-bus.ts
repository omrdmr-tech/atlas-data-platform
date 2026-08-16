import type { DomainEvent } from "../../../domain/events/domain-event.js";
import type { EventBus } from "../../ports/event-bus.js";

type EventHandler = (event: DomainEvent) => Promise<void>;

export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();

  public async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type);
    if (!handlers) return;

    for (const handler of handlers) {
      await handler(event);
    }
  }

  public subscribe(eventType: string, handler: EventHandler): () => void {
    const handlers = this.handlers.get(eventType) ?? new Set<EventHandler>();
    handlers.add(handler);
    this.handlers.set(eventType, handlers);

    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(eventType);
      }
    };
  }
}
