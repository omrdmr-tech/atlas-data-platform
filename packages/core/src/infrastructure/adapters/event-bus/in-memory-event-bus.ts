import type { DomainEvent } from "../../../domain/events/domain-event.js";
import type { EventBus, EventHandler } from "../../ports/event-bus.js";
import type { IdempotencyStore } from "../../ports/idempotency-store.js";
import { EventBusPublishError } from "./event-bus-error.js";
import {
  defaultEventIdentity,
  type EventIdentityResolver
} from "./idempotency.js";
import { validateRetryPolicy, type RetryPolicy } from "./retry-policy.js";
import { InMemoryIdempotencyStore } from "./in-memory-idempotency-store.js";

export interface EventBusOptions {
  readonly retry?: RetryPolicy;
  readonly deduplicate?: boolean;
  readonly eventIdentity?: EventIdentityResolver;
  readonly idempotencyStore?: IdempotencyStore;
}

export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly retry?: RetryPolicy;
  private readonly deduplicate: boolean;
  private readonly eventIdentity: EventIdentityResolver;
  private readonly idempotencyStore: IdempotencyStore;

  public constructor(options: EventBusOptions = {}) {
    if (options.retry) validateRetryPolicy(options.retry);

    this.retry = options.retry;
    this.deduplicate = options.deduplicate ?? false;
    this.eventIdentity = options.eventIdentity ?? defaultEventIdentity;
    this.idempotencyStore =
      options.idempotencyStore ?? new InMemoryIdempotencyStore();
  }

  public async publish(event: DomainEvent): Promise<void> {
    const key = this.eventIdentity(event);

    if (this.deduplicate && await this.idempotencyStore.has(key)) {
      return;
    }

    const handlers = [...(this.handlers.get(event.type) ?? [])];
    const failures: { eventType: string; error: unknown }[] = [];

    for (const handler of handlers) {
      try {
        await this.executeWithRetry(handler, event);
      } catch (error) {
        failures.push({ eventType: event.type, error });
      }
    }

    if (failures.length > 0) {
      throw new EventBusPublishError(failures);
    }

    if (this.deduplicate) {
      await this.idempotencyStore.mark(key);
    }
  }

  public subscribe(eventType: string, handler: EventHandler): () => void {
    if (!eventType) throw new Error("Event type is required.");

    const handlers =
      this.handlers.get(eventType) ?? new Set<EventHandler>();

    handlers.add(handler);
    this.handlers.set(eventType, handlers);

    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) this.handlers.delete(eventType);
    };
  }

  public handlerCount(eventType: string): number {
    return this.handlers.get(eventType)?.size ?? 0;
  }

  public clearPublishedEvents(): void {
    if (this.idempotencyStore instanceof InMemoryIdempotencyStore) {
      this.idempotencyStore.clear();
    }
  }

  private async executeWithRetry(
    handler: EventHandler,
    event: DomainEvent
  ): Promise<void> {
    const maxAttempts = this.retry?.maxAttempts ?? 1;
    const delayMs = this.retry?.delayMs ?? 0;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await handler(event);
        return;
      } catch (error) {
        lastError = error;

        if (attempt < maxAttempts && delayMs > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    throw lastError;
  }
}
