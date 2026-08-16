import { test } from "node:test";
import assert from "node:assert/strict";
import type { RedisLockClient } from "./redis-distributed-lock.js";
import { RedisDistributedLock } from "./redis-distributed-lock.js";

class FakeRedis implements RedisLockClient {
  private readonly values = new Map<string, string>();

  public async set(
    key: string,
    value: string,
    _options: { NX: true; EX: number }
  ): Promise<string | null> {
    if (this.values.has(key)) return null;
    this.values.set(key, value);
    return "OK";
  }

  public async eval(
    _script: string,
    options: { keys: string[]; arguments: string[] }
  ): Promise<number> {
    const key = options.keys[0];
    const token = options.arguments[0];

    if (this.values.get(key) !== token) return 0;

    this.values.delete(key);
    return 1;
  }
}

test("distributed lock acquires only when the key is free", async () => {
  const redis = new FakeRedis();
  const lock = new RedisDistributedLock(redis, () => "token-1");

  assert.equal(await lock.acquire("job:1", 30), true);
  assert.equal(await lock.acquire("job:1", 30), false);
});

test("distributed lock releases only its own lock", async () => {
  const redis = new FakeRedis();
  const lock = new RedisDistributedLock(redis, () => "token-1");

  await lock.acquire("job:1", 30);

  assert.equal(await lock.release("job:1"), true);
  assert.equal(await lock.release("job:1"), false);
});

test("distributed lock validates key and TTL", async () => {
  const redis = new FakeRedis();
  const lock = new RedisDistributedLock(redis, () => "token-1");

  await assert.rejects(lock.acquire("", 30), /Lock key is required/);
  await assert.rejects(lock.acquire("job:1", 0), /Lock TTL must be a positive integer/);
});

test("distributed lock does not release another owner's lock", async () => {
  const redis = new FakeRedis();
  const lock = new RedisDistributedLock(redis, () => "token-1");

  assert.equal(await lock.release("job:1"), false);
});
