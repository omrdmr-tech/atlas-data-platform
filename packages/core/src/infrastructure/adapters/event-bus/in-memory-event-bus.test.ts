import { test } from "node:test";
import assert from "node:assert/strict";
import { BaseDomainEvent } from "../../../domain/events/domain-event.js";
import { EventBusPublishError } from "./event-bus-error.js";
import { InMemoryEventBus } from "./in-memory-event-bus.js";
import { InMemoryIdempotencyStore } from "./in-memory-idempotency-store.js";

class UserCreatedEvent extends BaseDomainEvent {
  public constructor(
    public readonly userId: string,
    public readonly eventId?: string
  ) {
    super("UserCreated");
  }
}

test("event bus uses an injected idempotency store", async () => {
  const store = new InMemoryIdempotencyStore();
  const bus = new InMemoryEventBus({
    deduplicate: true,
    idempotencyStore: store
  });
  let calls = 0;

  bus.subscribe("UserCreated", async () => {
    calls += 1;
  });

  const event = new UserCreatedEvent("user-1", "event-1");

  await bus.publish(event);
  await bus.publish(event);

  assert.equal(calls, 1);
  assert.equal(await store.has("event-1"), true);
});

test("event bus does not mark failed events in the persistent store", async () => {
  const store = new InMemoryIdempotencyStore();
  const bus = new InMemoryEventBus({
    deduplicate: true,
    idempotencyStore: store
  });

  bus.subscribe("UserCreated", async () => {
    throw new Error("failed");
  });

  const event = new UserCreatedEvent("user-1", "event-1");

  await assert.rejects(
    bus.publish(event),
    (error: unknown) => error instanceof EventBusPublishError
  );

  assert.equal(await store.has("event-1"), false);
});
