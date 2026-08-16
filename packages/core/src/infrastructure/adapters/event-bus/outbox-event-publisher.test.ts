import { test } from "node:test";
import assert from "node:assert/strict";
import { OutboxEventPublisher } from "./outbox-event-publisher.js";
import type { OutboxEvent } from "../../ports/outbox.js";

test("outbox event publisher forwards event identity and payload to the event bus", async () => {
  let received: unknown;

 const publisher = new OutboxEventPublisher({
  async publish(event) {
    received = event;
  },

  subscribe() {
    return () => {};
  }
});

  const event: OutboxEvent = {
    id: "evt-1",
    type: "UserCreated",
    payload: { userId: "u-1" },
    occurredAt: new Date("2026-01-01T00:00:00.000Z")
  };

  await publisher.publish(event);

  assert.deepEqual(received, {
    id: "evt-1",
    type: "UserCreated",
    payload: { userId: "u-1" },
    occurredAt: event.occurredAt
  });
});
