import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryIdempotencyStore } from "./in-memory-idempotency-store.js";

test("in-memory idempotency store remembers marked keys", async () => {
  const store = new InMemoryIdempotencyStore();

  assert.equal(await store.has("event-1"), false);
  await store.mark("event-1");
  assert.equal(await store.has("event-1"), true);
});

test("in-memory idempotency store can be cleared", async () => {
  const store = new InMemoryIdempotencyStore();

  await store.mark("event-1");
  store.clear();

  assert.equal(await store.has("event-1"), false);
});
