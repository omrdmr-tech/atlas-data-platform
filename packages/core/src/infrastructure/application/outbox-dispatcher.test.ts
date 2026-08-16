import { test } from "node:test";
import assert from "node:assert/strict";
import { OutboxDispatcher } from "./outbox-dispatcher.js";
import type {
  OutboxStore,
  PendingOutboxEvent
} from "../ports/outbox.js";
import type { OutboxPublisher } from "../ports/outbox-publisher.js";

function event(id: string): PendingOutboxEvent {
  const now = new Date("2026-01-01T00:00:00.000Z");

  return {
    id,
    type: "UserCreated",
    payload: { id },
    occurredAt: now,
    createdAt: now,
    publishedAt: null,
    attempts: 0
  };
}

class FakeStore implements OutboxStore {
  public readonly pending = [event("evt-1"), event("evt-2")];
  public readonly published: string[] = [];

  public async append(): Promise<void> {}

  public async getPending(limit = 100): Promise<PendingOutboxEvent[]> {
    return this.pending.slice(0, limit);
  }

  public async markPublished(id: string): Promise<void> {
    this.published.push(id);
  }
}

class FakePublisher implements OutboxPublisher {
  public readonly published: string[] = [];
  public readonly failures = new Set<string>();

  public async publish(input: PendingOutboxEvent): Promise<void> {
    if (this.failures.has(input.id)) {
      throw new Error(`publish failed: ${input.id}`);
    }

    this.published.push(input.id);
  }
}

test("outbox dispatcher publishes and marks successful events", async () => {
  const store = new FakeStore();
  const publisher = new FakePublisher();
  const dispatcher = new OutboxDispatcher(store, publisher);

  const result = await dispatcher.dispatchOnce();

  assert.deepEqual(result, {
    fetched: 2,
    published: 2,
    failed: 0
  });

  assert.deepEqual(publisher.published, ["evt-1", "evt-2"]);
  assert.deepEqual(store.published, ["evt-1", "evt-2"]);
});

test("outbox dispatcher does not mark failed events", async () => {
  const store = new FakeStore();
  const publisher = new FakePublisher();

  publisher.failures.add("evt-1");

  const dispatcher = new OutboxDispatcher(store, publisher);
  const result = await dispatcher.dispatchOnce();

  assert.deepEqual(result, {
    fetched: 2,
    published: 1,
    failed: 1
  });

  assert.deepEqual(publisher.published, ["evt-2"]);
  assert.deepEqual(store.published, ["evt-2"]);
});

test("outbox dispatcher continues after a failed event", async () => {
  const store = new FakeStore();
  const publisher = new FakePublisher();

  publisher.failures.add("evt-1");

  const dispatcher = new OutboxDispatcher(store, publisher);

  await dispatcher.dispatchOnce();

  assert.deepEqual(publisher.published, ["evt-2"]);
});

test("outbox dispatcher respects the batch size", async () => {
  const store = new FakeStore();
  const publisher = new FakePublisher();

  const dispatcher = new OutboxDispatcher(store, publisher, {
    maxBatchSize: 1
  });

  const result = await dispatcher.dispatchOnce();

  assert.deepEqual(result, {
    fetched: 1,
    published: 1,
    failed: 0
  });

  assert.deepEqual(store.published, ["evt-1"]);
});

test("outbox dispatcher validates the batch size", () => {
  const store = new FakeStore();
  const publisher = new FakePublisher();

  assert.throws(
    () =>
      new OutboxDispatcher(store, publisher, {
        maxBatchSize: 0
      }),
    /positive integer/
  );

  assert.throws(
    () =>
      new OutboxDispatcher(store, publisher, {
        maxBatchSize: 1.5
      }),
    /positive integer/
  );
});

test("outbox dispatcher can dispatch an empty batch", async () => {
  const store = new FakeStore();
  store.pending.length = 0;

  const publisher = new FakePublisher();
  const dispatcher = new OutboxDispatcher(store, publisher);

  const result = await dispatcher.dispatchOnce();

  assert.deepEqual(result, {
    fetched: 0,
    published: 0,
    failed: 0
  });
});