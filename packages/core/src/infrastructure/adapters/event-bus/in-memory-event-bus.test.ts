import { test } from "node:test";
import assert from "node:assert/strict";
import { BaseDomainEvent } from "../../../domain/events/domain-event.js";
import { EventBusPublishError } from "./event-bus-error.js";
import { InMemoryEventBus } from "./in-memory-event-bus.js";

class UserCreatedEvent extends BaseDomainEvent {
  public constructor(
    public readonly userId: string,
    public readonly eventId?: string
  ) {
    super("UserCreated");
  }
}

test("event bus publishes an event once when deduplication is enabled", async () => {
  const bus = new InMemoryEventBus({ deduplicate: true });
  let calls = 0;

  bus.subscribe("UserCreated", async () => {
    calls += 1;
  });

  const event = new UserCreatedEvent("user-1", "event-1");

  await bus.publish(event);
  await bus.publish(event);

  assert.equal(calls, 1);
});

test("event bus deduplicates equivalent events using event identity", async () => {
  const bus = new InMemoryEventBus({ deduplicate: true });
  let calls = 0;

  bus.subscribe("UserCreated", async () => {
    calls += 1;
  });

  await bus.publish(new UserCreatedEvent("user-1", "event-1"));
  await bus.publish(new UserCreatedEvent("user-1", "event-1"));

  assert.equal(calls, 1);
});

test("event bus processes different event identities", async () => {
  const bus = new InMemoryEventBus({ deduplicate: true });
  let calls = 0;

  bus.subscribe("UserCreated", async () => {
    calls += 1;
  });

  await bus.publish(new UserCreatedEvent("user-1", "event-1"));
  await bus.publish(new UserCreatedEvent("user-1", "event-2"));

  assert.equal(calls, 2);
});

test("failed event is not marked as published", async () => {
  const bus = new InMemoryEventBus({ deduplicate: true });
  let attempts = 0;

  bus.subscribe("UserCreated", async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("temporary");
  });

  const event = new UserCreatedEvent("user-1", "event-1");

  await assert.rejects(
    bus.publish(event),
    (error: unknown) => error instanceof EventBusPublishError
  );

  await bus.publish(event);

  assert.equal(attempts, 2);
});

test("published event registry can be cleared", async () => {
  const bus = new InMemoryEventBus({ deduplicate: true });
  let calls = 0;

  bus.subscribe("UserCreated", async () => {
    calls += 1;
  });

  const event = new UserCreatedEvent("user-1", "event-1");

  await bus.publish(event);
  bus.clearPublishedEvents();
  await bus.publish(event);

  assert.equal(calls, 2);
});

test("deduplication can be disabled", async () => {
  const bus = new InMemoryEventBus({ deduplicate: false });
  let calls = 0;

  bus.subscribe("UserCreated", async () => {
    calls += 1;
  });

  const event = new UserCreatedEvent("user-1", "event-1");

  await bus.publish(event);
  await bus.publish(event);

  assert.equal(calls, 2);
});
