import { test } from "node:test";
import assert from "node:assert/strict";
import { BaseDomainEvent } from "../../../domain/events/domain-event.js";
import { InMemoryEventBus } from "./in-memory-event-bus.js";

class UserCreatedEvent extends BaseDomainEvent {
  public constructor(public readonly userId: string) {
    super("UserCreated");
  }
}

test("event bus publishes events to subscribed handlers", async () => {
  const bus = new InMemoryEventBus();
  const received: string[] = [];

  bus.subscribe("UserCreated", async (event) => {
    received.push((event as UserCreatedEvent).userId);
  });

  await bus.publish(new UserCreatedEvent("user-1"));

  assert.deepEqual(received, ["user-1"]);
});

test("event bus unsubscribe stops future delivery", async () => {
  const bus = new InMemoryEventBus();
  let count = 0;

  const unsubscribe = bus.subscribe("UserCreated", async () => {
    count += 1;
  });

  await bus.publish(new UserCreatedEvent("user-1"));
  unsubscribe();
  await bus.publish(new UserCreatedEvent("user-2"));

  assert.equal(count, 1);
});

test("event bus supports multiple handlers", async () => {
  const bus = new InMemoryEventBus();
  const calls: string[] = [];

  bus.subscribe("UserCreated", async () => {
  calls.push("first");
});

bus.subscribe("UserCreated", async () => {
  calls.push("second");
});

  await bus.publish(new UserCreatedEvent("user-1"));

  assert.deepEqual(calls, ["first", "second"]);
});

test("event bus ignores events without subscribers", async () => {
  const bus = new InMemoryEventBus();

  await assert.doesNotReject(
    bus.publish(new UserCreatedEvent("user-1"))
  );
});
