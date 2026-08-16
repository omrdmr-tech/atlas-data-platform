import { test } from "node:test";
import assert from "node:assert/strict";
import { BaseDomainEvent } from "../../../domain/events/domain-event.js";
import { EventBusPublishError } from "./event-bus-error.js";
import { InMemoryEventBus } from "./in-memory-event-bus.js";

class UserCreatedEvent extends BaseDomainEvent {
  public constructor(public readonly userId: string) {
    super("UserCreated");
  }
}

test("event bus publishes events to subscribed handlers", async () => {
  const bus = new InMemoryEventBus();
  const calls: string[] = [];

  bus.subscribe("UserCreated", async () => {
    calls.push("first");
  });

  await bus.publish(new UserCreatedEvent("user-1"));

  assert.deepEqual(calls, ["first"]);
});

test("event bus retries a failed handler", async () => {
  const bus = new InMemoryEventBus({
    retry: { maxAttempts: 3, delayMs: 0 }
  });

  let attempts = 0;

  bus.subscribe("UserCreated", async () => {
    attempts += 1;
    if (attempts < 3) throw new Error("temporary");
  });

  await bus.publish(new UserCreatedEvent("user-1"));

  assert.equal(attempts, 3);
});

test("event bus fails after retry limit", async () => {
  const bus = new InMemoryEventBus({
    retry: { maxAttempts: 2, delayMs: 0 }
  });

  let attempts = 0;

  bus.subscribe("UserCreated", async () => {
    attempts += 1;
    throw new Error("permanent");
  });

  await assert.rejects(
    bus.publish(new UserCreatedEvent("user-1")),
    (error: unknown) => error instanceof EventBusPublishError
  );

  assert.equal(attempts, 2);
});

test("event bus continues with other handlers after retry exhaustion", async () => {
  const bus = new InMemoryEventBus({
    retry: { maxAttempts: 2, delayMs: 0 }
  });

  let secondHandlerCalled = false;

  bus.subscribe("UserCreated", async () => {
    throw new Error("failed");
  });

  bus.subscribe("UserCreated", async () => {
    secondHandlerCalled = true;
  });

  await assert.rejects(
    bus.publish(new UserCreatedEvent("user-1")),
    (error: unknown) => error instanceof EventBusPublishError
  );

  assert.equal(secondHandlerCalled, true);
});

test("event bus validates retry policy", () => {
  assert.throws(
    () => new InMemoryEventBus({ retry: { maxAttempts: 0, delayMs: 0 } }),
    /maxAttempts must be a positive integer/
  );

  assert.throws(
    () => new InMemoryEventBus({ retry: { maxAttempts: 1, delayMs: -1 } }),
    /delayMs must be a non-negative integer/
  );
});
