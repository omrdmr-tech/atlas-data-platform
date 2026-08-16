import { test } from "node:test";
import assert from "node:assert/strict";
import { PostgreSQLOutboxStore } from "./postgresql-outbox-store.js";

class FakeTransaction {
  public active = true;
  public calls: Array<{
    text: string;
    parameters?: readonly unknown[];
  }> = [];

  public async begin(): Promise<void> {
    this.active = true;
  }

  public async commit(): Promise<void> {
    this.active = false;
  }

  public async rollback(): Promise<void> {
    this.active = false;
  }

  public isActive(): boolean {
    return this.active;
  }

  public async query<T = Record<string, unknown>>(
    text: string,
    parameters?: readonly unknown[]
  ): Promise<{
    rows: T[];
    rowCount: number | null;
  }> {
    this.calls.push({ text, parameters });

    return {
      rows: [],
      rowCount: 1
    };
  }
}

test(
  "PostgreSQL outbox appends through the active transaction",
  async () => {
    const queries: Array<{
      text: string;
      parameters?: readonly unknown[];
    }> = [];

    const pool = {
      async query<T = Record<string, unknown>>(
        text: string,
        parameters?: readonly unknown[]
      ) {
        queries.push({ text, parameters });

        return {
          rows: [] as T[],
          rowCount: 1
        };
      }
    };

    const store = new PostgreSQLOutboxStore(pool);
    const transaction = new FakeTransaction();

    await store.append(
      {
        id: "evt-1",
        type: "UserCreated",
        payload: { userId: "u-1" },
        occurredAt: new Date("2026-01-01T00:00:00.000Z")
      },
      transaction
    );

    assert.equal(transaction.calls.length, 1);
    assert.match(
      transaction.calls[0].text,
      /INSERT INTO atlas_outbox_events/
    );
    assert.equal(queries.length, 0);
  }
);

test(
  "PostgreSQL outbox rejects append without an active transaction",
  async () => {
    const store = new PostgreSQLOutboxStore({
      async query() {
        return {
          rows: [],
          rowCount: 0
        };
      }
    });

    const transaction = new FakeTransaction();
    transaction.active = false;

    await assert.rejects(
      store.append(
        {
          id: "evt-1",
          type: "UserCreated",
          payload: {},
          occurredAt: new Date()
        },
        transaction
      ),
      /active transaction/
    );
  }
);

test(
  "PostgreSQL outbox reads pending events with lease data",
  async () => {
    const leaseUntil = new Date("2026-01-01T00:02:00.000Z");

    const pool = {
      async query<T = Record<string, unknown>>() {
        return {
          rows: [
            {
              id: "evt-1",
              event_type: "UserCreated",
              payload: { userId: "u-1" },
              occurred_at: new Date(
                "2026-01-01T00:00:00.000Z"
              ),
              created_at: new Date(
                "2026-01-01T00:01:00.000Z"
              ),
              published_at: null,
              attempts: 2,
              lease_owner: "worker-1",
              lease_until: leaseUntil
            }
          ] as T[],
          rowCount: 1
        };
      }
    };

    const store = new PostgreSQLOutboxStore(pool);

    const pending = await store.getPending(10);

    assert.equal(pending.length, 1);
    assert.equal(pending[0].id, "evt-1");
    assert.equal(pending[0].type, "UserCreated");
    assert.deepEqual(
      pending[0].payload,
      { userId: "u-1" }
    );
    assert.equal(
      pending[0].leaseOwner,
      "worker-1"
    );
    assert.deepEqual(
      pending[0].leaseUntil,
      leaseUntil
    );
    assert.equal(pending[0].attempts, 2);
  }
);

test(
  "PostgreSQL outbox reads unleased events",
  async () => {
    const pool = {
      async query<T = Record<string, unknown>>() {
        return {
          rows: [
            {
              id: "evt-1",
              event_type: "UserCreated",
              payload: {},
              occurred_at: new Date(
                "2026-01-01T00:00:00.000Z"
              ),
              created_at: new Date(
                "2026-01-01T00:01:00.000Z"
              ),
              published_at: null,
              attempts: 0,
              lease_owner: null,
              lease_until: null
            }
          ] as T[],
          rowCount: 1
        };
      }
    };

    const store = new PostgreSQLOutboxStore(pool);
    const pending = await store.getPending();

    assert.equal(pending[0].leaseOwner, null);
    assert.equal(pending[0].leaseUntil, null);
  }
);

