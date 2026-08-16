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

test("event bus publishes events to all subscribed handlers", async () => {
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
  assert.equal(bus.handlerCount("UserCreated"), 2);
});

test("event bus continues after a handler fails", async () => {
  const bus = new InMemoryEventBus();
  let secondHandlerCalled = false;

  bus.subscribe("UserCreated", async () => {
    throw new Error("first handler failed");
  });

  bus.subscribe("UserCreated", async () => {
    secondHandlerCalled = true;
  });

  await assert.rejects(
    bus.publish(new UserCreatedEvent("user-1")),
    (error: unknown) => {
      assert.ok(error instanceof EventBusPublishError);
      assert.equal(error.failures.length, 1);
      assert.equal(error.failures[0]?.eventType, "UserCreated");
      return true;
    }
  );

  assert.equal(secondHandlerCalled, true);
});

test("event bus aggregates multiple handler failures", async () => {
  const bus = new InMemoryEventBus();

  bus.subscribe("UserCreated", async () => {
    throw new Error("first");
  });

  bus.subscribe("UserCreated", async () => {
    throw new Error("second");
  });

  await assert.rejects(
    bus.publish(new UserCreatedEvent("user-1")),
    (error: unknown) => {
      assert.ok(error instanceof EventBusPublishError);
      assert.equal(error.failures.length, 2);
      return true;
    }
  );
});

test("event bus unsubscribe removes only the registered handler", async () => {
  const bus = new InMemoryEventBus();
  let first = 0;
  let second = 0;

  const unsubscribe = bus.subscribe("UserCreated", async () => {
    first += 1;
  });

  bus.subscribe("UserCreated", async () => {
    second += 1;
  });

  unsubscribe();

  await bus.publish(new UserCreatedEvent("user-1"));

  assert.equal(first, 0);
  assert.equal(second, 1);
  assert.equal(bus.handlerCount("UserCreated"), 1);
});

test("event bus rejects an empty event type", () => {
  const bus = new InMemoryEventBus();

  assert.throws(
    () => bus.subscribe("", async () => {}),
    /Event type is required/
  );
});
