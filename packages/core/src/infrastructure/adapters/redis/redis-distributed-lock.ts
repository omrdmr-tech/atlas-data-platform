import type { DistributedLock } from "../../ports/distributed-lock.js";

export interface RedisLockClient {
  set(
    key: string,
    value: string,
    options: { NX: true; EX: number }
  ): Promise<string | null>;

  eval(
    script: string,
    options: { keys: string[]; arguments: string[] }
  ): Promise<number>;
}

export class RedisDistributedLock implements DistributedLock {
  private readonly tokens = new Map<string, string>();

  public constructor(
    private readonly client: RedisLockClient,
    private readonly tokenFactory: () => string = () => crypto.randomUUID()
  ) {}

  public async acquire(key: string, ttlSeconds: number): Promise<boolean> {
    if (!key) throw new Error("Lock key is required.");
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new Error("Lock TTL must be a positive integer.");
    }

    const token = this.tokenFactory();
    const result = await this.client.set(key, token, {
      NX: true,
      EX: ttlSeconds
    });

    if (result === "OK") {
      this.tokens.set(key, token);
      return true;
    }

    return false;
  }

  public async release(key: string): Promise<boolean> {
    if (!key) throw new Error("Lock key is required.");

    const token = this.tokens.get(key);
    if (!token) return false;

    const result = await this.client.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      {
        keys: [key],
        arguments: [token]
      }
    );

    if (result === 1) this.tokens.delete(key);
    return result === 1;
  }
}
