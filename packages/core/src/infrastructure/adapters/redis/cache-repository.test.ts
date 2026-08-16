import { test } from "node:test";
import assert from "node:assert/strict";
import type { Cache } from "../../ports/cache.js";
import { RedisCacheRepository } from "./cache-repository.js";

class MemoryCache implements Cache {
  private readonly values = new Map<string, string>();

  public async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  public async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  public async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

test("RedisCacheRepository serializes and restores objects", async () => {
  const repository = new RedisCacheRepository<{ name: string }>(new MemoryCache());

  await repository.set("user:1", { name: "Atlas" });

  assert.deepEqual(await repository.get("user:1"), { name: "Atlas" });
});

test("RedisCacheRepository returns null for missing values", async () => {
  const repository = new RedisCacheRepository<string>(new MemoryCache());

  assert.equal(await repository.get("missing"), null);
});

test("RedisCacheRepository deletes cached values", async () => {
  const repository = new RedisCacheRepository<string>(new MemoryCache());

  await repository.set("key", "Atlas");
  await repository.delete("key");

  assert.equal(await repository.get("key"), null);
});

test("RedisCacheRepository supports custom serialization", async () => {
  const repository = new RedisCacheRepository<number>(
    new MemoryCache(),
    (value) => String(value),
    (value) => Number(value)
  );

  await repository.set("number", 42);

  assert.equal(await repository.get("number"), 42);
});
