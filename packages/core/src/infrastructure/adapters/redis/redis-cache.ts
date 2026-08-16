import type { Cache } from "../../ports/cache.js";

export interface RedisCacheOptions {
  readonly url: string;
}

export class RedisCache implements Cache {
  private connected = false;
  private readonly values = new Map<string, string>();

  public constructor(public readonly options: RedisCacheOptions) {}

  public async connect(): Promise<void> {
    if (!this.options.url) throw new Error("Redis URL is required.");
    this.connected = true;
  }

  public async disconnect(): Promise<void> {
    this.connected = false;
    this.values.clear();
  }

  public async get(key: string): Promise<string | null> {
    this.assertConnected();
    return this.values.get(key) ?? null;
  }

  public async set(key: string, value: string, _ttlSeconds?: number): Promise<void> {
    this.assertConnected();
    this.values.set(key, value);
  }

  public async delete(key: string): Promise<void> {
    this.assertConnected();
    this.values.delete(key);
  }

  public isConnected(): boolean { return this.connected; }

  private assertConnected(): void {
    if (!this.connected) throw new Error("Redis cache is not connected.");
  }
}
