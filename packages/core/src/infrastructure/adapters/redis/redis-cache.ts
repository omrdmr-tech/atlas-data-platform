import { createClient, type RedisClientType } from "redis";
import type { Cache } from "../../ports/cache.js";

export interface RedisCacheOptions {
  readonly url: string;
  readonly socketReconnectDelayMs?: number;
}

export function validateTtlSeconds(ttlSeconds: number): void {
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error("TTL must be a positive integer.");
  }
}

export class RedisCache implements Cache {
  private client?: RedisClientType;
  private connected = false;

  public constructor(public readonly options: RedisCacheOptions) {}

  public async connect(): Promise<void> {
    if (!this.options.url) throw new Error("Redis URL is required.");
    if (this.connected) return;

    this.client = createClient({
      url: this.options.url,
      socket: {
        reconnectStrategy: (retries) =>
          Math.min(
            retries * (this.options.socketReconnectDelayMs ?? 100),
            3000
          )
      }
    });

    await this.client.connect();
    this.connected = true;
  }

  public async disconnect(): Promise<void> {
    if (!this.client) {
      this.connected = false;
      return;
    }

    if (this.client.isOpen) await this.client.quit();

    this.client = undefined;
    this.connected = false;
  }

  public async get(key: string): Promise<string | null> {
    return this.getClient().get(key);
  }

  public async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const client = this.getClient();

    if (ttlSeconds !== undefined) {
      validateTtlSeconds(ttlSeconds);
      await client.set(key, value, { EX: ttlSeconds });
      return;
    }

    await client.set(key, value);
  }

  public async delete(key: string): Promise<void> {
    await this.getClient().del(key);
  }

  public isConnected(): boolean {
    return this.connected;
  }

  private getClient(): RedisClientType {
    if (!this.client || !this.connected) {
      throw new Error("Redis cache is not connected.");
    }
    return this.client;
  }
}
