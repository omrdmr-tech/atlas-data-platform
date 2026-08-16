import { test } from "node:test";
import assert from "node:assert/strict";
import { PostgreSQLIdempotencyStore } from "./postgresql-idempotency-store.js";

function createFakeDatabase() {
  const queries: { text: string; values?: unknown[] }[] = [];
  const keys = new Set<string>();

  const pool = {
    async query(text: string, values?: unknown[]) {
      queries.push({ text, values });

      if (text.includes("SELECT 1")) {
        return { rowCount: keys.has(String(values?.[0])) ? 1 : 0, rows: [] };
      }

      if (text.includes("INSERT INTO event_bus_idempotency")) {
        keys.add(String(values?.[0]));
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    }
  };

  return {
    database: {
      getPool: () => pool
    } as never,
    queries,
    keys
  };
}

test("PostgreSQL idempotency store initializes its table lazily", async () => {
  const fake = createFakeDatabase();
  const store = new PostgreSQLIdempotencyStore(fake.database);

  assert.equal(await store.has("event-1"), false);
  assert.equal(await store.has("event-1"), false);

  assert.equal(
    fake.queries.filter((query) =>
      query.text.includes("CREATE TABLE IF NOT EXISTS")
    ).length,
    1
  );
});

test("PostgreSQL idempotency store marks and finds an event", async () => {
  const fake = createFakeDatabase();
  const store = new PostgreSQLIdempotencyStore(fake.database);

  await store.mark("event-1");

  assert.equal(await store.has("event-1"), true);
  assert.equal(await store.has("event-2"), false);
});

test("PostgreSQL idempotency store uses parameterized keys", async () => {
  const fake = createFakeDatabase();
  const store = new PostgreSQLIdempotencyStore(fake.database);

  await store.mark("event'; DROP TABLE users; --");

  const insert = fake.queries.find((query) =>
    query.text.includes("INSERT INTO event_bus_idempotency")
  );

  assert.deepEqual(insert?.values, ["event'; DROP TABLE users; --"]);
});
