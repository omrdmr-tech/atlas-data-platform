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
    attempts: 0,
    leaseOwner: null,
    leaseUntil: null
  };
}

class FakeStore implements OutboxStore {
  public readonly pending = [
    event("evt-1"),
    event("evt-2")
  ];

  public readonly published: string[] = [];
  public readonly claims: Array<{
    owner: string;
    limit: number | undefined;
    leaseDurationMs: number | undefined;
  }> = [];

  public async append(): Promise<void> {}

  public async getPending(
    limit = 100
  ): Promise<PendingOutboxEvent[]> {
    return this.pending.slice(0, limit);
  }

  public async claimPending(
  owner: string,
  limit = 100,
  leaseDurationMs = 30_000
): Promise<PendingOutboxEvent[]> {
  this.claims.push({
    owner,
    limit,
    leaseDurationMs
  });

  const claimed = this.pending
    .slice(0, limit)
    .map((item) => ({
      ...item,
      leaseOwner: owner,
      leaseUntil: new Date(
        "2026-01-01T00:01:00.000Z"
      )
    }));

  for (const item of claimed) {
    const original = this.pending.find(
      (pending) => pending.id === item.id
    );

    if (original) {
      Object.assign(original, {
        leaseOwner: owner,
        leaseUntil: item.leaseUntil
      });
    }
  }

  return claimed;
}

 public async markPublished(
  id: string,
  owner: string
): Promise<void> {
  this.published.push(`${owner}:${id}`);
}
}

class FakePublisher implements OutboxPublisher {
  public readonly published: string[] = [];
  public readonly failures = new Set<string>();

  public async publish(
    input: PendingOutboxEvent
  ): Promise<void> {
    if (this.failures.has(input.id)) {
      throw new Error(
        `publish failed: ${input.id}`
      );
    }

    this.published.push(input.id);
  }
}

test(
  "outbox dispatcher publishes and marks successful events",
  async () => {
    const store = new FakeStore();
    const publisher = new FakePublisher();

    const dispatcher = new OutboxDispatcher(
      store,
      publisher,
      {
        owner: "worker-1"
      }
    );

    const result = await dispatcher.dispatchOnce();

    assert.deepEqual(result, {
      fetched: 2,
      published: 2,
      failed: 0
    });

    assert.deepEqual(
      publisher.published,
      ["evt-1", "evt-2"]
    );

    assert.deepEqual(
      store.published,
      [
        "worker-1:evt-1",
        "worker-1:evt-2"
      ]
    );

    assert.deepEqual(
      store.claims,
      [
        {
          owner: "worker-1",
          limit: 100,
          leaseDurationMs: 30_000
        }
      ]
    );
  }
);

test(
  "outbox dispatcher does not mark failed events",
  async () => {
    const store = new FakeStore();
    const publisher = new FakePublisher();

    publisher.failures.add("evt-1");

    const dispatcher = new OutboxDispatcher(
      store,
      publisher,
      {
        owner: "worker-1"
      }
    );

    const result = await dispatcher.dispatchOnce();

    assert.deepEqual(result, {
      fetched: 2,
      published: 1,
      failed: 1
    });

    assert.deepEqual(
      publisher.published,
      ["evt-2"]
    );

    assert.deepEqual(
      store.published,
      ["worker-1:evt-2"]
    );
  }
);

test(
  "outbox dispatcher continues after a failed event",
  async () => {
    const store = new FakeStore();
    const publisher = new FakePublisher();

    publisher.failures.add("evt-1");

    const dispatcher = new OutboxDispatcher(
      store,
      publisher,
      {
        owner: "worker-1"
      }
    );

    await dispatcher.dispatchOnce();

    assert.equal(
      publisher.published.includes("evt-2"),
      true
    );
  }
);

test(
  "outbox dispatcher respects the batch size",
  async () => {
    const store = new FakeStore();
    const publisher = new FakePublisher();

    const dispatcher = new OutboxDispatcher(
      store,
      publisher,
      {
        maxBatchSize: 1,
        owner: "worker-1"
      }
    );

    const result = await dispatcher.dispatchOnce();

    assert.deepEqual(result, {
      fetched: 1,
      published: 1,
      failed: 0
    });

    assert.deepEqual(
      store.published,
      ["worker-1:evt-1"]
    );
  }
);

test(
  "outbox dispatcher passes the lease duration to the store",
  async () => {
    const store = new FakeStore();
    const publisher = new FakePublisher();

    const dispatcher = new OutboxDispatcher(
      store,
      publisher,
      {
        owner: "worker-42",
        leaseDurationMs: 60_000
      }
    );

    await dispatcher.dispatchOnce();

    assert.deepEqual(
      store.claims[0],
      {
        owner: "worker-42",
        limit: 100,
        leaseDurationMs: 60_000
      }
    );
  }
);