test(
  "PostgreSQL outbox validates the pending limit",
  async () => {
    const store = new PostgreSQLOutboxStore({
      async query() {
        return {
          rows: [],
          rowCount: 0
        };
      }
    });

    await assert.rejects(
      () => store.getPending(0),
      /positive integer/
    );

    await assert.rejects(
      () => store.getPending(1.5),
      /positive integer/
    );
  }
);

test(
  "PostgreSQL outbox claims pending events",
  async () => {
    const leaseUntil = new Date(
      "2026-01-01T00:01:00.000Z"
    );

    const calls: Array<{
      text: string;
      parameters?: readonly unknown[];
    }> = [];

    const store = new PostgreSQLOutboxStore({
      async query<T = Record<string, unknown>>(
        text: string,
        parameters?: readonly unknown[]
      ) {
        calls.push({ text, parameters });

        return {
          rows: [
            {
              id: "evt-1",
              event_type: "UserCreated",
              payload: { userId: "u-1" },
              occurred_at: new Date(
                "2026-01-01T00:00:00.000Z"
              ),
              created_at: new Date(
                "2026-01-01T00:00:01.000Z"
              ),
              published_at: null,
              attempts: 1,
              lease_owner: "worker-1",
              lease_until: leaseUntil
            }
          ] as T[],
          rowCount: 1
        };
      }
    });

    const claimed = await store.claimPending(
      "worker-1",
      10,
      30_000
    );

    assert.equal(claimed.length, 1);
    assert.equal(claimed[0].id, "evt-1");
    assert.equal(
      claimed[0].leaseOwner,
      "worker-1"
    );
    assert.deepEqual(
      claimed[0].leaseUntil,
      leaseUntil
    );
    assert.equal(claimed[0].attempts, 1);

    assert.equal(calls.length, 1);
    assert.match(
      calls[0].text,
      /FOR UPDATE SKIP LOCKED/
    );
    assert.match(
      calls[0].text,
      /lease_owner/
    );
  }
);

test(
  "PostgreSQL outbox validates claim owner",
  async () => {
    const store = new PostgreSQLOutboxStore({
      async query() {
        return {
          rows: [],
          rowCount: 0
        };
      }
    });

    await assert.rejects(
      () => store.claimPending(""),
      /lease owner is required/
    );
  }
);

test(
  "PostgreSQL outbox validates lease duration",
  async () => {
    const store = new PostgreSQLOutboxStore({
      async query() {
        return {
          rows: [],
          rowCount: 0
        };
      }
    });

    await assert.rejects(
      () => store.claimPending("worker-1", 10, 0),
      /positive integer/
    );

    await assert.rejects(
      () => store.claimPending("worker-1", 10, 1.5),
      /positive integer/
    );
  }
);

test(
  "PostgreSQL outbox validates claim limit",
  async () => {
    const store = new PostgreSQLOutboxStore({
      async query() {
        return {
          rows: [],
          rowCount: 0
        };
      }
    });

    await assert.rejects(
      () => store.claimPending("worker-1", 0),
      /positive integer/
    );

    await assert.rejects(
      () => store.claimPending("worker-1", 1.5),
      /positive integer/
    );
  }
);

test(
  "PostgreSQL outbox marks an event published for its owner",
  async () => {
    const calls: Array<{
      text: string;
      parameters?: readonly unknown[];
    }> = [];

    const store = new PostgreSQLOutboxStore({
      async query<T = Record<string, unknown>>(
        text: string,
        parameters?: readonly unknown[]
      ) {
        calls.push({ text, parameters });

        return {
          rows: [] as T[],
          rowCount: 1
        };
      }
    });

    await store.markPublished(
      "evt-1",
      "worker-1"
    );

    assert.equal(calls.length, 1);
    assert.match(
      calls[0].text,
      /SET published_at = CURRENT_TIMESTAMP/
    );
    assert.match(
      calls[0].text,
      /lease_owner = NULL/
    );
    assert.match(
      calls[0].text,
      /lease_until = NULL/
    );
    assert.match(
      calls[0].text,
      /lease_owner = \$2/
    );
    assert.deepEqual(
      calls[0].parameters,
      ["evt-1", "worker-1"]
    );
  }
);

test(
  "PostgreSQL outbox validates markPublished arguments",
  async () => {
    const store = new PostgreSQLOutboxStore({
      async query() {
        return {
          rows: [],
          rowCount: 0
        };
      }
    });

    await assert.rejects(
      () => store.markPublished("", "worker-1"),
      /event id is required/
    );

    await assert.rejects(
      () => store.markPublished("evt-1", ""),
      /lease owner is required/
    );
  }
);