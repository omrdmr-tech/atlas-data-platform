import type { DomainEvent } from "../../../domain/events/domain-event.js";
import type { EventBus, EventHandler } from "../../ports/event-bus.js";
import { EventBusPublishError } from "./event-bus-error.js";

export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();

  public async publish(event: DomainEvent): Promise<void> {
    const handlers = [...(this.handlers.get(event.type) ?? [])];
    const failures: { eventType: string; error: unknown }[] = [];

    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        failures.push({
          eventType: event.type,
          error
        });
      }
    }

    if (failures.length > 0) {
      throw new EventBusPublishError(failures);
    }
  }

  public subscribe(eventType: string, handler: EventHandler): () => void {
    if (!eventType) {
      throw new Error("Event type is required.");
    }

    const handlers =
      this.handlers.get(eventType) ?? new Set<EventHandler>();

    handlers.add(handler);
    this.handlers.set(eventType, handlers);

    return () => {
      handlers.delete(handler);

      if (handlers.size === 0) {
        this.handlers.delete(eventType);
      }
    };
  }

  public handlerCount(eventType: string): number {
    return this.handlers.get(eventType)?.size ?? 0;
  }
}