test(
  "outbox dispatcher validates the batch size",
  () => {
    const store = new FakeStore();
    const publisher = new FakePublisher();

    assert.throws(
      () =>
        new OutboxDispatcher(
          store,
          publisher,
          {
            maxBatchSize: 0
          }
        ),
      /positive integer/
    );

    assert.throws(
      () =>
        new OutboxDispatcher(
          store,
          publisher,
          {
            maxBatchSize: 1.5
          }
        ),
      /positive integer/
    );
  }
);

test(
  "outbox dispatcher validates the poll interval",
  () => {
    const store = new FakeStore();
    const publisher = new FakePublisher();

    assert.throws(
      () =>
        new OutboxDispatcher(
          store,
          publisher,
          {
            pollIntervalMs: 0
          }
        ),
      /positive integer/
    );

    assert.throws(
      () =>
        new OutboxDispatcher(
          store,
          publisher,
          {
            pollIntervalMs: 1.5
          }
        ),
      /positive integer/
    );
  }
);

test(
  "outbox dispatcher validates the lease duration",
  () => {
    const store = new FakeStore();
    const publisher = new FakePublisher();

    assert.throws(
      () =>
        new OutboxDispatcher(
          store,
          publisher,
          {
            leaseDurationMs: 0
          }
        ),
      /positive integer/
    );

    assert.throws(
      () =>
        new OutboxDispatcher(
          store,
          publisher,
          {
            leaseDurationMs: 1.5
          }
        ),
      /positive integer/
    );
  }
);

test(
  "outbox dispatcher validates the owner",
  () => {
    const store = new FakeStore();
    const publisher = new FakePublisher();

    assert.throws(
      () =>
        new OutboxDispatcher(
          store,
          publisher,
          {
            owner: ""
          }
        ),
      /owner is required/
    );
  }
);

test(
  "outbox dispatcher can dispatch an empty batch",
  async () => {
    const store = new FakeStore();
    store.pending.length = 0;

    const publisher = new FakePublisher();

    const dispatcher = new OutboxDispatcher(
      store,
      publisher,
      {
        owner: "worker-1"
      }
    );

    const result = await dispatcher.dispatchOnce();

    assert.deepEqual(result, {
      fetched: 0,
      published: 0,
      failed: 0
    });
  }
);

test(
  "outbox dispatcher starts immediately",
  async () => {
    const store = new FakeStore();
    const publisher = new FakePublisher();

    const dispatcher = new OutboxDispatcher(
      store,
      publisher,
      {
        owner: "worker-1",
        pollIntervalMs: 60_000
      }
    );

    dispatcher.start();

    await new Promise<void>((resolve) => {
      const check = (): void => {
        if (publisher.published.length > 0) {
          resolve();
          return;
        }

        setTimeout(check, 1);
      };

      check();
    });

    assert.equal(
      dispatcher.isRunning,
      true
    );

    assert.deepEqual(
      publisher.published,
      ["evt-1", "evt-2"]
    );

    await dispatcher.stop();

    assert.equal(
      dispatcher.isRunning,
      false
    );
  }
);

test(
  "outbox dispatcher ignores repeated start calls",
  async () => {
    const store = new FakeStore();
    const publisher = new FakePublisher();

    const dispatcher = new OutboxDispatcher(
      store,
      publisher,
      {
        owner: "worker-1",
        pollIntervalMs: 60_000
      }
    );

    dispatcher.start();
    dispatcher.start();
    dispatcher.start();

    await new Promise<void>((resolve) => {
      const check = (): void => {
        if (publisher.published.length === 2) {
          resolve();
          return;
        }

        setTimeout(check, 1);
      };

      check();
    });

    await dispatcher.stop();

    assert.equal(
      dispatcher.isRunning,
      false
    );

    assert.deepEqual(
      publisher.published,
      ["evt-1", "evt-2"]
    );
  }
);

test(
  "outbox dispatcher allows repeated stop calls",
  async () => {
    const store = new FakeStore();
    const publisher = new FakePublisher();

    const dispatcher = new OutboxDispatcher(
      store,
      publisher,
      {
        owner: "worker-1",
        pollIntervalMs: 60_000
      }
    );

    dispatcher.start();

    await new Promise<void>((resolve) => {
      const check = (): void => {
        if (publisher.published.length === 2) {
          resolve();
          return;
        }

        setTimeout(check, 1);
      };

      check();
    });

    await Promise.all([
      dispatcher.stop(),
      dispatcher.stop(),
      dispatcher.stop()
    ]);

    assert.equal(
      dispatcher.isRunning,
      false
    );
  }
);