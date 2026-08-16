import type { Cache } from "../../ports/cache.js";

export interface CacheRepository<T> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export class RedisCacheRepository<T> implements CacheRepository<T> {
  public constructor(
    private readonly cache: Cache,
    private readonly serialize: (value: T) => string = JSON.stringify,
    private readonly deserialize: (value: string) => T = JSON.parse as (value: string) => T
  ) {}

  public async get(key: string): Promise<T | null> {
    const value = await this.cache.get(key);
    return value === null ? null : this.deserialize(value);
  }

  public async set(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.cache.set(key, this.serialize(value), ttlSeconds);
  }

  public async delete(key: string): Promise<void> {
    await this.cache.delete(key);
  }
}
