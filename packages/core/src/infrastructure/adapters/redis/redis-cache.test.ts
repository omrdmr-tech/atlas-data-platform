import { test } from "node:test";
import assert from "node:assert/strict";
import { RedisCache } from "./redis-cache.js";

test("Redis cache stores, reads and deletes values", async () => {
  const cache = new RedisCache({ url: "redis://localhost:6379" });
  await cache.connect();
  await cache.set("key", "Atlas");
  assert.equal(await cache.get("key"), "Atlas");
  await cache.delete("key");
  assert.equal(await cache.get("key"), null);
  await cache.disconnect();
});

test("Redis cache requires a URL", async () => {
  const cache = new RedisCache({ url: "" });
  await assert.rejects(cache.connect(), /Redis URL is required/);
});

test("Redis cache rejects operations while disconnected", async () => {
  const cache = new RedisCache({ url: "redis://localhost:6379" });
  await assert.rejects(cache.get("key"), /not connected/);
});
