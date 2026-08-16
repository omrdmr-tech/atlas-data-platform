import { test } from "node:test";
import assert from "node:assert/strict";
import { RedisCache } from "./redis-cache.js";

test("Redis cache requires a URL", async () => {
  const cache = new RedisCache({ url: "" });
  await assert.rejects(cache.connect(), /Redis URL is required/);
});

test("Redis cache rejects operations while disconnected", async () => {
  const cache = new RedisCache({ url: "redis://localhost:6379" });
  await assert.rejects(cache.get("key"), /not connected/);
});

test("Redis cache can be created with a real Redis URL", () => {
  const cache = new RedisCache({ url: "redis://localhost:6379" });
  assert.equal(cache.isConnected(), false);
});
