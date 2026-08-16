import { test } from "node:test";
import assert from "node:assert/strict";
import { PostgreSQLOutboxStore } from "./postgresql-outbox-store.js";

class FakeTransaction {
  public active = true;
  public calls: Array<{ text: string; parameters?: readonly unknown[] }> = [];

  public async begin(): Promise<void> { this.active = true; }
  public async commit(): Promise<void> { this.active = false; }
  public async rollback(): Promise<void> { this.active = false; }
  public isActive(): boolean { return this.active; }

  public async query<T = Record<string, unknown>>(
    text: string,
    parameters?: readonly unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    this.calls.push({ text, parameters });
    return { rows: [], rowCount: 1 };
  }
}

test("PostgreSQL outbox appends through the active transaction", async () => {
  const queries: Array<{ text: string; parameters?: readonly unknown[] }> = [];
  const pool = {
    async query<T = Record<string, unknown>>(
      text: string,
      parameters?: readonly unknown[]
    ) {
      queries.push({ text, parameters });
      return { rows: [] as T[], rowCount: 1 };
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
  assert.match(transaction.calls[0].text, /INSERT INTO atlas_outbox_events/);
  assert.equal(queries.length, 0);
});

test("PostgreSQL outbox rejects append without an active transaction", async () => {
  const store = new PostgreSQLOutboxStore({
    async query() {
      return { rows: [], rowCount: 0 };
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
});

test("PostgreSQL outbox reads pending events in creation order", async () => {
  const pool = {
    async query<T = Record<string, unknown>>() {
      return {
        rows: [
          {
            id: "evt-1",
            event_type: "UserCreated",
            payload: { userId: "u-1" },
            occurred_at: new Date("2026-01-01T00:00:00.000Z"),
            created_at: new Date("2026-01-01T00:01:00.000Z"),
            published_at: null,
            attempts: 0
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
  assert.deepEqual(pending[0].payload, { userId: "u-1" });
});

test("PostgreSQL outbox validates the pending limit", async () => {
  const store = new PostgreSQLOutboxStore({
    async query() {
      return { rows: [], rowCount: 0 };
    }
  });

  await assert.rejects(() => store.getPending(0), /positive integer/);
  await assert.rejects(() => store.getPending(1.5), /positive integer/);
});

test("PostgreSQL outbox marks an event published", async () => {
  const calls: Array<{ text: string; parameters?: readonly unknown[] }> = [];
  const store = new PostgreSQLOutboxStore({
    async query<T = Record<string, unknown>>(
      text: string,
      parameters?: readonly unknown[]
    ) {
      calls.push({ text, parameters });
      return { rows: [] as T[], rowCount: 1 };
    }
  });

  await store.markPublished("evt-1");

  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /SET published_at = CURRENT_TIMESTAMP/);
});
