import { test } from "node:test";
import assert from "node:assert/strict";
import { RedisCache, validateTtlSeconds } from "./redis-cache.js";

test("Redis cache requires a URL", async () => {
  const cache = new RedisCache({ url: "" });
  await assert.rejects(cache.connect(), /Redis URL is required/);
});

test("Redis cache rejects operations while disconnected", async () => {
  const cache = new RedisCache({ url: "redis://localhost:6379" });
  await assert.rejects(cache.get("key"), /not connected/);
});

test("Redis cache validates TTL", () => {
  assert.doesNotThrow(() => validateTtlSeconds(1));
  assert.doesNotThrow(() => validateTtlSeconds(60));

  assert.throws(
    () => validateTtlSeconds(0),
    /TTL must be a positive integer/
  );

  assert.throws(
    () => validateTtlSeconds(-1),
    /TTL must be a positive integer/
  );

  assert.throws(
    () => validateTtlSeconds(1.5),
    /TTL must be a positive integer/
  );
});

test("Redis cache can be configured with reconnect delay", () => {
  const cache = new RedisCache({
    url: "redis://localhost:6379",
    socketReconnectDelayMs: 250
  });

  assert.equal(cache.isConnected(), false);
});
